import express from 'express';
import { listUserTrips, getTripDetails, createTrip, updateTrip, deleteTrip, duplicateTrip } from '../controllers/tripController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, listUserTrips);
router.get('/:id', optionalAuth, getTripDetails);
router.post('/', authenticateToken, createTrip);
router.put('/:id', authenticateToken, updateTrip);
router.delete('/:id', authenticateToken, deleteTrip);
router.post('/:id/duplicate', authenticateToken, duplicateTrip);

export default router;
