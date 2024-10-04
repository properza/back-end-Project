import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

// const connection = mysql.createConnection({
//     host: process.env.DB_HOST || 'localhost',
//     user: process.env.DB_USER || 'root',
//     password: process.env.DB_PASSWORD || '',
//     database: process.env.DB_DATABASE || 'project_db'
// });

const connection = mysql.createConnection({
    host: 'db',
    user: 'backendProject',
    password: 'P@ssword312',
    database: 'project_db'
  });

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

export default connection;
