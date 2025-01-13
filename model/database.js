// model/database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

//pool connection
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // ปรับตามความต้องการ
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: true
  }
});

// ทดสอบการเชื่อมต่อ
connection.getConnection()
  .then(conn => {
    console.log('Connected to MySQL database');
    conn.release();
  })
  .catch(err => {
    console.error('Error connecting to MySQL database:', err);
  });

export default connection;
