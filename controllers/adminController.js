import pool from "../model/database.js";
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

        //console.log('Received Username:', username);

        const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);

        //console.log('Query Result:', rows);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: 'Username ไม่ถูกต้อง' });
        }

        const admin = rows[0];
        //console.log('Admin Data:', admin);

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

        const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [adminId]);

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

        const [result] = await pool.execute(
            'INSERT INTO admins (username, password, firstname, lastname, role) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, firstname, lastname, role]
        );

        //console.log('Insert Result:', result);

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
        const [adminCheck] = await pool.query('SELECT * FROM admins WHERE id = ?', [admin_id]);
        if (adminCheck.length === 0) {
            return res.status(400).json({ message: 'Invalid admin' });
        }

        const admin_role = adminCheck[0].role;

        if (!['special', 'normal'].includes(event_type)) {
            return res.status(400).json({ message: 'Invalid event type. Must be either "special" or "normal".' });
        }

        const [result] = await pool.query(
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
    let showBefore = req.query.before === 'true';

    const timezone = 'Asia/Bangkok';
    const currentTime = DateTime.now().setZone(timezone);
    const currentTimeStr = currentTime.toFormat('yyyy-MM-dd HH:mm:ss');

    try {
        let countQuery = "SELECT COUNT(*) as total FROM event WHERE 1=1";
        let queryParams = [];

        // กรณี event_type
        if (eventType) {
            countQuery += " AND event_type = ?";
            queryParams.push(eventType);
        }

        // ถ้ามี before => ให้ข้าม status แล้วใช้เงื่อนไข before
        if (showBefore) {
            // แสดงเฉพาะอีเวนต์ที่ end >= now => ไม่จบ
            countQuery += " AND CONCAT(endDate, ' ', endTime) >= ?";
            queryParams.push(currentTimeStr);
        } 
        else {
            // ถ้าไม่มี before => ใช้เงื่อนไข status ปกติ
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
        }

        const [countResults] = await pool.query(countQuery, queryParams);
        let totalEvents = countResults[0].total;

        let totalPages = Math.ceil(totalEvents / perPage);
        let offset = (currentPage - 1) * perPage;

        let eventQuery = "SELECT * FROM event WHERE 1=1";
        let eventQueryParams = [];

        if (eventType) {
            eventQuery += " AND event_type = ?";
            eventQueryParams.push(eventType);
        }

        if (showBefore) {
            // แสดงเฉพาะอีเวนต์ที่ end >= now (ไม่จบ)
            eventQuery += " AND CONCAT(endDate, ' ', endTime) >= ?";
            eventQueryParams.push(currentTimeStr);
        }
        else {
            // ใช้ status ปกติ
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
        }

        // เรียงลำดับและแบ่งหน้า
        eventQuery += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        eventQueryParams.push(perPage, offset);

        const [eventResults] = await pool.query(eventQuery, eventQueryParams);
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

// controllers/adminController.js

export const createReward = async (req, res) => {
    const { reward_name, points_required, amount, can_redeem } = req.body;

    // ตรวจสอบว่าไฟล์มีการอัปโหลดหรือไม่
    let fileUrls = [];
    if (req.files && req.files.length > 0) {
        // รับลิงก์ไฟล์จากการอัปโหลด
        fileUrls = req.files.map(file => file.location);
    }

    try {
        // เพิ่มข้อมูลรางวัลใหม่ลงในตาราง rewards
        const [result] = await pool.execute(
            'INSERT INTO rewards (reward_name, points_required, amount, can_redeem, rewardUrl) VALUES (?, ?, ?, ?, ?)',
            [reward_name, points_required, amount, can_redeem !== undefined ? can_redeem : true, JSON.stringify(fileUrls)]
        );

        res.status(201).json({
            message: 'สร้างรางวัลสำเร็จแล้ว',
            reward: {
                id: result.insertId,
                reward_name,
                points_required,
                amount,
                can_redeem: can_redeem !== undefined ? can_redeem : true,
                rewardUrl: fileUrls,
                created_at: new Date()
            }
        });
    } catch (err) {
        console.error('Error creating reward:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างรางวัล' });
    }
};


export const getAllRewards = async (req, res) => {
    let currentPage = parseInt(req.query.page) || 1;
    let perPage = parseInt(req.query.per_page) || 10;
    let canRedeem = req.query.can_redeem; // ตัวกรองเพิ่มเติม (ถ้ามี)

    try {
        let countQuery = "SELECT COUNT(*) as total FROM rewards WHERE 1=1";
        let queryParams = [];

        // ตัวกรองเพิ่มเติมถ้ามี
        if (canRedeem !== undefined) {
            countQuery += " AND can_redeem = ?";
            queryParams.push(canRedeem === 'true' ? 1 : 0);
        }

        const [countResults] = await pool.query(countQuery, queryParams);
        let totalRewards = countResults[0].total;

        let totalPages = Math.ceil(totalRewards / perPage);
        let offset = (currentPage - 1) * perPage;

        let rewardQuery = "SELECT * FROM rewards WHERE 1=1";
        let rewardQueryParams = [];

        if (canRedeem !== undefined) {
            rewardQuery += " AND can_redeem = ?";
            rewardQueryParams.push(canRedeem === 'true' ? 1 : 0);
        }

        rewardQuery += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        rewardQueryParams.push(perPage, offset);

        const [rewardResults] = await pool.query(rewardQuery, rewardQueryParams);

        return res.status(200).json({
            meta: {
                total: totalRewards,
                per_page: perPage,
                current_page: currentPage,
                last_page: totalPages,
                first_page: 1,
                first_page_url: `/?page=1`,
                last_page_url: `/?page=${totalPages}`,
                next_page_url: currentPage < totalPages ? `/?page=${currentPage + 1}` : null,
                previous_page_url: currentPage > 1 ? `/?page=${currentPage - 1}` : null
            },
            data: rewardResults,
        });
    } catch (error) {
        console.error("Error fetching rewards:", error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
};

export const updateReward = async (req, res) => {
    const { reward_id } = req.params;
    const { reward_name, points_required, amount, can_redeem, rewardUrl } = req.body;

    const id = parseInt(reward_id);
    if (isNaN(id) || id < 1) {
        return res.status(400).json({ message: 'reward_id ต้องเป็นจำนวนเต็มที่ถูกต้อง' });
    }

    // ตรวจสอบว่ามีฟิลด์ที่จะอัปเดต
    if (!reward_name && points_required === undefined && amount === undefined && can_redeem === undefined && !rewardUrl) {
        return res.status(400).json({ message: 'ต้องการข้อมูลอย่างน้อยหนึ่งฟิลด์เพื่อการแก้ไข' });
    }

    // ตรวจสอบประเภทข้อมูลแบบแมนนวล
    if (reward_name && typeof reward_name !== 'string') {
        return res.status(400).json({ message: 'reward_name ต้องเป็นสตริง' });
    }

    if (points_required !== undefined && (typeof points_required !== 'number' || points_required < 0)) {
        return res.status(400).json({ message: 'points_required ต้องเป็นจำนวนเต็มที่ไม่ติดลบ' });
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
        return res.status(400).json({ message: 'amount ต้องเป็นจำนวนเต็มที่ไม่ติดลบ' });
    }

    if (can_redeem !== undefined && typeof can_redeem !== 'boolean') {
        return res.status(400).json({ message: 'can_redeem ต้องเป็นบูลีน' });
    }

    if (rewardUrl !== undefined && typeof rewardUrl !== 'string') {
        return res.status(400).json({ message: 'rewardUrl ต้องเป็นสตริงที่เป็น URL' });
    }

    try {
        // ตรวจสอบว่ารางวัลมีอยู่จริง
        const [existingReward] = await pool.query('SELECT * FROM rewards WHERE id = ?', [id]);
        if (!existingReward || existingReward.length === 0) {
            return res.status(404).json({ message: 'ไม่พบรางวัลที่ต้องการแก้ไข' });
        }

        // สร้างคำสั่ง UPDATE แบบไดนามิก
        let updateFields = [];
        let queryParams = [];

        if (reward_name) {
            updateFields.push('reward_name = ?');
            queryParams.push(reward_name);
        }
        if (points_required !== undefined) {
            updateFields.push('points_required = ?');
            queryParams.push(points_required);
        }
        if (amount !== undefined) {
            updateFields.push('amount = ?');
            queryParams.push(amount);
        }
        if (can_redeem !== undefined) {
            updateFields.push('can_redeem = ?');
            queryParams.push(can_redeem ? 1 : 0);
        }
        if (rewardUrl !== undefined) {
            updateFields.push('rewardUrl = ?');
            queryParams.push(rewardUrl);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'ไม่มีฟิลด์ที่จะทำการแก้ไข' });
        }

        const updateQuery = `UPDATE rewards SET ${updateFields.join(', ')} WHERE id = ?`;
        queryParams.push(id);

        const [result] = await pool.execute(updateQuery, queryParams);

        res.status(200).json({
            message: 'แก้ไขรางวัลสำเร็จแล้ว',
            affectedRows: result.affectedRows
        });
    } catch (err) {
        console.error('Error updating reward:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขรางวัล' });
    }
};

