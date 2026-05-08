const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const [dbServer, dbInstanceName] = (process.env.DB_SERVER || '').split('\\');
const hasExplicitPort = !!process.env.DB_PORT;

const config = {
    server: dbServer || process.env.DB_SERVER,
    port: hasExplicitPort ? parseInt(process.env.DB_PORT, 10) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        instanceName: hasExplicitPort ? undefined : (dbInstanceName || undefined),
        encrypt: false,
        trustServerCertificate: true
    }
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();
const poolPromise = poolConnect;

module.exports = { pool, poolConnect, poolPromise, sql };