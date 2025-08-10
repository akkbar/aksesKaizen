// services/fingerprint.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { exec } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const aksesModel = require('../models/aksesModel');
const buzzer = require('./buzzer');

// =====================
// Konfigurasi & State
// =====================
let io = null;
let enrollTimeout = null;

const NOT_FOUND_COOLDOWN = 3500; // ms
const RECOGNITION_COOLDOWN = 3500; // ms

let lastNotFoundTime = 0;
let lastRecognizedId = null;
let lastRecognizedTime = 0;

const FP_CFG = path.join(__dirname, '../config/fingerprint.json');

function setSocket(ioInstance) {
  io = ioInstance;
}

// =====================
// Helper Config & Ports
// =====================
function listSerialPorts() {
  return new Promise((resolve, reject) => {
    exec('npx @serialport/list -f json', (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try {
        const raw = JSON.parse(stdout);
        // Ambil port USB yang punya VID/PID saja (abaikan COM1 dsb)
        const ports = raw.map(p => ({
          path: p.path,
          manufacturer: p.manufacturer || '',
          vendorId: (p.vendorId || '').toLowerCase(),
          productId: (p.productId || '').toLowerCase(),
        })).filter(p => p.vendorId && p.productId);
        resolve(ports);
      } catch (e) {
        reject(new Error('Invalid serial list output'));
      }
    });
  });
}

function readFpConfig() {
  if (!fs.existsSync(FP_CFG)) return null;
  try {
    return JSON.parse(fs.readFileSync(FP_CFG, 'utf8'));
  } catch {
    return null;
  }
}

function writeFpConfig(cfg) {
  fs.mkdirSync(path.dirname(FP_CFG), { recursive: true });
  fs.writeFileSync(FP_CFG, JSON.stringify(cfg, null, 2));
}

/** Resolve COM path dari config fingerprint (match by VID/PID). */
async function resolvePortFromConfig() {
  const cfg = readFpConfig();
  if (!cfg || !cfg.match || !cfg.match.vendorId || !cfg.match.productId) return null;

  const wantedVid = String(cfg.match.vendorId).toLowerCase();
  const wantedPid = String(cfg.match.productId).toLowerCase();

  const ports = await listSerialPorts();
  const match = ports.find(p => p.vendorId === wantedVid && p.productId === wantedPid);

  return match ? match.path : null;
}

// =====================
// Fingerprint Driver
// =====================
class FingerprintDriver extends EventEmitter {
  constructor(baudRate = 9600) {
    super();
    this.baudRate = baudRate;
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.reconnectTimer = null;

    this.currentEnroll = null; // kamu sudah pakai ini di flow enroll
  }

  async pickPortPath() {
    // Hanya resolve berdasar VID/PID; kalau belum ada -> null (biar retry)
    const resolved = await resolvePortFromConfig();
    return resolved || null;
  }

  async connect() {
    try {
      if (this.isConnected) return;

      const targetPath = await this.pickPortPath();
      if (!targetPath) {
        console.warn('⚠️ Fingerprint: VID/PID belum ketemu. Re-try 5s...');
        return this.scheduleReconnect();
      }

      // Simpan lastKnownPath (informasi untuk UI/log)
      const cfg = readFpConfig() || {};
      cfg.lastKnownPath = targetPath;
      writeFpConfig(cfg);

      this.port = new SerialPort({ path: targetPath, baudRate: this.baudRate });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.port.on('open', () => {
        this.isConnected = true;
        console.log(`✅ Fingerprint connected @ ${targetPath}`);
        this.setupListeners();
        if (io) io.emit('device_status', { event: 'fp_connected', path: targetPath });
      });

      this.port.on('error', (err) => {
        console.error('❌ FP serial error:', err.message);
        this.cleanup();
        this.scheduleReconnect();
      });
    } catch (e) {
      console.error('❌ FP connect() failed:', e.message);
      this.cleanup();
      this.scheduleReconnect();
    }
  }

  setupListeners() {
    this.parser.on('data', (line) => {
      line = String(line || '').trim();
      if (!line) return;

      if (line === 'i') {
        this.emit('idle');
      } else if (line === 't') {
        this.emit('enroll_confirm');
      } else if (line === '0') {
        this.emit('not_found');
      } else if (/^\d+$/.test(line)) {
        this.emit('recognized', Number(line));
      } else if (/^y(\d+)$/.test(line)) {
        this.emit('first_press', Number(RegExp.$1));
      } else if (/^u(\d+)$/.test(line)) {
        this.emit('first_lift', Number(RegExp.$1));
      } else if (/^h(\d+)$/.test(line)) {
        this.emit('second_press', Number(RegExp.$1));
      } else if (/^x(\d+)$/.test(line)) {
        this.emit('enroll_failed', Number(RegExp.$1));
      } else if (/^i(\d+)$/.test(line)) {
        this.emit('enroll_success', Number(RegExp.$1));
      } else {
        this.emit('raw', line);
      }
    });

    this.port.on('close', () => {
      console.log('🔌 Fingerprint port closed');
      this.cleanup();
      this.scheduleReconnect();
    });
  }

