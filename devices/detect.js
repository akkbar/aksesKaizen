const { exec } = require('child_process');

async function getSerialPorts() {
  return new Promise((resolve, reject) => {
    exec('npx @serialport/list -f json', (error, stdout, stderr) => {
      if (error) {
        console.error('Gagal menjalankan serialport-list:', stderr || error.message);
        return reject(new Error('Gagal mendeteksi port serial'));
      }

      try {
        const ports = JSON.parse(stdout);
        const mapped = ports.map((port, i) => ({
          index: i + 1,
          path: port.path,
          manufacturer: port.manufacturer || 'Unknown',
          vendorId: port.vendorId || 'N/A',
          productId: port.productId || 'N/A',
          serialNumber: port.serialNumber || 'N/A'
        }));
        resolve(mapped);
      } catch (parseErr) {
        console.error('Gagal parsing output serialport-list:', parseErr);
        reject(new Error('Output serialport-list tidak valid'));
      }
    });
  });
}

module.exports = { getSerialPorts };