export const deleteReward = async (req, res) => {
    const { reward_id } = req.params;

    const id = parseInt(reward_id);
    if (isNaN(id) || id < 1) {
        return res.status(400).json({ message: 'reward_id ต้องเป็นจำนวนเต็มที่ถูกต้อง' });
    }

    try {
        // ตรวจสอบว่ารางวัลมีอยู่จริง
        const [existingReward] = await pool.query('SELECT * FROM rewards WHERE id = ?', [id]);
        if (!existingReward || existingReward.length === 0) {
            return res.status(404).json({ message: 'ไม่พบรางวัลที่ต้องการลบ' });
        }

        // ลบรางวัล
        const [result] = await pool.execute('DELETE FROM rewards WHERE id = ?', [id]);

        res.status(200).json({
            message: 'ลบรางวัลสำเร็จแล้ว',
            affectedRows: result.affectedRows
        });
    } catch (err) {
        console.error('Error deleting reward:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบรางวัล' });
    }
};

//all admin 
export const getAdmins = async (req, res) => {
    const { page = 1, per_page = 10 } = req.query; // รับค่าหน้าและจำนวนต่อหน้า
    const parsedPage = parseInt(page);
    const parsedPerPage = parseInt(per_page);

    // ตรวจสอบความถูกต้องของค่า page และ per_page
    if (isNaN(parsedPage) || parsedPage < 1) {
        return res.status(400).json({ message: 'Invalid page number' });
    }

    if (isNaN(parsedPerPage) || parsedPerPage < 1) {
        return res.status(400).json({ message: 'Invalid per_page number' });
    }

    const offset = (parsedPage - 1) * parsedPerPage;

    try {
        // คำนวณจำนวนทั้งหมดของแอดมินที่ไม่ใช่ super_admin
        const countQuery = "SELECT COUNT(*) AS total FROM admins WHERE role != ?";
        const [countResults] = await pool.query(countQuery, ['super_admin']);
        const totalAdmins = countResults[0].total;
        const totalPages = Math.ceil(totalAdmins / parsedPerPage);

        // ดึงข้อมูลแอดมินที่ไม่ใช่ super_admin ตามหน้าและจำนวนต่อหน้า
        const adminsQuery = `
            SELECT id, username, firstname, lastname, role 
            FROM admins 
            WHERE role != ? 
            ORDER BY id DESC 
            LIMIT ? OFFSET ?
        `;
        const [admins] = await pool.query(adminsQuery, ['super_admin', parsedPerPage, offset]);

        // สร้างข้อมูล meta สำหรับการแบ่งหน้า
        const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
        const constructUrl = (page) => {
            const params = new URLSearchParams(req.query);
            params.set('page', page);
            return `${baseUrl}?${params.toString()}`;
        };

        const meta = {
            total: totalAdmins,
            per_page: parsedPerPage,
            current_page: parsedPage,
            last_page: totalPages,
            first_page: 1,
            first_page_url: `/?page=1`,
            last_page_url: `/?page=${totalPages}`,
            next_page_url: parsedPage < totalPages ? constructUrl(parsedPage + 1) : null,
            previous_page_url: parsedPage > 1 ? constructUrl(parsedPage - 1) : null
        };

        res.status(200).json({
            meta: meta,
            data: admins
        });

    } catch (err) {
        console.error('Error fetching non-super_admins:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลแอดมิน' });
    }
};

