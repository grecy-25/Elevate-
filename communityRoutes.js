import express from 'express';
import { listPublicTrips, getPublicTripBySlug, toggleLikeTrip } from '../controllers/communityController.js';
import { duplicateTrip } from '../controllers/tripController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/trips', optionalAuth, listPublicTrips);
router.get('/trip/:slug', optionalAuth, getPublicTripBySlug);
router.post('/like', authenticateToken, toggleLikeTrip);
router.post('/clone/:id', authenticateToken, duplicateTrip);

export default router;
