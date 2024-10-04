import express from 'express';
import customerInfoRoutes from './routes/customerInfoRoutes.js'; // นำเข้าเส้นทาง

const app = express();
const port = 5000;

app.use(express.json());

// กำหนดเส้นทาง
app.use(customerInfoRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
