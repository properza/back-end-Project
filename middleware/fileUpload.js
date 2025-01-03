import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // โฟลเดอร์สำหรับเก็บไฟล์
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname); // ดึงนามสกุลไฟล์
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const upload = multer({ storage }); // ตรวจสอบว่า upload ถูกกำหนดอย่างถูกต้อง

export default upload; // ส่งออก upload
