import { Router } from 'express';
import multer from 'multer';
import upload from '../middleware/fileUpload.js';

import { createOrLoginCustomer, updateCustomerProfile, getAllCustomers , uploadFaceIdImage } from '../controllers/customerInfoController.js';

const router = Router();

router.get('/customers', getAllCustomers);
router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile',  updateCustomerProfile);
router.put('/customerinfo/uploadfaceid', upload.single('face_image_url'), uploadFaceIdImage);

export default router;