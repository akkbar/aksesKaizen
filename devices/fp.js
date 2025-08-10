const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../config/fingerprint.json');
const aksesModel = require('../models/aksesModel');
const buzzer = require('./buzzer');
let io = null;
let enrollTimeout = null;
let lastNotFoundTime = 0;
const NOT_FOUND_COOLDOWN = 3500; // 3.5 detik


function setSocket(ioInstance) {
  io = ioInstance;
}

let lastRecognizedId = null;
let lastRecognizedTime = 0;
const RECOGNITION_COOLDOWN = 3500; // dalam ms

let portPath = 'COM8'; // default fallback

if (fs.existsSync(configPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(configPath));

    if (data.port && data.port.trim() !== '') {
      portPath = data.port.trim();
    } else {
      console.warn('⚠️ Config file ditemukan, tapi port kosong. Gunakan default COM8');
    }

  } catch (e) {
    console.error('⚠️ Gagal baca fingerprint config:', e.message);
  }
}


class FingerprintDriver extends EventEmitter {
  constructor(baudRate = 9600) {
    super();
    this.port = new SerialPort({ path: portPath, baudRate: baudRate });
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    this.setupListeners();
  }

  setupListeners() {
    this.parser.on('data', (line) => {
      line = line.trim();
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

    this.port.on('error', (err) => {
      console.error('❌ Serial port error:', err.message);
    });
  }

    startEnroll() {
        this.port.write('r\n');

        // Hapus timeout sebelumnya jika ada
        if (enrollTimeout) clearTimeout(enrollTimeout);

        // Set timeout 1 menit
        enrollTimeout = setTimeout(() => {
            console.warn('⏱️ Enroll timeout. Membatalkan proses...');
            this.cancel();
            if (io) io.emit('fp_failed', 'Waktu habis. Proses enroll dibatalkan.');
            this.currentEnroll = null;
        }, 60000); // 60 detik
    }


  sendEnrollID(id) {
    this.port.write(String(id) + '\n');
  }

  cancel() {
    this.port.write('c\n');
  }
}

// ⏱️ Inisialisasi langsung saat file di-load
const fp = new FingerprintDriver();

// 🔄 Tambahkan listener global di sini (jika ingin)
// fp.on('idle', () => console.log('[FP] Waiting for fingerprint...'));
fp.on('recognized', async (id) => {
  const now = Date.now();

  // ✅ Jika ID sama dan belum lewat 3 detik, abaikan
  if (id === lastRecognizedId && now - lastRecognizedTime < RECOGNITION_COOLDOWN) {
    return;
  }

  lastRecognizedId = id;
  lastRecognizedTime = now;

  console.log('[FP] Recognized ID:', id);

  const user = await aksesModel.findUser(2, id);
  let status = 1;
  if (user) {
    status = 1
    console.log('[FP] User ditemukan:', user.nama);
    buzzer.sendCommand('1'); // Nyalakan buzzer untuk sukses
  } else {
    status = 2
    console.log('[FP] User fingerprint ID', id, 'tidak ditemukan di database.');
    buzzer.sendCommand('2'); // Nyalakan buzzer untuk gagal
  }
    await aksesModel.logAccess({ user_id: user?.id, is_success: status, in_time: new Date(), data_raw: id });
});

fp.on('first_press', (id) => {
  if (io) io.emit('fp_status', 'Jari pertama diterima untuk ID ' + id);
});

fp.on('first_lift', (id) => {
  if (io) io.emit('fp_status', 'Angkat jari dan tempel lagi...');
});

fp.on('second_press', (id) => {
  if (io) io.emit('fp_status', 'Jari kedua diterima untuk ID ' + id);
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

  if (now - lastNotFoundTime < NOT_FOUND_COOLDOWN) {
    return; // abaikan spam
  }

  lastNotFoundTime = now;

  console.log('[FP] Fingerprint tidak dikenali.');
  buzzer.sendCommand('2'); // buzzer gagal

  await aksesModel.logAccess({
    user_id: null,
    is_success: 2,
    in_time: new Date(),
    data_raw: 'not_found'
  });

  if (io) io.emit('fp_failed', 'Fingerprint tidak dikenali.');
});




// 📦 Export langsung instansinya
module.exports = fp;
module.exports.setSocket = setSocket;