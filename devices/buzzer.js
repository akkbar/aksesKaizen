// services/deviceController.js

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const aksesModel = require('../models/aksesModel');

// --- Konfigurasi dan State Global ---
let io = null; // Instance Socket.IO
const configPath = path.join(__dirname, '../config/relay.json');
let portPath = 'COM3'; // Default port

// Baca konfigurasi port dari file JSON
if (fs.existsSync(configPath)) {
  try {
    const configData = JSON.parse(fs.readFileSync(configPath));
    if (configData.port && configData.port.trim() !== '') {
      portPath = configData.port.trim();
    } else {
      console.warn('⚠️ File config relay ditemukan, tapi port kosong. Gunakan default.');
    }
  } catch (e) {
    console.error('⚠️ Gagal baca relay config:', e.message);
  }
}

/**
 * Fungsi untuk menerima instance Socket.IO dari app.js
 */
function setSocket(ioInstance) {
  io = ioInstance;
  console.log('🔌 Socket.IO terhubung ke DeviceController.');
}

class DeviceController extends EventEmitter {
  constructor(baudRate = 9600) {
    super();
    // Constructor sekarang tidak perlu parameter path, karena sudah dibaca di atas
    this.portPath = portPath;
    this.baudRate = baudRate;
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.isCurrentlyTriggered = false; 
  }

  connect() {
    // ... (Fungsi connect tidak berubah)
    return new Promise((resolve, reject) => {
        if (this.isConnected) {
            console.warn('⚠️ Koneksi relay sudah terbuka.');
            return resolve();
        }
        this.port = new SerialPort({ path: this.portPath, baudRate: this.baudRate });
        this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        this.port.on('open', () => {
            this.isConnected = true;
            console.log(`✅ Koneksi serial relay ke ${this.portPath} berhasil dibuka.`);
            this.setupListeners();
            resolve();
        });
        this.port.on('error', (err) => {
            console.error(`❌ Gagal membuka koneksi relay ke ${this.portPath}:`, err.message);
            this.isConnected = false;
            reject(err);
        });
    });
  }

  setupListeners() {
        this.parser.on('data', (line) => {
            const data = line.trim();

            if (data === '1') {
                // HANYA emit event jika kita TIDAK sedang dalam kondisi terpicu
                if (!this.isCurrentlyTriggered) {
                    // 1. Set penanda bahwa kita sekarang dalam kondisi terpicu
                    this.isCurrentlyTriggered = true;
                    
                    // 2. Emit event 'inputTriggered' HANYA SATU KALI
                    this.emit('inputTriggered');
                }
                // Jika data '1' berikutnya datang saat isCurrentlyTriggered masih true,
                // baris kode di atas akan dilewati.

            } else if (data === '0') {
                // Saat Arduino mengirim '0', itu artinya kondisi sudah kembali normal.
                // Reset penanda kita agar siap untuk pemicuan berikutnya.
                this.isCurrentlyTriggered = false;
            }

            this.emit('rawData', data);
        });

        this.port.on('close', () => {
            this.isConnected = false;
            this.isCurrentlyTriggered = false; // Reset juga saat koneksi terputus
            console.log('🔌 Koneksi serial relay ditutup.');
            this.emit('close');
        });
    }
  
  sendCommand(command) {
    // ... (Fungsi sendCommand tidak berubah)
    if (!this.isConnected) return console.error('❌ Gagal kirim perintah: Koneksi relay tidak terbuka.');
    const validCommands = ['0', '1', '2', '3'];
    if (!validCommands.includes(command)) return console.error(`❌ Perintah tidak valid: '${command}'.`);
    this.port.write(command, (err) => {
        if (err) return console.error('❌ Error saat mengirim perintah:', err.message);
        console.log(`🚀 Perintah relay '${command}' berhasil dikirim.`);
    });
  }

  close() {
    // ... (Fungsi close tidak berubah)
    if (this.port && this.isConnected) this.port.close();
  }
}

// ⏱️ Inisialisasi langsung untuk menciptakan satu instance (Singleton Pattern)
const device = new DeviceController();

// 🔄 Tambahkan listener global di sini untuk menangani logika aplikasi
device.on('inputTriggered', async () => {
  console.log('[RELAY] Input terpicu (misal: pintu dibuka paksa).');
  // Kirim status ke frontend melalui Socket.IO jika terhubung
  if (io) {
    io.emit('device_status', { event: 'triggered', message: 'Pintu dibuka paksa!' });
  }
  // Log kejadian ini ke database
  try {
    await aksesModel.updateLogAccess();
  } catch(err) {
    console.error('❌ Gagal log input terpicu ke database:', err);
  }
});

device.on('inputIdle', () => {
  // Mungkin tidak perlu melakukan apa-apa saat idle, atau cukup log jika perlu
  // console.log('[RELAY] Input kembali normal.');
});

// 🚀 Otomatis konek saat pertama kali require
device.connect().catch((err) => {
  console.error('❌ Gagal inisialisasi koneksi relay:', err.message);
});

// 📦 Ekspor instance dan fungsi setSocket
module.exports = device;
module.exports.setSocket = setSocket;