  cleanup() {
    this.isConnected = false;
    if (this.port) {
      try { this.port.removeAllListeners(); } catch {}
    }
    if (this.parser) {
      try { this.parser.removeAllListeners(); } catch {}
    }
    this.port = null;
    this.parser = null;
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return; // cegah double
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log('🔄 FP: trying to re-resolve & reconnect...');
      await this.connect();
    }, 5000);
  }

  // =====================
  // Command ke device
  // =====================
  writeLine(s) {
    if (!this.isConnected || !this.port) {
      console.warn('⚠️ FP write skipped (not connected).');
      return;
    }
    this.port.write(s, (err) => {
      if (err) console.error('❌ FP write error:', err.message);
    });
  }

  startEnroll() {
    this.writeLine('r\n');

    if (enrollTimeout) clearTimeout(enrollTimeout);
    enrollTimeout = setTimeout(() => {
      console.warn('⏱️ Enroll timeout. Membatalkan proses...');
      this.cancel();
      if (io) io.emit('fp_failed', 'Waktu habis. Proses enroll dibatalkan.');
      this.currentEnroll = null;
    }, 60000);
  }

  sendEnrollID(id) {
    this.writeLine(String(id) + '\n');
  }

  cancel() {
    this.writeLine('c\n');
  }
}

// =====================
// Inisialisasi instance
// =====================
const fp = new FingerprintDriver();

// Event handlers (tetap sama dengan logic kamu)
fp.on('recognized', async (id) => {
  const now = Date.now();
  if (id === lastRecognizedId && now - lastRecognizedTime < RECOGNITION_COOLDOWN) return;

  lastRecognizedId = id;
  lastRecognizedTime = now;

  console.log('[FP] Recognized ID:', id);

  const user = await aksesModel.findUser(2, id);
  let status = 1;
  if (user) {
    status = 1;
    console.log('[FP] User ditemukan:', user.nama);
    buzzer.sendCommand('1'); // sukses
  } else {
    status = 2;
    console.log('[FP] User fingerprint ID', id, 'tidak ditemukan di database.');
    buzzer.sendCommand('2'); // gagal
  }
  await aksesModel.logAccess({ user_id: user?.id, is_success: status, in_time: new Date(), data_raw: id });
});

fp.on('first_press', (id) => {
  if (io) io.emit('fp_status', 'Tempelkan Jari untuk ID ' + id);
});

fp.on('first_lift', () => {
  if (io) io.emit('fp_status', 'Angkat jari dan tempel lagi...');
});

fp.on('second_press', (id) => {
  if (io) io.emit('fp_status', 'Angkat jari, Tunggu 4 detik, lalu Tempelkan Jari yang sama untuk ID ' + id);
});

fp.on('enroll_success', async (id) => {
  if (enrollTimeout) clearTimeout(enrollTimeout);
  if (!fp.currentEnroll || fp.currentEnroll.id_tipe !== id) return;

  await aksesModel.addUserData({
    nama: fp.currentEnroll.nama,
    tipe: 2,
    id_tipe: id,
    is_active: 1,
    created_at: new Date(),
  });

  if (io) io.emit('fp_success', 'Enroll berhasil untuk ID ' + id + ', pengguna: ' + fp.currentEnroll.nama);
  fp.currentEnroll = null;
});

fp.on('enroll_failed', (id) => {
  if (enrollTimeout) clearTimeout(enrollTimeout);
  if (io) io.emit('fp_failed', 'Enroll gagal untuk ID ' + id);
  fp.currentEnroll = null;
});

fp.on('not_found', async () => {
  const now = Date.now();
  if (now - lastNotFoundTime < NOT_FOUND_COOLDOWN) return;
  lastNotFoundTime = now;

  console.log('[FP] Fingerprint tidak dikenali.');
  buzzer.sendCommand('2');

  await aksesModel.logAccess({
    user_id: null,
    is_success: 2,
    in_time: new Date(),
    data_raw: 'not_found'
  });

  if (io) io.emit('fp_failed', 'Fingerprint tidak dikenali.');
});

// Auto connect saat load
fp.connect().catch(err => {
  console.error('❌ Gagal inisialisasi koneksi fingerprint:', err.message);
});

// Export
module.exports = fp;
module.exports.setSocket = setSocket;
