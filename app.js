import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; // นำเข้าเส้นทาง 
import adminRoutes from './routes/admin.route.js'
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/admin',adminRoutes)
app.use('/customer',customerInfoRoutes)


app.listen(process.env.port || 3000);
