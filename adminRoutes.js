import express from 'express';
import { getPlatformAnalytics, listUsers, updateUserRole, resetDatabase } from '../controllers/adminController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Admin-protected routes
router.get('/analytics', authenticateToken, requireAdmin, getPlatformAnalytics);
router.get('/users', authenticateToken, requireAdmin, listUsers);
router.post('/users/role', authenticateToken, requireAdmin, updateUserRole);
router.post('/reset-database', authenticateToken, requireAdmin, resetDatabase);

export default router;
