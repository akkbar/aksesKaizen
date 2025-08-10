const { GlobalKeyboardListener } = require('node-global-key-listener');
const aksesModel = require('../models/aksesModel');
const buzzer = require('./buzzer');

// --- Konfigurasi ---
const RFID_MIN_LENGTH = 6;
const RFID_MAX_LENGTH = 20;
const SCAN_TIMEOUT_MS = 100;
const ENROLL_TIMEOUT_S = 60;

// --- Variabel Status ---
let mode = 'waiting';
let enrollCandidate = null;
let enrollTimeout = null;
let firstEnrollScan = null;     // Untuk menyimpan data scan pertama
let confirmTimeout = null;      // Timer untuk jendela konfirmasi
let enrollStatus = {
  step: 'inactive', // 'inactive', 'waiting_first_tap', 'waiting_second_tap', 'failed', 'ready'
  message: 'Mode pendaftaran tidak aktif.',
  rfid: null
};

// --- State Machine untuk Scanner ---
let scannerState = 'IDLE'; // 'IDLE', 'SCANNING', 'AWAITING_SUBMISSION'
let inputBuffer = '';
let scanTimeout = null;

function resetScanner() {
  clearTimeout(scanTimeout);
  scannerState = 'IDLE';
  inputBuffer = '';
}

async function processRfidData(rfid) {
  console.log('📥 Scanned RFID:', rfid);

  if (mode === 'waiting') {
    const user = await aksesModel.findUser(1, rfid);
    const status = user ? 1 : 2;
    await aksesModel.logAccess({ user_id: user?.id, is_success: status, in_time: new Date(), data_raw: rfid });
    console.log(user ? `✅ Welcome ${user.nama}` : '❌ Unknown card');
    buzzer.sendCommand(user ? '1' : '2'); // Nyalakan buzzer untuk sukses atau gagal
  }

    if (mode === 'enroll') {
        if (firstEnrollScan) {
        clearTimeout(confirmTimeout);
        if (rfid === firstEnrollScan) {
            enrollCandidate = rfid;
            scannerState = 'AWAITING_SUBMISSION';
            enrollStatus = { step: 'ready', message: 'Konfirmasi berhasil! Siap untuk submit.', rfid: rfid };
        } else {
            firstEnrollScan = null;
            enrollStatus = { step: 'failed', message: `Kartu tidak cocok. Silakan ulangi tap pertama.`, rfid: null };
        }
        } else {
        firstEnrollScan = rfid;
        enrollStatus = { step: 'waiting_second_tap', message: `Tap pertama diterima (${rfid}). Tap lagi untuk konfirmasi.`, rfid: null };

        confirmTimeout = setTimeout(() => {
            if (firstEnrollScan) {
                firstEnrollScan = null;
                enrollStatus = { step: 'failed', message: 'Waktu konfirmasi habis. Ulangi tap pertama.', rfid: null };
            }
        }, 5000);
        }
    }
}

function handleKeyPress(event) {
  if (scannerState === 'AWAITING_SUBMISSION') return;
  if (event.state !== "DOWN") return;
  if (event.name === 'ENTER') {
    if (scannerState === 'SCANNING') {
      clearTimeout(scanTimeout);
      handleScanComplete();
    }
    return;
  }
  if (event.name.length !== 1) return;
  if (scannerState === 'IDLE') {
    scannerState = 'SCANNING';
  }
  inputBuffer += event.name;
  if (inputBuffer.length > RFID_MAX_LENGTH) {
    resetScanner();
    return;
  }
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(handleScanComplete, SCAN_TIMEOUT_MS);
}

async function handleScanComplete() {
  const dataToProcess = inputBuffer;
  resetScanner();
  if (dataToProcess.length >= RFID_MIN_LENGTH && dataToProcess.length <= RFID_MAX_LENGTH) {
    if (/^[a-zA-Z0-9]+$/.test(dataToProcess)) {
      await processRfidData(dataToProcess);
    }
  }
}

async function startRFIDReader() {
  const listener = new GlobalKeyboardListener();
  listener.addListener(handleKeyPress);
  console.log('🟢 RFID HID Keyboard Reader aktif (mode:', mode + ')');
}

function setEnrollMode() {
  mode = 'enroll';
  enrollCandidate = null;
  firstEnrollScan = null;
  clearTimeout(confirmTimeout);
  resetScanner();
  
  // Set status awal saat mode enroll diaktifkan
  enrollStatus = { step: 'waiting_first_tap', message: 'Silakan tap kartu pertama.', rfid: null };

  clearTimeout(enrollTimeout);
  enrollTimeout = setTimeout(() => {
    if (mode === 'enroll') {
        mode = 'waiting';
        enrollStatus = { step: 'inactive', message: 'Waktu habis.', rfid: null };
        console.log('⏳ Timeout global — kembali ke mode waiting');
    }
  }, ENROLL_TIMEOUT_S * 1000);
}

async function submitEnrollment(nama) {
  // 1. Pastikan ada kartu yang siap didaftarkan
  if (!enrollCandidate) {
    return null; // Tidak ada yang bisa disubmit
  }

  const rfid = enrollCandidate;

  // 2. Cek apakah RFID sudah terdaftar
  const existingUser = await aksesModel.findUser(1, rfid);
  if (existingUser) {
    console.log(`⚠️ Gagal mendaftar: RFID ${rfid} sudah digunakan oleh ${existingUser.nama}.`);
    // Reset state agar pengguna bisa mencoba scan kartu lain
    enrollCandidate = null;
    resetScanner();
    // Kembalikan objek error yang jelas
    return { 
      error: 'duplicate', 
      message: `RFID sudah terdaftar atas nama: ${existingUser.nama}.` 
    };
  }

  // 3. Jika aman, reset semua state dan lanjutkan pendaftaran
  enrollCandidate = null;
  mode = 'waiting';
  clearTimeout(enrollTimeout);
  resetScanner();
  
  await aksesModel.addUserData({ nama, tipe: 1, id_tipe: rfid, created_at: new Date() });
  console.log(`✅ Pendaftaran sukses untuk ${nama} dengan RFID ${rfid}.`);

  // 4. Kembalikan hanya RFID jika sukses
  return { rfid };
}

function getEnrollmentStatus() {
  // Jika mode bukan enroll, pastikan statusnya inactive
  if (mode !== 'enroll') {
    return { step: 'inactive', message: 'Mode pendaftaran tidak aktif.', rfid: null };
  }
  return enrollStatus;
}

module.exports = {
  startRFIDReader,
  setEnrollMode,
  submitEnrollment,
  getEnrollmentStatus 
};