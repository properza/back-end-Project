import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; 
import adminRoutes from './routes/admin.route.js'
import eventRoutes from './routes/event.route.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import cron from 'node-cron';  // เพิ่มการนำเข้า node-cron
import pool from './model/database.js';
import axios from 'axios'; 

dotenv.config();

const app = express();

// กำหนด __dirname สำหรับ ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// สร้างโฟลเดอร์ถ้ายังไม่มี
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads');
const gfilesDir = path.join(__dirname, 'utils', 'gfiles');

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(gfilesDir, { recursive: true });

app.use(cors());
app.use(express.json());

export const updateCustomerTotalHour = async () => {
    try {
        const [results] = await pool.query(
            `SELECT customer_id, SUM(scores_earn) AS total_scores
             FROM special_cl
             WHERE status = 'อนุมัติ'
             GROUP BY customer_id`
        );

        for (const result of results) {
            const customerId = result.customer_id;
            const totalScores = result.total_scores;

            const totalHour = totalScores || 0;

            await pool.query(
                `UPDATE customerinfo 
                 SET total_hour = ? 
                 WHERE customer_id = ?`,
                [totalHour, customerId]
            );
        }

        console.log('Successfully updated total_hour for all customers.');
    } catch (err) {
        console.error('Error updating total_hour:', err);
    }
};

setInterval(() => {
    console.log('กำลังคำนวณและอัปเดต total_hour...');
    updateCustomerTotalHour();
}, 1000);

const updateCustomerLevel = async () => {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;

        if (currentMonth === 3) {
            const [updateResults] = await pool.query(
                `UPDATE customerinfo
                 SET levelST = LEAST(levelST + 1, 8)  // บวก 1 และหากเกิน 8 ให้ใช้ 8
                 WHERE levelST < 8`
            );

            console.log(`${updateResults.affectedRows} records updated.`);

            const [deleteResults] = await pool.query(
                `DELETE FROM customerinfo
                 WHERE levelST = 8`
            );

            console.log(`${deleteResults.affectedRows} records deleted.`);
        } else {
            console.log('ไม่ถึงเดือนมีนาคม, ไม่มีการอัปเดต');
        }
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการอัปเดต levelST:", err);
    }
};

const checkAndSendScores = async () => {
    try {
        const currentDate = new Date();
        const currentDay = currentDate.getDate();
        const currentMonth = currentDate.getMonth() + 1;
        
        if (currentDay === 20 && currentMonth === 3) {

            const [results] = await pool.query(
                "SELECT customer_id, SUM(scores_earn) AS total_scores FROM special_cl WHERE status = 'อนุมัติ' GROUP BY customer_id"
            );

            for (const row of results) {
                const { customer_id, total_scores } = row;

                if (total_scores < 36) {
                    const missingScore = 36 - total_scores;

                    const message = `ท่านยังขาดคะแนนจิตอาสาอีก ${missingScore} ชม.`;

                    const lineToken = process.env.LINE_TOKEN;
                    const lineMessage = {
                        to: customer_id,
                        messages: [{
                            type: 'text',
                            text: message
                        }]
                    };

                    await axios.post('https://api.line.me/v2/bot/message/push', lineMessage, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${lineToken}`,
                        }
                    });

                    console.log(`ส่งข้อความไปยัง customer_id: ${customer_id} - ${message}`);
                }
            }
        } else {
            console.log('วันนี้ไม่ใช่วันที่ 20 มีนาคม');
        }
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการเช็คคะแนนหรือส่งข้อความ LINE:", err);
    }
};

const deleteSpecialClData = async () => {
    try {
        const currentDate = new Date();
        const targetDate = new Date('2025-03-20');
        targetDate.setDate(targetDate.getDate() + 30);

        if (currentDate >= targetDate) {
            const [deleteResults] = await pool.query(
                "DELETE FROM special_cl"
            );
            console.log(`${deleteResults.affectedRows} records deleted from special_cl.`);
        } else {
            console.log('ไม่ถึงวันที่ 19 เมษายน, ไม่มีการลบข้อมูล');
        }
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการลบข้อมูลใน special_cl:", err);
    }
};

//เช็คคะแนนจิตอาสา เพื่อแจ้งเตือนไปที่ นศ วันที่ 20 มีนา
cron.schedule('0 0 20 3 *', () => {
    console.log('กำลังเช็คคะแนนจิตอาสา...');
    checkAndSendScores();
});

//ปรับปีการศึกษาต้นเดือน เมษา ของทุกปี แต่หากมากกว่า 8 บัญชีจะถูกลบ
cron.schedule('0 0 1 4 *', () => {
    console.log('กำลังอัปเดต levelST...');
    updateCustomerLevel();
});

//สรุปและลบข้อมูลเมื่อถึงวันที่ 19 เดือน เมษา
cron.schedule('0 0 19 4 *', () => {
    console.log('กำลังลบข้อมูลใน special_cl...');
    deleteSpecialClData();
});

// เส้นทางต่างๆ
app.use('/admin', adminRoutes);
app.use('/customer', customerInfoRoutes);
app.use('/events', eventRoutes);

// เส้นทาง Static
app.use('/uploads', express.static(uploadsDir));
app.use('/utils/gfiles', express.static(gfilesDir));

app.listen(process.env.PORT || 4000);
