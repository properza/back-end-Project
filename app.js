import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; // นำเข้าเส้นทาง
import cors from 'cors';

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// กำหนดเส้นทาง
app.use(customerInfoRoutes);

app.get('/', (req, res) => {
    res.send('This is my api running...');
});

// app.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });
app.listen(process.env.port || 3000);
