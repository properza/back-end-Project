import { Router } from 'express';
import {
    adminLogin, createAdmin, createEvent,
    getAllEvents, getAdminData, logout,
    sendLineMessage, createReward, getAllRewards,
    updateReward, getAdmins, updateAdmin,
    deleteAdmin , deleteReward ,
    getCustomerRewardsByRewardId ,
    updateStatusToCompleted ,
    updateSpecialEventStatus
} from '../controllers/adminController.js';
import { verifyToken, verifySuperAdmin } from '../middleware/authMiddleware.js';
import upload from '../middleware/fileUpload.js';

const router = Router();

router.post('/login', adminLogin);
router.post('/create', verifySuperAdmin, createAdmin);
router.post('/createEvent', verifyToken, createEvent);
router.get('/event/super_admin', verifySuperAdmin, getAllEvents);
router.get('/auth', verifyToken, getAdminData);
router.post('/logout', verifyToken, logout);
router.post('/sendMessage', verifyToken, sendLineMessage);
router.post('/createReward', verifyToken, upload, createReward);
router.get('/rewards', verifyToken, getAllRewards);
router.put('/rewards/:reward_id', verifyToken, upload, updateReward);
router.delete('/rewards/:reward_id', verifyToken, deleteReward);

router.get('/admins/getadmin', verifySuperAdmin, getAdmins);
router.put('/admins/:adminId', verifySuperAdmin, updateAdmin);
router.delete('/admins/:adminId', verifySuperAdmin, deleteAdmin);

//เส้นกิจกรรม กยศ.
router.put('/special-events/status/:event_id ', verifyToken, updateSpecialEventStatus);

//เส้นของรางวัล
router.get('/customer_rewards/:rewardId', verifyToken, getCustomerRewardsByRewardId);
router.patch('/customer_rewards/status/:id', verifyToken, updateStatusToCompleted);


// เส้นทางสำหรับดู event ที่เป็น "special"
router.get('/event/special', verifyToken, async (req, res) => {
    req.query.event_type = 'special';
    return getAllEvents(req, res);
});

// เส้นทางสำหรับดู event ที่เป็น "normal"
router.get('/event/normal', verifyToken, async (req, res) => {
    req.query.event_type = 'normal';
    return getAllEvents(req, res);
});

export default router;