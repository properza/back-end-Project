import pool from "../model/database.js";
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createOrLoginCustomer = async (req, res) => {
    const { customer_id, name, picture } = req.body;

    if (!customer_id || !name || !picture) {
        return res.status(400).json({ message: 'กรุณากรอก customer_id, name และ picture ให้ครบถ้วน' });
    }

    try {
        const [results] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (results.length === 0) {
            // กรณีลูกค้าใหม่
            const [insertResults] = await pool.query(
                "INSERT INTO customerinfo (customer_id, name, picture) VALUES (?, ?, ?)",
                [customer_id, name, picture]
            );

            console.log("Insert results:", insertResults); // เพิ่มการตรวจสอบ
            if (insertResults.affectedRows === 0) {
                return res.status(500).json({ message: 'ไม่สามารถสร้างข้อมูลลูกค้าใหม่ได้' });
            }

            const [totalScoresResults] = await pool.query(
                `SELECT SUM(scores_earn) AS total_scores
                 FROM special_cl
                 WHERE customer_id = ? AND status = 'อนุมัติ'`,
                [customer_id]
            );

            const totalScores = totalScoresResults[0].total_scores || 0;

            const [updateResults] = await pool.query(
                `UPDATE customerinfo
                 SET total_hour = ?
                 WHERE customer_id = ?`,
                [totalScores, customer_id]
            );

            console.log("Update results:", updateResults); // เพิ่มการตรวจสอบ
            if (updateResults.affectedRows === 0) {
                return res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลลูกค้า' });
            }

            const [newUserResults] = await pool.query(
                "SELECT * FROM customerinfo WHERE id = ?",
                [insertResults.insertId]
            );

            return res.status(201).json({
                message: "Customer info created",
                user: newUserResults[0],
            });
        } else {
            // กรณีที่ลูกค้าเข้าสู่ระบบ
            const customer_id = results[0].customer_id;

            const [totalScoresResults] = await pool.query(
                `SELECT SUM(scores_earn) AS total_scores
                 FROM special_cl
                 WHERE customer_id = ? AND status = 'อนุมัติ'`,
                [customer_id]
            );

            const totalScores = totalScoresResults[0].total_scores || 0;

            const [updateResults] = await pool.query(
                `UPDATE customerinfo
                 SET total_hour = ?
                 WHERE customer_id = ?`,
                [totalScores, customer_id]
            );

            return res.status(200).json({
                message: "Login successful",
                user: results[0],
            });
        }
    } catch (err) {
        console.error("Database Error:", err); // เพิ่มการแสดง error ที่ชัดเจน
        return res.status(500).send("Internal server error");
    }
};



export const createEventInCloud = async (req, res) => {
    const { event_name, customer_id } = req.body;

    if (!customer_id) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
    }

    if (!event_name) {
        return res.status(400).json({ message: 'กรุณาระบุชื่อกิจกรรม' });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพ' });
    }

    const imageUrls = req.files.map(file => file.location);

    try {
        const [customerResults] = await pool.query(
            "SELECT first_name, last_name FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (customerResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลลูกค้า" });
        }

        const { first_name, last_name } = customerResults[0];

        await pool.query(
            "INSERT INTO cloud (event_name, images, customer_id, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
            [event_name, JSON.stringify(imageUrls), customer_id, first_name, last_name]
        );

        return res.status(201).json({
            message: "เพิ่มกิจกรรมและรูปภาพลงใน cloud สำเร็จ",
            event_name: event_name,
            images: imageUrls,
        });

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการเพิ่มกิจกรรม:", err);
        return res.status(500).json({ message: 'ข้อผิดพลาดภายในเซิร์ฟเวอร์', error: err.message });
    }
};

export const getScores = async (req, res) => {
    try {
        const [scores] = await pool.query("SELECT * FROM scores");

        if (scores.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลคะแนน" });
        }

        return res.status(200).json({
            data: scores
        });
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลคะแนน:", err);
        return res.status(500).json({ message: 'ข้อผิดพลาดภายในเซิร์ฟเวอร์', error: err.message });
    }
};


