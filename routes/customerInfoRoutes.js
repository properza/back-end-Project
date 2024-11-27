import { Router } from 'express';
import { createOrLoginCustomer, updateCustomerProfile, getAllCustomers , uploadFaceIdImage } from '../controllers/customerInfoController.js';

const router = Router();

router.get('/customers', getAllCustomers);
router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile',  updateCustomerProfile);
router.put('/customerinfo/uploadfaceid', uploadFaceIdImage);

export default router;