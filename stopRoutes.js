import express from 'express';
import { addStop, updateStop, deleteStop, reorderStops } from '../controllers/stopController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, addStop);
router.put('/:id', authenticateToken, updateStop);
router.delete('/:id', authenticateToken, deleteStop);
router.post('/reorder', authenticateToken, reorderStops);

export default router;
