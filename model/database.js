// model/database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let connection;

// ฟังก์ชันสำหรับการเชื่อมต่อฐานข้อมูล
async function connectToDatabase() {
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            // เพิ่มการตั้งค่าอื่นๆ ตามต้องการ
        });
        console.log('Connected to MySQL database');
    } catch (err) {
        console.error('Error connecting to MySQL database:', err);
        // ลองเชื่อมต่อใหม่หลังจากเวลาหน่วง (เช่น 2 วินาที)
        setTimeout(connectToDatabase, 2000);
    }
}

// เรียกใช้ฟังก์ชันเชื่อมต่อเมื่อเริ่มต้น
connectToDatabase();

export default connection;
