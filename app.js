import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; // นำเข้าเส้นทาง 
import adminRoutes from './routes/admin.route.js'
import eventRoutes from './routes/event.route.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url'; // ใช้เพื่อสร้าง __dirname


const app = express();

app.use(cors());
app.use(express.json());

// เส้นทางต่างๆ
app.use('/admin', adminRoutes);
app.use('/customer', customerInfoRoutes);
app.use('/events', eventRoutes);

// เส้นทาง Static
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.listen(process.env.port || 4000);
