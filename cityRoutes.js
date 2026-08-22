import express from 'express';
import { listCities, getCityDetails, toggleSaveCity } from '../controllers/cityController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuth, listCities);
router.get('/:id', optionalAuth, getCityDetails);
router.post('/save-toggle', authenticateToken, toggleSaveCity);

export default router;
