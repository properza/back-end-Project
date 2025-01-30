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
            const [insertResults] = await pool.query(
                "INSERT INTO customerinfo (customer_id, name, picture) VALUES (?, ?, ?)",
                [customer_id, name, picture]
            );

            const [newUserResults] = await pool.query(
                "SELECT * FROM customerinfo WHERE id = ?",
                [insertResults.insertId]
            );

            return res.status(201).json({
                message: "Customer info created",
                user: newUserResults[0],
            });
        } else {
            return res.status(200).json({
                message: "Login successful",
                user: results[0],
            });
        }
    } catch (err) {
        //console.log(err);
        return res.status(500).send("Internal server error");
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

    if (!customer_id || !req.file) {
        return res.status(400).json({ message: "Please provide customer_id and upload an image file" });
    }

    try {
        const [results] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // URL ของไฟล์ที่อัปโหลดไปยัง S3
        const fileUrl = req.file.location; // `req.file.location` จะเก็บ URL ของไฟล์ใน S3

        // อัปเดต URL ของไฟล์ในฐานข้อมูล TiDB
        await pool.query(
            "UPDATE customerinfo SET faceUrl = ? WHERE customer_id = ?",
            [fileUrl, customer_id]
        );

        // ส่งคำตอบกลับ
        return res.status(200).json({
            message: "Face ID image uploaded successfully",
            fileUrl: fileUrl
        });

    } catch (err) {
        console.error("Error uploading face ID image:", err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
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

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!customerId || !rewardId) {
        return res.status(400).json({ message: 'กรุณาส่ง customerId และ rewardId' });
    }

    try {
        // ตรวจสอบว่าลูกค้ามีอยู่จริงและมีแต้มเพียงพอ
        const [customerRows] = await pool.query('SELECT * FROM customerinfo WHERE customer_id = ?', [customerId]);

        if (customerRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบลูกค้าที่ต้องการ' });
        }

        const customer = customerRows[0];

        // ตรวจสอบว่าลูกค้ามีแต้มเพียงพอ
        if (customer.total_point < 0) { // This condition seems incorrect; likely should check against reward's points_required
            return res.status(400).json({ message: 'แต้มของลูกค้าไม่เพียงพอ' });
        }

        // ตรวจสอบว่ารางวัลมีอยู่จริงและมีจำนวนที่ยังไม่หมด
        const [rewardRows] = await pool.query('SELECT * FROM rewards WHERE id = ?', [rewardId]);

        if (rewardRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบรางวัลที่ต้องการแลก' });
        }

        const reward = rewardRows[0];

        // ตรวจสอบว่าแต้มของลูกค้ามากกว่าหรือเท่ากับ points_required
        if (customer.total_point < reward.points_required) {
            return res.status(400).json({ message: 'แต้มของลูกค้าไม่เพียงพอในการแลกรางวัลนี้' });
        }

        // ตรวจสอบว่ารางวัลยังมีจำนวน
        if (reward.amount <= 0) {
            return res.status(400).json({ message: 'รางวัลนี้หมดแล้ว' });
        }

        // เริ่ม Transaction
        await pool.beginTransaction();

        try {
            // หักแต้มจากลูกค้า
            await pool.query(
                'UPDATE customerinfo SET total_point = total_point - ? WHERE customer_id = ?',
                [reward.points_required, customerId]
            );

            // ลดจำนวนของรางวัล
            await pool.query(
                'UPDATE rewards SET amount = amount - 1 WHERE id = ?',
                [rewardId]
            );

            // เพิ่มรายการแลกรางวัลลงใน customer_rewards
            await pool.query(
                'INSERT INTO customer_rewards (customer_id, reward_id, status) VALUES (?, ?, ?)',
                [customerId, rewardId, 'used']
            );

            // Commit Transaction
            await pool.commit();

            return res.status(200).json({ message: 'แลกรางวัลสำเร็จแล้ว' });

        } catch (err) {
            // Rollback Transaction หากเกิดข้อผิดพลาด
            await pool.rollback();
            console.error('Transaction Error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแลกรางวัล' });
        }

    } catch (error) {
        console.error("Error redeeming reward:", error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
};

// controllers/customerInfoController.js
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
            return res.status(404).json({ message: 'ไม่พบลูกค้าที่ต้องการ' });
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
            SELECT cr.id, cr.reward_id, cr.points_used, cr.amount, cr.status, cr.created_at, cr.updated_at, r.reward_name
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

    // ตรวจสอบข้อมูลที่จำเป็น
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
            return res.status(404).json({ message: 'ไม่พบรายการแลกรางวัลที่ต้องการใช้งาน หรือรางวัลนั้นไม่อยู่ในสถานะ pending' });
        }

        const rewardEntry = rewardRows[0];

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