import express from 'express';
import { getTripExpenses, addExpense, deleteExpense } from '../controllers/expenseController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/trip/:tripId', authenticateToken, getTripExpenses);
router.post('/', authenticateToken, addExpense);
router.delete('/:id', authenticateToken, deleteExpense);

export default router;
