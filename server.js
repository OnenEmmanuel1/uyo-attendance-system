'use strict';
require('dotenv').config();
const app  = require('./app');
const port = parseInt(process.env.PORT || '3000');

const server = app.listen(port, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║     AttendUyo — University of Uyo    ║`);
  console.log(`  ║  http://localhost:${port}               ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

module.exports = server;
