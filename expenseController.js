import { get, run, query } from '../config/db.js';

// 1. Get Trip Expenses & Budget Analytics
export async function getTripExpenses(req, res) {
  try {
    const { tripId } = req.params;

    const trip = await get('SELECT * FROM trips WHERE id = ?', [tripId]);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    if (trip.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view expenses for this trip.' });
    }

    // Direct logged expenses
    const expenses = await query('SELECT * FROM expenses WHERE trip_id = ? ORDER BY expense_date ASC', [tripId]);

    // Calculate stop costs
    const stops = await query('SELECT * FROM trip_stops WHERE trip_id = ?', [tripId]);
    let stopAccomTotal = 0;
    let stopTransportTotal = 0;
    stops.forEach(s => {
      stopAccomTotal += Number(s.accommodation_cost || 0);
      stopTransportTotal += Number(s.transport_cost || 0);
    });

    // Calculate scheduled activities costs
    const activities = await query(`
      SELECT ta.cost, ta.day_number, ta.category
      FROM trip_activities ta
      JOIN trip_stops ts ON ta.trip_stop_id = ts.id
      WHERE ts.trip_id = ?
    `, [tripId]);
    let activitiesTotal = 0;
    activities.forEach(a => {
      activitiesTotal += Number(a.cost || 0);
    });

    // Category aggregations
    const categoryTotals = {
      Accommodation: stopAccomTotal,
      Transport: stopTransportTotal,
      Activities: activitiesTotal,
      Food: 0,
      Shopping: 0,
      Miscellaneous: 0
    };

    expenses.forEach(e => {
      const cat = e.category || 'Miscellaneous';
      if (categoryTotals[cat] !== undefined) {
        categoryTotals[cat] += Number(e.amount || 0);
      } else {
        categoryTotals['Miscellaneous'] += Number(e.amount || 0);
      }
    });

    // Daily breakdown calculation
    const dailyMap = {};
    expenses.forEach(e => {
      dailyMap[e.expense_date] = (dailyMap[e.expense_date] || 0) + Number(e.amount || 0);
    });

    const dailyBreakdown = Object.keys(dailyMap).sort().map(date => ({
      date,
      total: Math.round(dailyMap[date] * 100) / 100
    }));

    const grandTotal = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
    const allocated = Number(trip.budget_allocated);
    const remaining = allocated - grandTotal;
    const isOverbudget = grandTotal > allocated && allocated > 0;

    res.json({
      allocatedBudget: allocated,
      totalSpent: Math.round(grandTotal * 100) / 100,
      remainingBudget: Math.round(remaining * 100) / 100,
      percentUtilized: allocated > 0 ? Math.min(100, Math.round((grandTotal / allocated) * 100)) : 0,
      isOverbudget,
      categories: categoryTotals,
      dailyBreakdown,
      expenses: expenses.map(e => ({
        id: e.id,
        tripId: e.trip_id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
        expenseDate: e.expense_date,
        notes: e.notes
      }))
    });
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ error: 'Failed to retrieve expenses.' });
  }
}

// 2. Add Expense
export async function addExpense(req, res) {
  try {
    const { tripId, title, category, amount, expenseDate, notes } = req.body;

    if (!tripId || !title || !amount || !expenseDate) {
      return res.status(400).json({ error: 'tripId, title, amount, and expenseDate are required.' });
    }

    const trip = await get('SELECT user_id FROM trips WHERE id = ?', [tripId]);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    if (trip.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to add expenses to this trip.' });
    }

    const { lastInsertRowid } = await run(`
      INSERT INTO expenses (trip_id, title, category, amount, expense_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      tripId,
      title.trim(),
      category || 'Miscellaneous',
      Number(amount),
      expenseDate,
      notes || ''
    ]);

    const created = await get('SELECT * FROM expenses WHERE id = ?', [lastInsertRowid]);

    res.status(201).json({
      message: 'Expense added successfully.',
      expense: {
        id: created.id,
        tripId: created.trip_id,
        title: created.title,
        category: created.category,
        amount: Number(created.amount),
        expenseDate: created.expense_date,
        notes: created.notes
      }
    });
  } catch (err) {
    console.error('Add expense error:', err);
    res.status(500).json({ error: 'Failed to add expense.' });
  }
}

// 3. Delete Expense
export async function deleteExpense(req, res) {
  try {
    const { id } = req.params;

    const expense = await get(`
      SELECT e.*, t.user_id 
      FROM expenses e 
      JOIN trips t ON e.trip_id = t.id 
      WHERE e.id = ?
    `, [id]);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    if (expense.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this expense.' });
    }

    await run('DELETE FROM expenses WHERE id = ?', [id]);
    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
}
