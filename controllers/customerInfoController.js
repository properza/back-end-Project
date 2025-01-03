import connection from "../model/database.js";
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
        const [results] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (results.length === 0) {
            const [insertResults] = await connection.query(
                "INSERT INTO customerinfo (customer_id, name, picture) VALUES (?, ?, ?)",
                [customer_id, name, picture]
            );

            const [newUserResults] = await connection.query(
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
        console.log(err);
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
        const [results] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        await connection.query(
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

        const [updatedUserResults] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updatedUserResults[0],
        });

    } catch (err) {
        console.log(err);
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

        const [countResults] = await connection.query(countQuery, queryParams);
        let totalCustomers = countResults[0].total;
        let totalPages = Math.ceil(totalCustomers / perPage);
        let offset = (currentPage - 1) * perPage;

        let customerQuery = "SELECT * FROM customerinfo";
        if (stType) {
            customerQuery += " WHERE st_tpye = ?";
        }
        customerQuery += " LIMIT ? OFFSET ?";
        
        queryParams.push(perPage, offset);

        const [customerResults] = await connection.query(customerQuery, queryParams);

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
        console.log(err);
        return res.status(500).send("Internal server error");
    }
};

// อัปโหลดรูปภาพหรือภาพถ่าย
export const uploadFaceIdImage = async (req, res) => {
    const { customer_id } = req.body;

    console.log("Received upload request for customer_id:", customer_id);
    console.log("Received file:", req.file);

    if (!customer_id || !req.file) {
        console.log("Missing customer_id or file");
        return res.status(400).json({ message: "Please provide customer_id and upload an image file" });
    }

    try {
        const [results] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        if (results.length === 0) {
            console.log("Customer not found:", customer_id);
            return res.status(404).json({ message: "Customer not found" });
        }

        // กำหนดเส้นทางใหม่สำหรับเก็บไฟล์ด้วย Path แบบ Absolute
        const oldPath = req.file.path;
        const newDir = path.join(__dirname, '..', 'utils', 'gfiles');
        const newPath = path.join(newDir, req.file.filename);

        console.log("Old path:", oldPath);
        console.log("New path:", newPath);

        // สร้างโฟลเดอร์ใหม่ถ้าไม่มีอยู่
        await fsPromises.mkdir(newDir, { recursive: true });
        console.log("Created directory:", newDir);

        // ย้ายไฟล์ไปยังโฟลเดอร์ใหม่
        await fsPromises.rename(oldPath, newPath);
        console.log("Moved file to:", newPath);

        const baseUrl = "https://project-dev-0hj6.onrender.com/utils/gfiles";
        const fileUrl = `${baseUrl}/${req.file.filename}`;

        // อัปเดต URL ของไฟล์ในฐานข้อมูล
        await connection.query(
            "UPDATE customerinfo SET faceUrl = ? WHERE customer_id = ?",
            [fileUrl, customer_id]
        );
        console.log("Updated database with faceUrl:", fileUrl);

        const [updatedUserResults] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id]
        );

        console.log("Upload successful for customer_id:", customer_id);

        return res.status(200).json({
            message: "Face ID image uploaded successfully",
            user: updatedUserResults[0],
        });

    } catch (err) {
        console.error("Error in uploadFaceIdImage:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};