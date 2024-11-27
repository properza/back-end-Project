import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware JWT token
export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ message: 'ไม่พบ Token' });
    }

    try {
        const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
        req.user = decoded;  // เก็บข้อมูลที่ decode ได้ใน request เพื่อใช้งานในฟังก์ชันถัดไป
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
    }
};

// ตรวจสอบ JWT token
export const verifySuperAdmin = (req, res, next) => {
    // ดึงข้อมูลจาก header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];  // ดึง token หลังคำว่า 'Bearer'

    if (!token) {
        return res.status(403).json({ message: 'ไม่พบ Token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.role !== 'super_admin') {
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
        }

        req.user = decoded;
        next();
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

        if (decoded.role !== role) {
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
    }
};