export const createSpecialEvent = async (req, res) => {
    const { event_name, customer_id, scores_id } = req.body;

    if (!customer_id) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
    }

    if (!event_name) {
        return res.status(400).json({ message: 'กรุณาระบุชื่อกิจกรรม' });
    }

    if (!scores_id) {
        return res.status(400).json({ message: 'กรุณาระบุ scores_id' });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพ' });
    }

    const imageUrls = req.files.map(file => file.location);

    try {
        const [customerResults] = await pool.query(
            "SELECT first_name, last_name FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (customerResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลลูกค้า" });
        }

        const { first_name, last_name } = customerResults[0];
        const name = `${first_name} ${last_name}`;

        const [scoresResults] = await pool.query(
            "SELECT score, type, times FROM scores WHERE id = ?",
            [scores_id]
        );

        if (scoresResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลสำหรับ scores_id" });
        }

        const { score, type, times } = scoresResults[0];

        if (scores_id === 1 || scores_id === 2) {
            const [specialClCount] = await pool.query(
                "SELECT scores_id, COUNT(*) AS count FROM special_cl WHERE scores_id IN (1, 2) GROUP BY scores_id"
            );

            let count1 = 0;
            let count2 = 0;

            specialClCount.forEach(row => {
                if (row.scores_id === 1) {
                    count1 = row.count;
                } else if (row.scores_id === 2) {
                    count2 = row.count;
                }
            });

            if ((count1 + 1) > times || (count2 + 1) > times || (count1 + count2 + 1) > (times + times)) {
                return res.status(400).json({ message: `ไม่สามารถเพิ่มกิจกรรมใหม่ได้ เนื่องจากจำนวนกิจกรรมที่มีคะแนนนี้ถึงขีดจำกัดที่ ${times} ครั้งแล้ว` });
            }
        } else {
            const [specialClCount] = await pool.query(
                "SELECT COUNT(*) AS count FROM special_cl WHERE scores_id = ?",
                [scores_id]
            );

            const count = specialClCount[0].count;

            if (count >= times) {
                return res.status(400).json({ message: `ไม่สามารถเพิ่มกิจกรรมใหม่ได้ เนื่องจากจำนวนกิจกรรมที่มีคะแนนนี้ถึงขีดจำกัดที่ ${times} ครั้งแล้ว` });
            }
        }

        const scores_earn = score;
        const scores_type = type;

        await pool.query(
            "INSERT INTO special_cl (event_name, customer_id, name, scores_id, images, scores_earn, scores_type, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [event_name, customer_id, name, scores_id, JSON.stringify(imageUrls), scores_earn, scores_type, 'รอดำเนินการ']
        );

        return res.status(201).json({
            message: "เพิ่มกิจกรรมและรูปภาพลงในระบบสำเร็จ",
            event_name: event_name,
            images: imageUrls,
            customer_name: name,
            scores_earn: scores_earn,
            scores_type: scores_type
        });

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการเพิ่มกิจกรรม:", err);
        return res.status(500).json({ message: 'ข้อผิดพลาดภายในเซิร์ฟเวอร์', error: err.message });
    }
};

export const getSpecialEventsByCustomerId = async (req, res) => {
    const { customer_id } = req.params;
    const { page = 1, per_page = 10 } = req.query;

    if (!customer_id) {
        return res.status(400).json({ message: 'กรุณาระบุ customer_id' });
    }

    try {
        const offset = (page - 1) * per_page;

        const limit = parseInt(per_page, 10);
        const offsetValue = parseInt(offset, 10);

        // คิวรีข้อมูลกิจกรรม
        const [events] = await pool.query(
            "SELECT * FROM special_cl WHERE customer_id = ? LIMIT ? OFFSET ?",
            [customer_id, limit, offsetValue]
        );

        // คิวรีการนับจำนวนทั้งหมด
        const [totalCountResults] = await pool.query(
            "SELECT COUNT(*) AS total FROM special_cl WHERE customer_id = ?",
            [customer_id]
        );

        const totalRecords = totalCountResults[0].total;
        const totalPages = Math.ceil(totalRecords / limit); // ใช้ limit แทน per_page

        // คิวรีการคำนวณคะแนนรวม
        const [totalScoreResults] = await pool.query(
            "SELECT SUM(scores_earn) AS total_score FROM special_cl WHERE customer_id = ? AND status = 'อนุมัติ'",
            [customer_id]
        );

        const totalScore = totalScoreResults[0].total_score || 0;

        // สร้าง URL สำหรับการแบ่งหน้า
        const constructUrl = (page) => {
            return `${req.protocol}://${req.get('host')}${req.baseUrl}/special-events/${customer_id}?page=${page}&per_page=${limit}`;
        };

        const meta = {
            total: totalRecords,
            per_page: limit,
            current_page: parseInt(page),
            last_page: totalPages,
            first_page: 1,
            first_page_url: constructUrl(1),
            last_page_url: constructUrl(totalPages),
            next_page_url: page < totalPages ? constructUrl(parseInt(page) + 1) : null,
            previous_page_url: page > 1 ? constructUrl(parseInt(page) - 1) : null,
            total_score: totalScore
        };

        return res.status(200).json({
            meta: meta,
            data: events
        });
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม:", err);
        return res.status(500).json({ message: 'ข้อผิดพลาดภายในเซิร์ฟเวอร์', error: err.message });
    }
};

