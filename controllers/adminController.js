import connection from "../model/database.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';

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
    let status = req.query.status || '';

    const timezone = 'Asia/Bangkok';
    const currentTime = DateTime.now().setZone(timezone);
    const currentTimeStr = currentTime.toFormat('yyyy-MM-dd HH:mm:ss');

    try {
        let countQuery = "SELECT COUNT(*) as total FROM event WHERE 1=1";
        let queryParams = [];

        if (eventType) {
            countQuery += " AND event_type = ?";
            queryParams.push(eventType);
        }

        if (status) {
            if (status === 'complete') {
                countQuery += " AND CONCAT(endDate, ' ', endTime) < ?";
                queryParams.push(currentTimeStr);
            } else if (status === 'active') {
                countQuery += " AND CONCAT(startDate, ' ', startTime) <= ? AND CONCAT(endDate, ' ', endTime) >= ?";
                queryParams.push(currentTimeStr, currentTimeStr);
            } else if (status === 'inactive') {
                countQuery += " AND CONCAT(startDate, ' ', startTime) > ?";
                queryParams.push(currentTimeStr);
            }
        }

        const [countResults] = await connection.query(countQuery, queryParams);
        let totalEvents = countResults[0].total;

        let totalPages = Math.ceil(totalEvents / perPage);
        let offset = (currentPage - 1) * perPage;

        let eventQuery = "SELECT * FROM event WHERE 1=1";
        let eventQueryParams = [];

        if (eventType) {
            eventQuery += " AND event_type = ?";
            eventQueryParams.push(eventType);
        }

        if (status) {
            if (status === 'inactive') {
                eventQuery += " AND CONCAT(startDate, ' ', startTime) > ?";
                eventQueryParams.push(currentTimeStr);
            } else if (status === 'active') {
                eventQuery += " AND CONCAT(startDate, ' ', startTime) <= ? AND CONCAT(endDate, ' ', endTime) >= ?";
                eventQueryParams.push(currentTimeStr, currentTimeStr);
            } else if (status === 'complete') {
                eventQuery += " AND CONCAT(endDate, ' ', endTime) < ?";
                eventQueryParams.push(currentTimeStr);
            }
        }

        eventQuery += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        eventQueryParams.push(perPage, offset);


        const [eventResults] = await connection.query(eventQuery, eventQueryParams);

        // if (eventResults.length === 0) {
        //     console.warn("No events found in final query.");
        //     return res.status(404).json({ message: "No events found." });
        // }

        const eventsWithStatus = eventResults.map(event => {
            try {
                const startDate = typeof event.startDate === "string" 
                    ? event.startDate 
                    : event.startDate.toISOString(); 
        
                const endDate = typeof event.endDate === "string" 
                    ? event.endDate 
                    : event.endDate.toISOString();
        
                if (!event.startTime || typeof event.startTime !== "string" || 
                    !event.endTime || typeof event.endTime !== "string") {
                    console.error(`Invalid Start/End Time for Event ID: ${event.id}`);
                    return { ...event, status: "error" };
                }
        
                const startDateTime = DateTime.fromFormat(
                    `${startDate.split('T')[0]} ${event.startTime}`, 
                    "yyyy-MM-dd HH:mm:ss",
                    { zone: timezone }
                );
        
                const endDateTime = DateTime.fromFormat(
                    `${endDate.split('T')[0]} ${event.endTime}`, 
                    "yyyy-MM-dd HH:mm:ss",
                    { zone: timezone }
                );
        
                if (!startDateTime.isValid || !endDateTime.isValid) {
                    console.error(`Invalid DateTime for Event ID: ${event.id}`);
                    return { ...event, status: "error" };
                }
        
                let eventStatus = '';
                if (currentTime < startDateTime) {
                    eventStatus = "inactive";
                } else if (currentTime >= startDateTime && currentTime <= endDateTime) {
                    eventStatus = "active";
                } else if (currentTime > endDateTime) {
                    eventStatus = "complete";
                }
        
                console.log(`Event ID: ${event.id}, Status: ${eventStatus}`);
                return { ...event, status: eventStatus };
            } catch (error) {
                console.error(`Error processing Event ID: ${event.id}`, error);
                return { ...event, status: "error" };
            }
        });
              
        return res.status(200).json({
            meta: {
                total: totalEvents,
                per_page: perPage,
                current_page: currentPage,
                last_page: totalPages,
                first_page: 1,
                first_page_url: `/?page=1`,
                last_page_url: `/?page=${totalPages}`,
                next_page_url: currentPage < totalPages ? `/?page=${currentPage + 1}` : null,
                previous_page_url: currentPage > 1 ? `/?page=${currentPage - 1}` : null
            },
            data: eventsWithStatus,
        });
    } catch (error) {
        console.error("Error fetching events:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

export const logout = (req, res) => {
    return res.status(200).json({ message: "Logout successful. Please remove the token from the client side." });
};

//message line oa
import axios from 'axios';

export const sendLineMessage = async (req, res) => {
    const { to, messages } = req.body;
    const LineMessageurl = `https://api.line.me/v2/bot/message/push`;
    const LineToken = process.env.LINE_TOKEN;

    if (!LineToken) {
        return res.status(500).json({ message: 'Authentication token is missing!' });
    }

    try {
        const response = await axios.post(LineMessageurl, { to, messages }, {
            headers: {
                'Authorization': `Bearer ${LineToken}`,
                'Content-Type': 'application/json',
            },
        });
        return res.status(200).json({ message: 'Message sent successfully', data: response.data });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ message: 'Failed to send message' });
    }
};