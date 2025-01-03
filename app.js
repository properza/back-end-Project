import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; // นำเข้าเส้นทาง 
import adminRoutes from './routes/admin.route.js'
import eventRoutes from './routes/event.route.js';
import cors from 'cors';
import path from 'path';

const app = express();

const corsOptions = {
    origin: 'http://localhost:3000', // แก้เป็นโดเมนของ frontend ของคุณ
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// เส้นทางต่างๆ
app.use('/admin', adminRoutes);
app.use('/customer', customerInfoRoutes);
app.use('/events', eventRoutes);

// เส้นทาง Static
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/utils/gfiles', express.static(path.join(process.cwd(), 'utils/gfiles')));

app.listen(process.env.port || 4000);
