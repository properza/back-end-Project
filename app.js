import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; // นำเข้าเส้นทาง 
import adminRoutes from './routes/admin.route.js'
import eventRoutes from './routes/event.route.js';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/admin',adminRoutes)
app.use('/customer',customerInfoRoutes)
app.use('/events',eventRoutes)

app.listen(process.env.port || 4000);
