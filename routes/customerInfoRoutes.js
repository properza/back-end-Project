import { Router } from 'express';
import multer from 'multer';
import upload from '../middleware/fileUpload.js';

import { createOrLoginCustomer, updateCustomerProfile, getAllCustomers , uploadFaceIdImage , getAvailableRewards , redeemReward , getCustomerRewardHistory, useReward } from '../controllers/customerInfoController.js';

const router = Router();

router.get('/customers', getAllCustomers);
router.post('/customerinfo', createOrLoginCustomer);
router.put('/customerinfo/updateprofile',  updateCustomerProfile);
router.put('/customerinfo/uploadfaceid', upload, uploadFaceIdImage);
router.get('/rewards', getAvailableRewards);
router.post('/rewards/redeem',redeemReward);
router.post('/rewards/use', useReward);
router.get('/historyrewards/:customerId', getCustomerRewardHistory);    

export default router;