import express from 'express';
import { register, login, getMe, forgotPassword, updateProfile, changePassword, deleteAccount } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);
router.delete('/account', authenticateToken, deleteAccount);

export default router;
