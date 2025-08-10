// services/serialHelper.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---- Paths config untuk kedua device ----
const CFG_DIR = path.join(__dirname, '../config');
const CFG_PATHS = {
  relay: path.join(CFG_DIR, 'relay.json'),
  fingerprint: path.join(CFG_DIR, 'fingerprint.json'),
};

/**
 * List semua serial ports (USB) dengan info minimum.
 * Hanya return port yang punya VID & PID (abaikan COM1 dsb).
 */
function listSerialPorts() {
  return new Promise((resolve, reject) => {
    exec('npx @serialport/list -f json', (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try {
        const raw = JSON.parse(stdout);
        const mapped = raw.map(p => ({
          path: p.path,
          manufacturer: p.manufacturer || '',
          vendorId: (p.vendorId || '').toLowerCase(),
          productId: (p.productId || '').toLowerCase(),
        }));
        // hanya USB serial yang punya VID/PID
        resolve(mapped.filter(p => p.vendorId && p.productId));
      } catch (e) {
        reject(new Error('Invalid serial list output'));
      }
    });
  });
}

/** Baca config sesuai jenis: 'relay' | 'fingerprint' */
function readConfig(kind) {
  const file = CFG_PATHS[kind];
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Tulis config sesuai jenis */
function writeConfig(kind, cfg) {
  const file = CFG_PATHS[kind];
  if (!file) throw new Error('Unknown config kind');
  fs.mkdirSync(CFG_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}

/**
 * Resolve COM path dari config (match by VID/PID).
 * Return string path (mis. 'COM3') atau null jika belum ketemu.
 */
async function resolvePortFromConfig(kind) {
  const cfg = readConfig(kind);
  if (!cfg || !cfg.match || !cfg.match.vendorId || !cfg.match.productId) return null;

  const wantedVid = String(cfg.match.vendorId).toLowerCase();
  const wantedPid = String(cfg.match.productId).toLowerCase();

  const ports = await listSerialPorts();
  const match = ports.find(p => p.vendorId === wantedVid && p.productId === wantedPid);

  return match ? match.path : null;
}

/**
 * Bind config berdasarkan path terpilih:
 * - Cari port pada list yang path-nya cocok
 * - Simpan match {vendorId, productId} + lastKnownPath
 */
async function bindByPath(kind, chosenPath) {
  const ports = await listSerialPorts();
  const found = ports.find(p => p.path === chosenPath);
  if (!found) throw new Error(`Port ${chosenPath} tidak ditemukan di daftar`);

  const cfg = readConfig(kind) || {};
  cfg.match = { vendorId: found.vendorId, productId: found.productId };
  cfg.lastKnownPath = found.path;
  writeConfig(kind, cfg);

  return { kind, vendorId: found.vendorId, productId: found.productId, path: found.path };
}

module.exports = {
  listSerialPorts,
  readConfig,
  writeConfig,
  resolvePortFromConfig,
  bindByPath,
};
