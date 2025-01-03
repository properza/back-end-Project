import multer from 'multer';
import path from 'path';

// ตั้งค่าการจัดเก็บไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // โฟลเดอร์สำหรับเก็บไฟล์
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname); // ดึงส่วนขยายของไฟล์
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

export default upload;
