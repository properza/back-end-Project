import { Router } from 'express';
import { getEventWithCustomerCount, registerCustomerForEvent } from '../controllers/eventController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/registerCustomer/:eventId', registerCustomerForEvent);
router.get('/events/:eventId/customers', verifyToken, getEventWithCustomerCount);

export default router;
