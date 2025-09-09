const moment = require('moment');
const aksesModel = require('../models/aksesModel')
const portDetector = require('../devices/detect');
const { setEnrollMode, submitEnrollment, getEnrollmentStatus } = require('../devices/rfid');
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../config/fingerprint.json');
const relayPath = path.join(__dirname, '../config/relay.json');
const { bindByPath } = require('../devices/serialHelper');
const fp = require('../devices/fp');
let ioInstance = null;
const momenttz = require('moment-timezone');
const LOCAL_TZ = 'Asia/Jakarta';
const { Buffer } = require('buffer');

function detectStreamType(url) {
  const u = url.toLowerCase();
  if (u.endsWith('.m3u8') || u.includes('/hls/')) return 'hls';
  if (u.includes('/mjpeg/') || u.endsWith('.mjpg')) return 'mjpeg';
  if (u.endsWith('.jpg') || u.includes('/sjpeg/') || u.includes('/jpeg/')) return 'jpeg';
  return 'unknown';
}

exports.getHomePage = async (req, res) => {
  try {
    const header = { pageTitle: 'Dashboard', user: req.session.user };
    const rawStreams = await aksesModel.getActiveStreams(); // {url}

    const streams = rawStreams.map((row, idx) => {
      const fullUrl = row.url.trim();
      const encoded = Buffer.from(fullUrl).toString('base64url');
      return {
        id: `s${idx + 1}`,
        originalUrl: fullUrl,
        type: detectStreamType(fullUrl),
        proxyUrl: `/stream/b64/${encoded}`, // selalu lewat proxy
      };
    });

    res.render('akses/index', { header, data: { url: streams } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
};

// exports.getHomePage = async (req, res) => {
//     try {
//         const header = {pageTitle: 'Dashboard', user: req.session.user}
//         const rawStreams = await aksesModel.getActiveStreams();
//         const streams = rawStreams.map((stream) => {
//             // Contoh: ambil UID dan TOKEN dari URL asli
//             const parts = stream.url.split('/');
//             const uid = parts[parts.length - 2];
//             const token = parts[parts.length - 1];

//             return {
//                 ...stream,
//                 uid,
//                 token,
//                 proxyUrl: `/stream/${uid}/${token}`,
//             };
//         });
//         const data = {
//             url: streams
//         }
//         res.render('akses/index', {header: header, data: data})
//     } catch (error) {
//         console.error(error)
//         res.status(500).send('Internal server error')
//     }
// }
//====================================================================================================================
//====================================================================================================================
//====================================================================================================================
//Status Device==========================================================================================================
exports.deviceStatus = async (req, res) => {
    try {
        let portPath = '';
        let relayPort = '';
        if (fs.existsSync(configPath)) {
            const data = JSON.parse(fs.readFileSync(configPath));
            portPath = data.port || portPath;
        }
        if (fs.existsSync(relayPath)) {
            const data = JSON.parse(fs.readFileSync(relayPath));
            relayPort = data.port || portPath;
        }
        const header = {pageTitle: 'Status Device', user: req.session.user}
        const data = {
            portPath, relayPort
        }
        res.render('akses/statusDevice', {header: header, data: data})
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal server error')
    }
};
exports.setFingerprintPort = async (req, res) => {
  try {
    const { port } = req.body;
    if (!port) return res.status(400).json({ message: 'Port not provided' });
    const result = await bindByPath('fingerprint', port);
    res.json({ message: `Fingerprint bound to VID:${result.vendorId} PID:${result.productId} @ ${result.path}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || 'Failed to bind fingerprint' });
  }
};
exports.setRelayByPath = async (req, res) => {
  try {
    const { port } = req.body;
    if (!port) return res.status(400).json({ message: 'Port not provided' });
    const result = await bindByPath('relay', port);
    res.json({ message: `Relay bound to VID:${result.vendorId} PID:${result.productId} @ ${result.path}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || 'Failed to bind relay' });
  }
};
exports.detectDevice = async (req, res) => {
    try {
        const ports = await portDetector.getSerialPorts();
        res.json({ ports });
    } catch (err) {
        console.error('Failed to list ports:', err);
        res.status(500).json({ error: 'Unable to detect serial ports' });
    }
};
//====================================================================================================================
//====================================================================================================================
//====================================================================================================================
//LIST AKSES==========================================================================================================
exports.getAkses = async (req, res) => {
    try {
        const header = {pageTitle: 'Akses User', user: req.session.user}
        const data = {
            
        }
        res.render('akses/userakses', {header: header, data: data})
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal server error')
    }
};
exports.getAksesAjax = async (req, res) => {
    const filters = {
        draw: req.body.draw,
        tipe: req.body.tipe,
        start: req.body.start,
        length: req.body.length,
        search_value: req.body.search['value'],
        order: req.body.order || []
    };
    const columnNames = [
        'nama'
    ];
    const columnSearches = req.body.columns.map((col, index) => {
        if (col.search.value && col.orderable) {
            return { column: columnNames[index], value: col.search.value }
        }
        return null
    }).filter(col => col)

    try {
        const orderColumnIndex = filters.order.length > 0 ? filters.order[0].column : null
        const orderDirection = filters.order.length > 0 ? filters.order[0].dir : 'asc'
        
        const orderColumn = orderColumnIndex !== null ? columnNames[orderColumnIndex] : 'nama'
        
        const data = await aksesModel.uAccess(filters, orderColumn, orderDirection, columnSearches)

        const recordsFiltered = await aksesModel.uAccessFiltered(filters, columnSearches)

        const output = {
            draw: filters.draw,
            recordsTotal: await aksesModel.uAccessCountAll(),
            recordsFiltered,
            data: data.map(record => {
                return [
                    record.nama,
                    record.tipe === 1 ? "RFID" : "Fingerprint",
                    record.id_tipe,
                    record.created_at,
                    `<button class="btn btn-sm btn-primary" onclick="show_modal('${record.id}')">Edit</button>`
                ];
            })
        };

        res.json(output)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'An error occurred while fetching the data' })
    }
}
exports.getAccessDetail = async (req, res) => {
    try {
        const { id } = req.body;
        const accessDetail = await aksesModel.getUserDataById(id);
        res.status(200).json(accessDetail);
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal server error')
    }
};
exports.updateAccess = async (req, res) => {
    try {
        const array = {
            nama: req.body.nama,
            is_active: req.body.is_active,
        }

        // Update device using model
        const updated = await aksesModel.editUserDataById(req.body.id, array);

        if (updated) {
            return res.status(201).json({ message: 'Akses berhasil diperbarui.' });
        } else {
            return res.status(404).json({ message: 'Data tidak ditemukan.' });
        }
    } catch (error) {
        console.error('Error updating device:', error);
        return res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
}
//====================================================================================================================
//====================================================================================================================
//====================================================================================================================
//ADD RFID==========================================================================================================
exports.addRFID = async (req, res) => {
    try {
        const header = {pageTitle: 'Tambah RFID', user: req.session.user}
        const data = {
            
        }
        res.render('akses/addrfid', {header: header, data: data})
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal server error')
    }
};
exports.startEnrollRFID = async (req, res) => {
    setEnrollMode();
    res.json({ message: 'Enroll mode active' });
};
exports.submitEnrollRFID = async (req, res) => {
    const { nama } = req.body;

    if (!nama || nama.trim() === '') {
        return res.status(400).json({ success: false, message: 'Nama tidak boleh kosong.' });
    }

    try {
        const result = await submitEnrollment(nama);

        // Kasus 1: Tidak ada kartu yang siap (timeout, dll)
        if (!result) {
            return res.status(400).json({ 
                success: false, 
                message: 'Gagal mendaftarkan. Tidak ada kartu yang siap atau waktu habis.' 
            });
        }

        // Kasus 2: RFID sudah terdaftar (duplikat)
        if (result.error === 'duplicate') {
            // Status 409 Conflict lebih cocok untuk kasus ini
            return res.status(409).json({ 
                success: false, 
                message: result.message 
            });
        }

        // Kasus 3: Pendaftaran sukses
        if (result.rfid) {
            return res.status(201).json({ 
                success: true, 
                message: 'Pengguna berhasil didaftarkan!',
                data: {
                    nama: nama,
                    rfid: result.rfid
                }
            });
        }

    } catch (err) {
        console.error("Submit Enrollment Error:", err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
};
exports.statusEnrollRFID = async (req, res) => {
    const status = getEnrollmentStatus();
  res.status(200).json(status);
};
//====================================================================================================================
//====================================================================================================================
//====================================================================================================================
//ADD FP==========================================================================================================
exports.addFingerprint = async (req, res) => {
    try {
        const header = {pageTitle: 'Tambah Fingerprint', user: req.session.user}
        const usedIDs = (await aksesModel.getUsedFP()).map(Number);

        const maxID = 63;
        const allIDs = Array.from({ length: maxID }, (_, i) => i + 1);
        const availableIDs = allIDs.filter(id => !usedIDs.includes(id));

        const data = {
            availableIDs,
            usedIDs
        }
        res.render('akses/addFP', {header: header, data: data})
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal server error')
    }
};
exports.setSocketIO = function(io) {
  ioInstance = io;
};

exports.enrollFingerprint = async (req, res) => {
  const { nama, id_tipe } = req.body;

  try {
    if (!nama || !id_tipe) return res.status(400).json({ success: false, message: 'Data tidak lengkap' });

    // Simpan sementara
    fp.currentEnroll = { nama, id_tipe };

    // Kirim perintah enroll ke device
    fp.startEnroll();

    setTimeout(() => {
      fp.sendEnrollID(id_tipe);
    }, 500);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

//====================================================================================================================
//====================================================================================================================
//====================================================================================================================
//LOG AKSES===========================================================================================================
exports.logAkses = async (req, res) => {
    try {
        const header = {pageTitle: 'Akses User', user: req.session.user}
        const data = {
            
        }
        res.render('akses/logakses', {header: header, data: data})
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal server error')
    }
};
function formatDate(date) {
  if (!date) return '';
  return momenttz(date).tz(LOCAL_TZ).format('YYYY-MM-DD HH:mm:ss');
}
exports.logAksesAjax = async (req, res) => {
    const filters = {
        draw: req.body.draw,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        start: req.body.start,
        length: req.body.length,
        search_value: req.body.search['value'],
        order: req.body.order || []
    };
    const columnNames = [
        'nama'
    ];
    const columnSearches = req.body.columns.map((col, index) => {
        if (col.search.value && col.orderable) {
            return { column: columnNames[index], value: col.search.value }
        }
        return null
    }).filter(col => col)

    try {
        const orderColumnIndex = filters.order.length > 0 ? filters.order[0].column : null
        const orderDirection = filters.order.length > 0 ? filters.order[0].dir : 'desc'
        
        const orderColumn = orderColumnIndex !== null ? columnNames[orderColumnIndex] : 'in_time'
        
        const data = await aksesModel.inAccess(filters, orderColumn, orderDirection, columnSearches)

        const recordsFiltered = await aksesModel.inAccessFiltered(filters, columnSearches)

        const output = {
            draw: filters.draw,
            recordsTotal: await aksesModel.inAccessCountAll(),
            recordsFiltered,
            data: data.map(record => {
                return [
                    record.nama === null ? 'Unregistered' : record.nama,
                    record.data_raw,
                    record.is_success === 1 ? '✅ Sukses' : '❌ Gagal',
                    formatDate(record.in_time),
                    formatDate(record.out_time),
                ];
            })
        };

        res.json(output)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'An error occurred while fetching the data' })
    }
}