import { Router } from 'express';
import { createOrLoginCustomer, updateCustomerProfile, getAllCustomers} from '../controllers/customerInfoController.js';

const router = Router();

router.get('/customers', getAllCustomers);
router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile',  updateCustomerProfile);

export default router;