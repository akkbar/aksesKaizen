// C:\cctv\akses\db.js
const mysql = require('mysql2/promise');

let pool;

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: +(process.env.DB_PORT || 3311),
  user: process.env.DB_USER || 'openaiotadmin',
  password: process.env.DB_PASS || 'OpenAIoT-mysql-password',
  database: process.env.DB_NAME || 'akses',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,       // jaga socket tetap hidup
  keepAliveInitialDelay: 0
};

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function initDb(){
  // loop sampai DB siap
  while (true) {
    try {
      pool = mysql.createPool(cfg);
      await pool.query('SELECT 1'); // test
      console.log('[DB] ready');
      return pool;
    } catch (e) {
      console.error('[DB] not ready:', e.code || e.message);
      await sleep(3000);
    }
  }
}

// wrapper query dengan retry saat fatal error
async function query(sql, params){
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (e) {
    if (e && (e.fatal || e.code === 'PROTOCOL_CONNECTION_LOST')) {
      console.warn('[DB] fatal error, reinit…', e.code);
      await initDb();                 // buat pool baru
      const [rows] = await pool.execute(sql, params); // retry sekali
      return rows;
    }
    throw e;
  }
}

function getPool(){ return pool; }

module.exports = { initDb, query, getPool };
