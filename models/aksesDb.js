require('dotenv').config();
const knex = require('knex')({
    client: 'mysql2', // or 'mysql', 'pg', etc.
    connection: {
        host: process.env.MAINDB_HOST,
        user: process.env.MAINDB_USER,
        password: process.env.MAINDB_PASS,
        database: process.env.AKSES_DB,
        port: process.env.MAINDB_PORT
    },
});

module.exports = knex;
