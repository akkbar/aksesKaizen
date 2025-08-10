// services/deviceController.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { exec } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const aksesModel = require('../models/aksesModel');

// --- Konfigurasi & State Global ---
let io = null; // Instance Socket.IO
const RELAY_CFG = path.join(__dirname, '../config/relay.json');

function setSocket(ioInstance) {
  io = ioInstance;
  console.log('🔌 Socket.IO terhubung ke DeviceController.');
}

// --- Utils: listing & config ---
function listSerialPorts() {
  return new Promise((resolve, reject) => {
    exec('npx @serialport/list -f json', (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try {
        const raw = JSON.parse(stdout);
        // Map minimal field, lalu filter hanya port yang punya VID/PID (USB serial)
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

function readRelayConfig() {
  if (!fs.existsSync(RELAY_CFG)) return null;
  try {
    return JSON.parse(fs.readFileSync(RELAY_CFG, 'utf8'));
  } catch {
    return null;
  }
}

function writeRelayConfig(cfg) {
  fs.mkdirSync(path.dirname(RELAY_CFG), { recursive: true });
  fs.writeFileSync(RELAY_CFG, JSON.stringify(cfg, null, 2));
}

/**
 * Resolve COM path dari relay.json (match by VID/PID saja).
 * Return 'COMx' atau null kalau belum ketemu.
 */
async function resolvePortFromConfig() {
  const cfg = readRelayConfig();
  if (!cfg || !cfg.match || !cfg.match.vendorId || !cfg.match.productId) return null;

  const wantedVid = String(cfg.match.vendorId).toLowerCase();
  const wantedPid = String(cfg.match.productId).toLowerCase();

  const ports = await listSerialPorts();
  const match = ports.find(p => p.vendorId === wantedVid && p.productId === wantedPid);

  return match ? match.path : null;
}

// --- Device Controller ---
class DeviceController extends EventEmitter {
  constructor(baudRate = 9600) {
    super();
    this.baudRate = baudRate;
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.isCurrentlyTriggered = false;
    this.reconnectTimer = null;
  }

  async pickPortPath() {
    // HANYA pakai resolver VID/PID; kalau tidak ketemu, biarkan null (jangan fallback COM1)
    const resolved = await resolvePortFromConfig();
    return resolved || null;
  }

  async connect() {
    try {
      if (this.isConnected) return;

      const targetPath = await this.pickPortPath();
      if (!targetPath) {
        console.warn('⚠️ Relay: VID/PID belum ketemu. Re-try 5s...');
        return this.scheduleReconnect();
      }

      // Simpan lastKnownPath (informasi untuk UI/log)
      const cfg = readRelayConfig() || {};
      cfg.lastKnownPath = targetPath;
      writeRelayConfig(cfg);

      this.port = new SerialPort({ path: targetPath, baudRate: this.baudRate });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.port.on('open', () => {
        this.isConnected = true;
        console.log(`✅ Relay connected @ ${targetPath}`);
        this.setupListeners();
        if (io) io.emit('device_status', { event: 'relay_connected', path: targetPath });
      });

      this.port.on('error', (err) => {
        console.error('❌ Serial error:', err.message);
        this.cleanup();
        this.scheduleReconnect();
      });
    } catch (e) {
      console.error('❌ connect() failed:', e.message);
      this.cleanup();
      this.scheduleReconnect();
    }
  }

  setupListeners() {
    this.parser.on('data', (line) => {
      const data = line.trim();

      if (data === '1') {
        if (!this.isCurrentlyTriggered) {
          this.isCurrentlyTriggered = true;
          this.emit('inputTriggered');
        }
      } else if (data === '0') {
        this.isCurrentlyTriggered = false;
      }

      this.emit('rawData', data);
    });

    this.port.on('close', () => {
      console.log('🔌 Relay port closed');
      this.cleanup();
      this.scheduleReconnect();
    });
  }

  cleanup() {
    this.isConnected = false;
    this.isCurrentlyTriggered = false;
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
    if (this.reconnectTimer) return; // jangan dobel
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log('🔄 Trying to re-resolve & reconnect relay...');
      await this.connect();
    }, 5000);
  }

  sendCommand(command) {
    if (!this.isConnected) return console.error('❌ Gagal kirim perintah: Koneksi relay tidak terbuka.');
    const validCommands = ['0', '1', '2', '3'];
    if (!validCommands.includes(command)) return console.error(`❌ Perintah tidak valid: '${command}'.`);
    this.port.write(command, (err) => {
      if (err) return console.error('❌ Error saat mengirim perintah:', err.message);
      console.log(`🚀 Perintah relay '${command}' berhasil dikirim.`);
    });
  }

  close() {
    if (this.port && this.isConnected) this.port.close();
  }
}

// ⏱️ Inisialisasi (Singleton)
const device = new DeviceController();

// 🔄 Listeners aplikasi
device.on('inputTriggered', async () => {
  console.log('[RELAY] Input terpicu (misal: pintu dibuka paksa).');
  if (io) io.emit('device_status', { event: 'triggered', message: 'Pintu dibuka paksa!' });
  try {
    await aksesModel.updateLogAccess();
  } catch (err) {
    console.error('❌ Gagal log input terpicu ke database:', err);
  }
});

device.on('inputIdle', () => {
  // optional
});

// 🚀 Auto connect saat require
device.connect().catch((err) => {
  console.error('❌ Gagal inisialisasi koneksi relay:', err.message);
});

// 📦 Ekspor
module.exports = device;
module.exports.setSocket = setSocket;
