import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Folder for storing files
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname); // Extract file extension
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const upload = multer({ storage }); // Ensure upload is defined once

export default upload; // Export only once as default
