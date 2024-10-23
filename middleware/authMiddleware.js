import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config(); // โหลดค่า .env

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware สำหรับตรวจสอบ JWT token
export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ message: 'ไม่พบ Token' });
    }

    try {
        // ตรวจสอบและยืนยัน token
        const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET); // เอา Bearer ออกแล้วตรวจสอบ token
        req.user = decoded;  // เก็บข้อมูลที่ decode ได้ใน request เพื่อใช้งานในฟังก์ชันถัดไป
        next();  // ไปยังฟังก์ชันถัดไป
    } catch (err) {
        return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
    }
};
