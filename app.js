import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; 
import adminRoutes from './routes/admin.route.js'
import eventRoutes from './routes/event.route.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

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

// เส้นทางต่างๆ
app.use('/admin', adminRoutes);
app.use('/customer', customerInfoRoutes);
app.use('/events', eventRoutes);

// เส้นทาง Static
app.use('/uploads', express.static(uploadsDir));
app.use('/utils/gfiles', express.static(gfilesDir));

app.listen(process.env.PORT || 4000);