export const updateAdmin = async (req, res) => {
    const { adminId } = req.params;
    const { username, password, firstname, lastname } = req.body;

    // ตรวจสอบว่า adminId เป็นตัวเลขและมีค่ามากกว่า 0
    const id = parseInt(adminId);
    if (isNaN(id) || id < 1) {
        return res.status(400).json({ message: 'adminId ต้องเป็นจำนวนเต็มที่ถูกต้อง' });
    }

    // ตรวจสอบว่ามีข้อมูลที่จะอัปเดต
    if (!username && !password && !firstname && !lastname) {
        return res.status(400).json({ message: 'ต้องการข้อมูลอย่างน้อยหนึ่งฟิลด์เพื่อการอัปเดต' });
    }

    try {
        // ตรวจสอบว่ามีแอดมินที่ต้องการอัปเดตอยู่จริง
        const [existingAdmin] = await pool.query('SELECT * FROM admins WHERE id = ?', [id]);
        if (!existingAdmin || existingAdmin.length === 0) {
            return res.status(404).json({ message: 'ไม่พบแอดมินที่ต้องการอัปเดต' });
        }

        // ถ้ามีการอัปเดต username ให้ตรวจสอบว่าไม่มีแอดมินอื่นที่มี username เดียวกัน
        if (username) {
            const [usernameCheck] = await pool.query('SELECT * FROM admins WHERE username = ? AND id != ?', [username, id]);
            if (usernameCheck.length > 0) {
                return res.status(400).json({ message: 'username นี้ถูกใช้แล้ว' });
            }
        }

        // เตรียมข้อมูลสำหรับการอัปเดต
        let updateFields = [];
        let queryParams = [];

        if (username) {
            updateFields.push('username = ?');
            queryParams.push(username);
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 8);
            updateFields.push('password = ?');
            queryParams.push(hashedPassword);
        }
        if (firstname) {
            updateFields.push('firstname = ?');
            queryParams.push(firstname);
        }
        if (lastname) {
            updateFields.push('lastname = ?');
            queryParams.push(lastname);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'ไม่มีฟิลด์ที่จะทำการอัปเดต' });
        }

        const updateQuery = `UPDATE admins SET ${updateFields.join(', ')} WHERE id = ?`;
        queryParams.push(id);

        const [result] = await pool.execute(updateQuery, queryParams);

        res.status(200).json({
            message: 'อัปเดตแอดมินสำเร็จแล้ว',
            affectedRows: result.affectedRows
        });

    } catch (err) {
        console.error('Error updating admin:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตแอดมิน' });
    }
};

