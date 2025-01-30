import { Router } from 'express';
import multer from 'multer';
import upload from '../middleware/fileUpload.js';

import { createOrLoginCustomer, updateCustomerProfile, getAllCustomers , uploadFaceIdImage , getAvailableRewards , redeemReward , getCustomerRewardHistory } from '../controllers/customerInfoController.js';

const router = Router();

router.get('/customers', getAllCustomers);
router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile',  updateCustomerProfile);
router.put('/customerinfo/uploadfaceid', upload.array('images', 1), uploadFaceIdImage);
router.get('/rewards', getAvailableRewards);
router.post('/rewards/redeem',redeemReward);
router.get('/historyrewards/:customerId', getCustomerRewardHistory);    

export default router;