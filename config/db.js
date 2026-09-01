'use strict';
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'attenduyo_user',
  password:           process.env.DB_PASSWORD || 'AttendUyo@2024',
  database:           process.env.DB_NAME     || 'attenduyo_db',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '+00:00',
  dateStrings:        false,
});

/**
 * Execute a parameterized query.
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<[rows, fields]>}
 */
async function query(sql, params = []) {
  const [rows, fields] = await pool.execute(sql, params);
  return [rows, fields];
}

/**
 * Execute within a transaction.
 * @param {(conn) => Promise<T>} fn
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, withTransaction };
