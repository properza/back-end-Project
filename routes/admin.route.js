import { Router } from 'express';
import { adminLogin, createAdmin , createEvent, getAllEvents } from '../controllers/adminController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', adminLogin);
router.post('/create', verifyToken, createAdmin);
router.post('/createEvent', verifyToken, createEvent);
router.get('/event', verifyToken, getAllEvents);

export default router;