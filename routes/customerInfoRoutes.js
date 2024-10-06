import { Router } from 'express';
import { createOrLoginCustomer, updateCustomerProfile } from '../controllers/customerInfoController.js';
import { customerAuth } from '../middleware/customerAuth.js';

const router = Router();

router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile',  updateCustomerProfile); // ใช้ middleware customerAuth ที่นี่

export default router;