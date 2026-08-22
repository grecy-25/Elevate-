import express from 'express';
import { listActivities, getCityActivities, scheduleActivity, updateScheduledActivity, deleteScheduledActivity } from '../controllers/activityController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuth, listActivities);
router.get('/city/:cityId', optionalAuth, getCityActivities);
router.post('/schedule', authenticateToken, scheduleActivity);
router.put('/schedule/:id', authenticateToken, updateScheduledActivity);
router.delete('/schedule/:id', authenticateToken, deleteScheduledActivity);

export default router;
