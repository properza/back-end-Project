import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import dotenv from 'dotenv';

dotenv.config(); // โหลดค่าตัวแปรจาก .env

// ตั้งค่า AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// ตั้งค่าการอัปโหลดไฟล์ไปยัง S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME,
        acl: 'public-read', // ทำให้ไฟล์ที่อัปโหลดสามารถเข้าถึงได้
        key: (req, file, cb) => {
            const fileName = `${Date.now()}-${file.originalname}`;
            cb(null, fileName); // กำหนดชื่อไฟล์ใหม่
        }
    })
});

export default upload;
