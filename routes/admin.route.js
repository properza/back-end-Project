import { Router } from 'express';
import { adminLogin, createAdmin , createEvent, getAllEvents , logout } from '../controllers/adminController.js';
import { verifyToken , verifySuperAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', adminLogin);
router.post('/create', verifySuperAdmin, createAdmin);
router.post('/createEvent', verifyToken, createEvent);
router.get('/event/super_admin', verifySuperAdmin, getAllEvents);
router.post('/logout', verifyToken, logout);

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