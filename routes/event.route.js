import { Router } from 'express';
import { getEventWithCustomerCount, registerCustomerForEvent , getRegisteredEventsForCustomer , EditEvent , DeleteEvent} from '../controllers/eventController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/registerCustomer/:eventId', registerCustomerForEvent);
router.get('/events/:eventId/customers', verifyToken, getEventWithCustomerCount);
router.get('/customer/registered-events/:customerId', getRegisteredEventsForCustomer);
router.put('/event/:eventId/edit', verifyToken, EditEvent);
router.delete('/event/:eventId/delete', verifyToken, DeleteEvent);

export default router;
