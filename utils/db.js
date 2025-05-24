const mysql = require('mysql2/promise');


const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'javi1004',
  waitForConnections: true,
  connectionLimit: 0,
  queueLimit: 0
});

module.exports = pool;
