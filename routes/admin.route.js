import { Router } from 'express';
import { adminLogin, createAdmin , createEvent, getAllEvents , getAdminData , logout , sendLineMessage , createReward , getAllRewards , updateReward } from '../controllers/adminController.js';
import { verifyToken , verifySuperAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', adminLogin);
router.post('/create', verifySuperAdmin, createAdmin);
router.post('/createEvent', verifyToken, createEvent);
router.get('/event/super_admin', verifySuperAdmin, getAllEvents);
router.get('/auth', verifyToken, getAdminData);
router.post('/logout', verifyToken, logout);
router.post('/sendMessage', verifyToken, sendLineMessage);
router.post('/createReward', verifyToken, createReward);
router.get('/rewards', verifyToken, getAllRewards);
router.get('/rewards/:reward_id', verifyToken, updateReward);

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