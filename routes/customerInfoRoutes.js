import { Router } from 'express';
import multer from 'multer';
import upload from '../middleware/fileUpload.js';

import { createOrLoginCustomer, updateCustomerProfile, getAllCustomers , uploadFaceIdImage , getAvailableRewards , redeemReward } from '../controllers/customerInfoController.js';

const router = Router();

router.get('/customers', getAllCustomers);
router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile',  updateCustomerProfile);
router.put('/customerinfo/uploadfaceid', upload.single('face_image_url'), uploadFaceIdImage);
router.get('/rewards', getAvailableRewards);
router.post('/rewards/redeem', 
    [
        body('customerId').isString().notEmpty().withMessage('customerId ต้องเป็นสตริงและไม่ว่างเปล่า'),
        body('rewardId').isInt({ min: 1 }).withMessage('rewardId ต้องเป็นจำนวนเต็มที่มากกว่า 0')
    ],
    redeemReward
);

export default router;