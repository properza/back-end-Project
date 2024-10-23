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

// Middleware สำหรับตรวจสอบ JWT token
export const verifySuperAdmin = (req, res, next) => {
    // ดึง token จาก header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];  // ดึง token หลังคำว่า 'Bearer'

    if (!token) {
        return res.status(403).json({ message: 'ไม่พบ Token' });
    }

    try {
        // ตรวจสอบ token ว่าถูกต้องหรือไม่
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ตรวจสอบว่า role เป็น super_admin หรือไม่
        if (decoded.role !== 'super_admin') {
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
        }

        // บันทึกข้อมูลผู้ใช้ลงใน request object สำหรับใช้ในฟังก์ชันถัดไป
        req.user = decoded;
        next(); // อนุญาตให้ไปยังฟังก์ชันถัดไป
    } catch (err) {
        return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
    }
};

export const verifyRole = (role) => (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'ไม่พบ Token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ตรวจสอบ role จาก token ว่าตรงกับที่กำหนดหรือไม่
        if (decoded.role !== role) {
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
        }

        req.user = decoded;
        next();  // อนุญาตให้ดำเนินการต่อไป
    } catch (err) {
        return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
    }
};