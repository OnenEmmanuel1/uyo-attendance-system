'use strict';
require('dotenv').config();
const app  = require('./app');
const port = parseInt(process.env.PORT || '3000');

const { query } = require('./config/db');

async function start() {
  await query(`CREATE TABLE IF NOT EXISTS departments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`INSERT IGNORE INTO departments (name)
    SELECT DISTINCT TRIM(department) FROM users
    WHERE department IS NOT NULL AND TRIM(department) <> ''`);
  await query(`INSERT IGNORE INTO departments (name)
    SELECT DISTINCT TRIM(department) FROM courses
    WHERE department IS NOT NULL AND TRIM(department) <> ''`);

  return app.listen(port, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║     AttendUyo — University of Uyo    ║`);
  console.log(`  ║  http://localhost:${port}               ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
  });
}

const serverPromise = start().catch((err) => {
  console.error('Application startup failed:', err.message);
  process.exitCode = 1;
});

process.on('SIGTERM', () => {
  serverPromise.then((server) => server?.close(() => process.exit(0)));
});

module.exports = serverPromise;