export const getCustomerEvents = async (req, res) => {
    const { customer_id } = req.params;  
    let currentPage = parseInt(req.query.page) || 1;  
    let perPage = parseInt(req.query.per_page) || 10;  

    if (isNaN(currentPage) || currentPage < 1) {
        return res.status(400).json({ message: 'Invalid page number' });
    }

    if (isNaN(perPage) || perPage < 1) {
        return res.status(400).json({ message: 'Invalid per_page number' });
    }

    const offset = (currentPage - 1) * perPage;

    try {
        // ตรวจสอบว่ามี customer_id ในฐานข้อมูลหรือไม่
        const [customerResults] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (customerResults.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
        }

        // คำนวณจำนวนทั้งหมด (total records)
        const countQuery = "SELECT COUNT(*) AS total FROM cloud WHERE customer_id = ?";
        const [countResults] = await pool.query(countQuery, [customer_id]);
        const totalRecords = countResults[0].total;
        const totalPages = Math.ceil(totalRecords / perPage);

        // สร้าง URL สำหรับการคำนวณหน้าต่าง ๆ
        const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
        const constructUrl = (page) => {
            const params = new URLSearchParams(req.query);
            params.set('page', page);
            params.set('per_page', perPage);
            return `${baseUrl}?${params.toString()}`;
        };

        const query = `
            SELECT * FROM cloud WHERE customer_id = ? 
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [eventsResults] = await pool.query(query, [customer_id, perPage, offset]);

        const meta = {
            total: totalRecords,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages,
            first_page: 1,
            first_page_url: constructUrl(1),
            last_page_url: constructUrl(totalPages),
            next_page_url: currentPage < totalPages ? constructUrl(currentPage + 1) : null,
            previous_page_url: currentPage > 1 ? constructUrl(currentPage - 1) : null
        };

        return res.status(200).json({
            meta: meta,
            data: eventsResults
        });

    } catch (error) {
        console.error("Error fetching events:", error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
};

export const updateCustomerProfile = async (req, res) => {
    const {
        customer_id,
        first_name,
        last_name,
        user_code,
        group_st,
        branch_st,
        tpye_st,
        st_tpye,
        levelST,
    } = req.body;

    try {
        const [results] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        await pool.query(
            "UPDATE customerinfo SET first_name = ?, last_name = ?, user_code = ?, group_st = ?, branch_st = ?, tpye_st = ?, st_tpye = ?, levelST = ? WHERE customer_id = ?",
            [
                first_name,
                last_name,
                user_code,
                group_st,
                branch_st,
                tpye_st,
                st_tpye,
                levelST,
                customer_id,
            ]
        );

        const [updatedUserResults] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updatedUserResults[0],
        });

    } catch (err) {
        //console.log(err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllCustomers = async (req, res) => {
    let currentPage = parseInt(req.query.page) || 1;
    let perPage = parseInt(req.query.per_page) || 10;
    let stType = req.query.st_tpye || '';

    try {
        let countQuery = "SELECT COUNT(*) as total FROM customerinfo";
        let queryParams = [];

        if (stType) {
            countQuery += " WHERE st_tpye = ?";
            queryParams.push(stType);
        }

        const [countResults] = await pool.query(countQuery, queryParams);
        let totalCustomers = countResults[0].total;
        let totalPages = Math.ceil(totalCustomers / perPage);
        let offset = (currentPage - 1) * perPage;

        let customerQuery = "SELECT * FROM customerinfo";
        if (stType) {
            customerQuery += " WHERE st_tpye = ?";
        }
        customerQuery += " LIMIT ? OFFSET ?";

        queryParams.push(perPage, offset);

        const [customerResults] = await pool.query(customerQuery, queryParams);

        const meta = {
            total: totalCustomers,
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
            data: customerResults
        });
    } catch (err) {
        //console.log(err);
        return res.status(500).send("Internal server error");
    }
};

// อัปโหลดรูปภาพหรือภาพถ่าย
export const uploadFaceIdImage = async (req, res) => {
    const { customer_id } = req.body;

    if (!customer_id || !req.files || req.files.length === 0) {
        return res.status(400).json({ message: "กรุณาระบุ customer_id และอัปโหลดไฟล์รูปภาพ" });
    }

    try {
        const [results] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลลูกค้า" });
        }

        const fileUrls = req.files.map(file => file.location);

        // const fileUrlsJson = JSON.stringify(fileUrls);

        await pool.query(
            "UPDATE customerinfo SET faceUrl = ? WHERE customer_id = ?",
            [JSON.stringify(fileUrls), customer_id]
        );

        return res.status(200).json({
            message: "อัปโหลดรูปภาพใบหน้าเรียบร้อย",
            fileUrls: fileUrls,
        });

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการอัปโหลด:", err);
        return res.status(500).json({ message: 'ข้อผิดพลาดภายในเซิร์ฟเวอร์', error: err.message });
    }
};

export const getAvailableRewards = async (req, res) => {
    let currentPage = parseInt(req.query.page) || 1;
    let perPage = parseInt(req.query.per_page) || 10;
    let canRedeem = req.query.can_redeem; // ตัวกรองเพิ่มเติม (ถ้ามี)

    // การตรวจสอบข้อมูลแบบแมนนวล
    if (req.query.page !== undefined && (isNaN(currentPage) || currentPage < 1)) {
        return res.status(400).json({ message: 'Invalid page number' });
    }

    if (req.query.per_page !== undefined && (isNaN(perPage) || perPage < 1)) {
        return res.status(400).json({ message: 'Invalid per_page number' });
    }

    if (canRedeem !== undefined && canRedeem !== 'true' && canRedeem !== 'false') {
        return res.status(400).json({ message: 'Invalid can_redeem value. Must be "true" or "false"' });
    }

    try {
        let countQuery = "SELECT COUNT(*) as total FROM rewards WHERE amount > 0";
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

        let rewardQuery = "SELECT * FROM rewards WHERE amount > 0";
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

export const redeemReward = async (req, res) => {
    const { customerId, rewardId } = req.body;

    console.log("Received Data:", req.body); // Debug ค่า input

    if (!customerId || !rewardId) {
        return res.status(400).json({ message: 'กรุณาส่ง customerId และ rewardId' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [customerRows] = await connection.query('SELECT * FROM customerinfo WHERE customer_id = ?', [customerId]);
        if (customerRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบผู้ใช้ที่ต้องการ' });
        }

        const customer = customerRows[0];

        const [rewardRows] = await connection.query('SELECT * FROM rewards WHERE id = ?', [rewardId]);
        if (rewardRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบรางวัลที่ต้องการแลก' });
        }

        const reward = rewardRows[0];

        if (customer.total_point < reward.points_required) {
            return res.status(400).json({ message: 'แต้มของผู้ใช้ไม่เพียงพอในการแลกรางวัลนี้' });
        }

        if (reward.amount <= 0) {
            return res.status(400).json({ message: 'รางวัลนี้หมดแล้ว' });
        }

        await connection.beginTransaction();

        try {
            await connection.query(
                'UPDATE customerinfo SET total_point = total_point - ? WHERE customer_id = ?',
                [reward.points_required, customerId]
            );

            await connection.query(
                'UPDATE rewards SET amount = amount - 1 WHERE id = ?',
                [rewardId]
            );

            await connection.query(
                'INSERT INTO customer_rewards (customer_id, reward_id, status, reward_url, customer_name) VALUES (?, ?, ?, ?, ?)',
                [customerId, rewardId, 'pending', JSON.stringify(reward.rewardUrl), `${customer.first_name} ${customer.last_name}`]
            );

            await connection.commit();

            return res.status(200).json({ message: 'แลกรางวัลสำเร็จแล้ว' });

        } catch (err) {
            await connection.rollback();
            console.error('Transaction Error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแลกรางวัล', error: err.message });
        }

    } catch (error) {
        console.error("Error redeeming reward:", error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};


export const getCustomerRewardHistory = async (req, res) => {
    const { customerId } = req.params;  // ดึง customerId จาก params
    const { page = 1, per_page = 10, status } = req.query; // รองรับ pagination และ filter by status

    // ตรวจสอบว่า customerId ถูกส่งมา
    if (!customerId) {
        return res.status(400).json({ message: 'กรุณาส่ง customerId' });
    }

    // ตรวจสอบว่าหน้าปัจจุบันและจำนวนต่อหน้าถูกต้อง
    const parsedPage = parseInt(page);
    const parsedPerPage = Math.min(parseInt(per_page), 100); // ตั้งค่าขีดจำกัดสูงสุดสำหรับ per_page

    if (isNaN(parsedPage) || parsedPage < 1) {
        return res.status(400).json({ message: 'Invalid page number' });
    }

    if (isNaN(parsedPerPage) || parsedPerPage < 1) {
        return res.status(400).json({ message: 'Invalid per_page number' });
    }

    const offset = (parsedPage - 1) * parsedPerPage;

    // กรองสถานะ ถ้ามี (used, pending)
    let whereClause = `WHERE cr.customer_id = ?`;
    let queryParams = [customerId];

    if (status) {
        if (!['used', 'pending'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status filter. Use "used" or "pending"' });
        }
        whereClause += " AND cr.status = ?";
        queryParams.push(status);
    }

    try {
        // ตรวจสอบว่าลูกค้ามีอยู่จริง
        const [customerRows] = await pool.query('SELECT * FROM customerinfo WHERE customer_id = ?', [customerId]);
        if (customerRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบผู้ใช้ที่ต้องการ' });
        }

        // คำนวณจำนวนทั้งหมด (total records)
        const countQuery = `SELECT COUNT(*) AS total FROM customer_rewards cr ${whereClause}`;
        const [countResults] = await pool.query(countQuery, queryParams);
        const totalRecords = countResults[0].total;
        const totalPages = Math.ceil(totalRecords / parsedPerPage);

        // สร้าง Base URL สำหรับการสร้าง Absolute URLs
        const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
        const constructUrl = (page) => {
            const params = new URLSearchParams(req.query);
            params.set('page', page);
            params.set('per_page', parsedPerPage); // รวม per_page ใน URLs
            return `${baseUrl}?${params.toString()}`;
        };

        // ดึงข้อมูลประวัติการแลก reward ตามหน้า
        const historyQuery = `
            SELECT cr.id, cr.reward_id, cr.points_used, cr.amount, cr.reward_url , cr.status, cr.created_at, cr.updated_at, r.reward_name
            FROM customer_rewards cr
            JOIN rewards r ON cr.reward_id = r.id
            ${whereClause}
            ORDER BY cr.created_at DESC
            LIMIT ? OFFSET ?
        `;
        const historyQueryParams = [...queryParams, parsedPerPage, offset];
        const [historyResults] = await pool.query(historyQuery, historyQueryParams);

        return res.status(200).json({
            meta: {
                total: totalRecords,
                per_page: parsedPerPage,
                current_page: parsedPage,
                last_page: totalPages,
                first_page: 1,
                first_page_url: constructUrl(1),
                last_page_url: constructUrl(totalPages),
                next_page_url: parsedPage < totalPages ? constructUrl(parsedPage + 1) : null,
                previous_page_url: parsedPage > 1 ? constructUrl(parsedPage - 1) : null
            },
            data: historyResults.length > 0 ? historyResults : [],
        });

    } catch (error) {
        console.error('Error fetching reward history:', error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
};

export const useReward = async (req, res) => {
    const { customerId, rewardId } = req.body;

    if (!customerId || !rewardId) {
        return res.status(400).json({ message: 'กรุณาส่ง customerId และ rewardId' });
    }

    try {
        // ตรวจสอบว่ามีรายการแลกรางวัลที่อยู่ในสถานะ 'pending'
        const [rewardRows] = await pool.query(
            'SELECT * FROM customer_rewards WHERE customer_id = ? AND reward_id = ? AND status = ?',
            [customerId, rewardId, 'pending']
        );

        if (rewardRows.length === 0) {
            console.log("No pending rewards found for customer:", customerId, "and reward:", rewardId);
            return res.status(404).json({ message: 'ไม่พบรายการแลกรางวัลที่ต้องการใช้งาน หรือรางวัลนั้นไม่อยู่ในสถานะ pending' });
        }

        const rewardEntry = rewardRows[0];
        console.log("Reward entry found:", rewardEntry);

        // เปลี่ยนสถานะเป็น 'used' และบันทึกเวลาที่ใช้
        await pool.query(
            'UPDATE customer_rewards SET status = ?, used_at = ? WHERE id = ?',
            ['used', new Date(), rewardEntry.id]
        );

        return res.status(200).json({ message: 'ใช้รางวัลสำเร็จแล้ว', status: 'used' });

    } catch (error) {
        console.error("Error using reward:", error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดในการใช้รางวัล" });
    }
};


