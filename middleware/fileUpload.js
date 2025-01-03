import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// กำหนด __dirname สำหรับ ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// กำหนด storage สำหรับ multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

// สร้าง instance ของ multer
const upload = multer({ storage });

export default upload;
