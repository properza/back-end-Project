import { Router } from 'express';
import { createOrLoginCustomer, updateCustomerProfile  } from '../controllers/customerInfoController.js';
// import { Auth,customerAuth } from '../middleware/customerAuth.js'; // นำเข้า customerAuth แบบ default

const router = Router();

router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile', updateCustomerProfile);

export default router;
