import { Router } from 'express';
import { getEventWithCustomerCount, registerCustomerForEvent , getRegisteredEventsForCustomer } from '../controllers/eventController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/registerCustomer/:eventId', registerCustomerForEvent);
router.get('/events/:eventId/customers', verifyToken, getEventWithCustomerCount);
router.post('/customer/registered-events', getRegisteredEventsForCustomer);

export default router;
