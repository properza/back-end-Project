import connection from "../model/database.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const adminLogin = async (req, res) => {
    const { username, password } = req.body;

    try {
        if (!JWT_SECRET) {
            console.error('JWT_SECRET is not defined in the environment variables');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        if (!username || !password) {
            return res.status(400).json({ message: 'กรุณากรอก Username และ Password' });
        }

        console.log('Received Username:', username);

        const [rows] = await connection.query('SELECT * FROM admins WHERE username = ?', [username]);

        console.log('Query Result:', rows);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: 'Username ไม่ถูกต้อง' });
        }

        const admin = rows[0];
        console.log('Admin Data:', admin);

        const passwordIsValid = await bcrypt.compare(password, admin.password);

        if (!passwordIsValid) {
            return res.status(400).json({ message: 'Password ไม่ถูกต้อง' });
        }

        const token = jwt.sign(
            { id: admin.id, role: admin.role },
            JWT_SECRET,  
            { expiresIn: 86400 }
        );

        res.status(200).json({
            adminID: admin.id,
            username: admin.username,
            firstname: admin.firstname,
            lastname: admin.lastname,
            role: admin.role,
            token: token
        });

    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

export const getAdminData = async (req, res) => {
    try {
        const adminId = req.user.id;

        const [rows] = await connection.query('SELECT * FROM admins WHERE id = ?', [adminId]);

        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const admin = rows[0];
        
        res.status(200).json({
            adminID: admin.id,
            username: admin.username,
            firstname: admin.firstname,
            lastname: admin.lastname,
            role: admin.role
        });
    } catch (err) {
        console.error('Error fetching admin data:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const createAdmin = async (req, res) => {
    const { username, password, firstname, lastname, role } = req.body;

    if (!['super_admin', 'special', 'normal', 'global'].includes(role)) {
        return res.status(400).json({ message: 'role ไม่ถูกต้อง' });
    }

    try {
        if (!username || !password || !firstname || !lastname || !role) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        const hashedPassword = await bcrypt.hash(password, 8);

        const [result] = await connection.execute(
            'INSERT INTO admins (username, password, firstname, lastname, role) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, firstname, lastname, role]
        );

        console.log('Insert Result:', result);

        res.status(201).json({ message: `สร้าง admin ${role} สำเร็จแล้ว` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

export const createEvent = async (req, res) => {
    const {
        activityName,
        course,
        startDate,
        endDate,
        startTime,
        endTime,
        Nameplace,
        latitude,
        longitude,
        province,
        admin_id,
        event_type
    } = req.body;

    try {
        const [adminCheck] = await connection.query('SELECT * FROM admins WHERE id = ?', [admin_id]);
        if (adminCheck.length === 0) {
            return res.status(400).json({ message: 'Invalid admin' });
        }

        const admin_role = adminCheck[0].role;

        if (!['special', 'normal'].includes(event_type)) {
            return res.status(400).json({ message: 'Invalid event type. Must be either "special" or "normal".' });
        }

        const [result] = await connection.query(
            'INSERT INTO event (activityName, course, startDate, endDate, startTime, endTime, Nameplace, latitude, longitude, province, admin_id,  event_type) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [activityName, course, startDate, endDate, startTime, endTime, Nameplace, latitude, longitude, province, admin_id, event_type]
        );

        res.status(201).json({ message: 'Event created successfully', eventId: result.insertId });
    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getAllEvents = async (req, res) => {
    let currentPage = parseInt(req.query.page) || 1;
    let perPage = parseInt(req.query.per_page) || 10;
    let eventType = req.query.event_type || '';
    let status = req.query.status || ''; // รับค่า status จาก query parameters

    // กำหนดเวลาปัจจุบัน
    const currentTime = new Date();

    try {
        let countQuery = "SELECT COUNT(*) as total FROM event WHERE 1=1";
        let queryParams = [];

        if (eventType) {
            countQuery += " AND event_type = ?";
            queryParams.push(eventType);
        }

        const [countResults] = await connection.query(countQuery, queryParams);
        let totalEvents = countResults[0].total;
        let totalPages = Math.ceil(totalEvents / perPage);
        let offset = (currentPage - 1) * perPage;

        let eventQuery = "SELECT * FROM event WHERE 1=1";
        queryParams = []; // รีเซ็ต queryParams สำหรับการดึงข้อมูลจริง

        if (eventType) {
            eventQuery += " AND event_type = ?";
            queryParams.push(eventType);
        }

        eventQuery += " LIMIT ? OFFSET ?";
        queryParams.push(perPage, offset);

        const [eventResults] = await connection.query(eventQuery, queryParams);

        // เพิ่ม status ในแต่ละกิจกรรม
        const eventsWithStatus = eventResults.map(event => {
            const startDate = new Date(`${event.startDate}T${event.startTime}`);
            const endDate = new Date(`${event.endDate}T${event.endTime}`);
            let eventStatus = '';

            if (currentTime < startDate) {
                eventStatus = "upcoming"; // ยังไม่ถึงเวลาเริ่ม
            } else if (currentTime >= startDate && currentTime <= endDate) {
                eventStatus = "starting"; // กำลังอยู่ในช่วงเวลากิจกรรม
            } else {
                eventStatus = "ending"; // กิจกรรมสิ้นสุดแล้ว
            }

            return {
                ...event,
                status: eventStatus
            };
        });

        const meta = {
            total: totalEvents,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages,
            first_page: 1,
            first_page_url: `/?page=1`,
            last_page_url: `/?page=${totalPages}`,
            next_page_url: currentPage < totalPages ? `/?page=${currentPage + 1}` : null,
            previous_page_url: currentPage > 1 ? `/?page=${currentPage - 1}` : null
        };

        return res.status(200).json({
            meta: meta,
            data: eventsWithStatus
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send("Internal server error");
    }
};

export const logout = (req, res) => {
    return res.status(200).json({ message: "Logout successful. Please remove the token from the client side." });
};