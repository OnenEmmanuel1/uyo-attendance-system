'use strict';
/**
 * scripts/initDb.js
 * Run this script once to initialize the database schema and seed data.
 * Usage: node scripts/initDb.js
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number.parseInt(process.env.DB_PORT || '3306', 10);
  const database = process.env.DB_NAME || 'attenduyo_db';
  const user = process.env.DB_USER || 'attenduyo_user';
  const password = process.env.DB_PASSWORD || 'AttendUyo@2024';
  const adminUser = process.env.DB_ADMIN_USER || 'root';

  // Creating a database account requires a MySQL administrator connection.
  // Keep these credentials separate from the app's restricted DB_USER.
  const admin = await mysql.createConnection({
    host:              process.env.DB_HOST     || 'localhost',
    port,
    user: adminUser,
    password: process.env.DB_ADMIN_PASSWORD || '',
  });

  const dbId = admin.escapeId(database);
  const userName = admin.escape(user);
  const appPassword = admin.escape(password);
  await admin.query(`CREATE DATABASE IF NOT EXISTS ${dbId}`);
  await admin.query(
    `CREATE USER IF NOT EXISTS ${userName}@'localhost' IDENTIFIED BY ${appPassword}`
  );
  await admin.query(
    `ALTER USER ${userName}@'localhost' IDENTIFIED BY ${appPassword}`
  );
  await admin.query(
    `GRANT ALL PRIVILEGES ON ${dbId}.* TO ${userName}@'localhost'`
  );
  await admin.end();

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  console.log('Connected to MySQL; database and app account are ready.');

  const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  const seed   = fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8');

  console.log('Running schema.sql…');
  await conn.query(schema);
  console.log('✓ Schema applied.');

  console.log('Running seed.sql…');
  await conn.query(seed);
  console.log('✓ Seed data inserted.');

  await conn.end();
  console.log('\nDatabase initialized successfully!');
  console.log('\nTest credentials (password: password123):');
  console.log('  Admin:    admin@uniuyo.edu.ng            / password123');
  console.log('  Lecturer: b.okon@uniuyo.edu.ng           / password123');
  console.log('  Student:  a.umoh@students.uniuyo.edu.ng  / password123');
}

main().catch(err => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});
