import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

// Set up AWS S3 Client (v3)
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Set up multer-s3 for uploading to S3
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET_NAME,
        acl: "public-read", // Make the uploaded file publicly accessible
        key: (req, file, cb) => {
            const fileName = `${Date.now()}-${file.originalname}`;
            cb(null, fileName); // Set the file name to be unique
        },
    }),
});

export default upload;
