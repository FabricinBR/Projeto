import mysql from 'mysql2/promise';

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_DATABASE,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_SSL,
  MYSQL_CONN_LIMIT = 10,
  MYSQL_QUEUE_LIMIT = 0,
  MYSQL_WAIT_FOR_CONNECTIONS = 'true',
} = process.env;

// Aiven requires SSL. If your environment fails with certificate errors,
// set ssl: { rejectUnauthorized: true } (default) or ssl: 'Amazon RDS'.
const ssl = (MYSQL_SSL || 'required').toLowerCase() === 'required'
  ? { rejectUnauthorized: true }
  : undefined;

export const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  database: MYSQL_DATABASE,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  waitForConnections: MYSQL_WAIT_FOR_CONNECTIONS === 'true',
  connectionLimit: Number(MYSQL_CONN_LIMIT),
  queueLimit: Number(MYSQL_QUEUE_LIMIT),
  ssl,
  decimalNumbers: true,
  multipleStatements: false,
  enableKeepAlive: true,
});

export async function ping() {
  const [rows] = await pool.query('SELECT 1 + 1 AS two');
  return rows[0]?.two === 2;
}
