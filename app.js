import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; // นำเข้าเส้นทาง 
import adminRoutes from './routes/admin.route.js'
import eventRoutes from './routes/event.route.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url'; // ใช้เพื่อสร้าง __dirname

// สร้าง __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// เส้นทางต่างๆ
app.use('/admin', adminRoutes);
app.use('/customer', customerInfoRoutes);
app.use('/events', eventRoutes);

// เส้นทาง Static
app.use('/utils/gfiles', express.static(path.join(__dirname, 'utils/gfiles')));

app.listen(process.env.port || 4000);