export const deleteAdmin = async (req, res) => {
    const { adminId } = req.params;

    // ตรวจสอบว่า adminId เป็นตัวเลขและมีค่ามากกว่า 0
    const id = parseInt(adminId);
    if (isNaN(id) || id < 1) {
        return res.status(400).json({ message: 'adminId ต้องเป็นจำนวนเต็มที่ถูกต้อง' });
    }

    try {
        // ตรวจสอบว่ามีแอดมินที่ต้องการลบอยู่จริง
        const [existingAdmin] = await pool.query('SELECT * FROM admins WHERE id = ?', [id]);
        if (!existingAdmin || existingAdmin.length === 0) {
            return res.status(404).json({ message: 'ไม่พบแอดมินที่ต้องการลบ' });
        }

        const admin = existingAdmin[0];

        // ไม่อนุญาตให้ลบแอดมินที่เป็น super_admin
        if (admin.role === 'super_admin') {
            return res.status(403).json({ message: 'ไม่สามารถลบแอดมินที่เป็น super_admin ได้' });
        }

        // ตรวจสอบว่ามีแอดมินอื่นที่เป็น super_admin อยู่เสมอ
        const [superAdmins] = await pool.query('SELECT * FROM admins WHERE role = ?', ['super_admin']);
        if (superAdmins.length === 0) {
            return res.status(400).json({ message: 'ต้องมีแอดมินที่เป็น super_admin อย่างน้อยหนึ่งคนเสมอ' });
        }

        // ลบแอดมิน
        const [result] = await pool.execute('DELETE FROM admins WHERE id = ?', [id]);

        res.status(200).json({
            message: 'ลบแอดมินสำเร็จแล้ว',
            affectedRows: result.affectedRows
        });

    } catch (err) {
        console.error('Error deleting admin:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบแอดมิน' });
    }
};