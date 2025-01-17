// database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let connection;

async function connectDB() {
  try {
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('Connected to MySQL database');
  } catch (err) {
    console.error('Error connecting to MySQL database:', err);
  }
}

await connectDB();

export default connection;
