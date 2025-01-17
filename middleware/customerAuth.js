import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const customerAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ code: "ERR_TOKEN", message: "Invalid token format" });
        }

        const token = authHeader.split(" ")[1]; // ดึง JWT token หลัง Bearer

        if (!token) {
            return res.status(401).send({ code: "ERR_TOKEN", message: "Token not found" });
        }

        // ตรวจสอบ JWT token
        jwt.verify(token, process.env.CUSTOMER_KEY, { ignoreExpiration: true }, (err, decoded) => {
            if (err) {
                return res.status(401).send({ code: "ERR_TOKEN", message: err.message });
            }

            req.user = decoded; // เก็บข้อมูลจาก token
            next(); // ส่งต่อไปยัง route handler
        });
    } catch (error) {
        //console.log(error);
        return res.status(401).send({ code: "ERR_TOKEN", message: "Invalid token" });
    }
};


