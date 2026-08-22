import { get, run, query } from '../config/db.js';
import { seed } from '../seed/seedData.js';

// 1. Get Platform Analytics
export async function getPlatformAnalytics(req, res) {
  try {
    const totalUsers = await get('SELECT COUNT(*) as count FROM users');
    const totalTrips = await get('SELECT COUNT(*) as count FROM trips');
    const totalPublicTrips = await get('SELECT COUNT(*) as count FROM trips WHERE is_public = 1');
    const totalStops = await get('SELECT COUNT(*) as count FROM trip_stops');
    const totalScheduledActivities = await get('SELECT COUNT(*) as count FROM trip_activities');
    const totalBudgetTracked = await get('SELECT COALESCE(SUM(budget_allocated), 0) as sum FROM trips');
    const totalExpensesLogged = await get('SELECT COALESCE(SUM(amount), 0) as sum FROM expenses');

    // Top 5 Popular Destination Cities
    const topCities = await query(`
      SELECT c.name, c.country, COUNT(ts.id) as visit_count, c.image_url
      FROM cities c
      LEFT JOIN trip_stops ts ON c.id = ts.city_id
      GROUP BY c.id
      ORDER BY visit_count DESC
      LIMIT 6
    `);

    // Activity Category Distribution
    const categoryStats = await query(`
      SELECT category, COUNT(*) as count 
      FROM trip_activities 
      GROUP BY category 
      ORDER BY count DESC
    `);

    // Travel Style Distribution
    const travelStyles = await query(`
      SELECT travel_style, COUNT(*) as count
      FROM trips
      GROUP BY travel_style
      ORDER BY count DESC
    `);

    // Recent Platform Trips Feed
    const recentTrips = await query(`
      SELECT t.id, t.title, t.created_at, t.budget_allocated, u.first_name, u.last_name, u.email
      FROM trips t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 8
    `);

    res.json({
      metrics: {
        totalUsers: totalUsers ? totalUsers.count : 0,
        totalTrips: totalTrips ? totalTrips.count : 0,
        totalPublicTrips: totalPublicTrips ? totalPublicTrips.count : 0,
        totalStops: totalStops ? totalStops.count : 0,
        totalScheduledActivities: totalScheduledActivities ? totalScheduledActivities.count : 0,
        totalBudgetTracked: Math.round(Number(totalBudgetTracked ? totalBudgetTracked.sum : 0)),
        totalExpensesLogged: Math.round(Number(totalExpensesLogged ? totalExpensesLogged.sum : 0))
      },
      topCities,
      categoryStats,
      travelStyles,
      recentTrips: recentTrips.map(r => ({
        id: r.id,
        title: r.title,
        createdAt: r.created_at,
        budget: Number(r.budget_allocated),
        author: `${r.first_name} ${r.last_name} (${r.email})`
      }))
    });
  } catch (err) {
    console.error('Platform analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics.' });
  }
}

// 2. List All Platform Users (Admin Table)
export async function listUsers(req, res) {
  try {
    const users = await query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.city, u.country, u.role, u.currency, u.avatar_url, u.created_at,
        (SELECT COUNT(*) FROM trips WHERE user_id = u.id) as trips_count
      FROM users u
      ORDER BY u.created_at DESC
    `);

    res.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: `${u.first_name} ${u.last_name}`,
        phone: u.phone,
        location: `${u.city || ''}${u.city && u.country ? ', ' : ''}${u.country || ''}`,
        role: u.role,
        currency: u.currency,
        avatarUrl: u.avatar_url,
        tripsCount: u.trips_count,
        createdAt: u.created_at
      }))
    });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users.' });
  }
}

// 3. Update User Role
export async function updateUserRole(req, res) {
  try {
    const { userId, role } = req.body;
    if (!userId || !role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Valid userId and role (user/admin) are required.' });
    }

    if (Number(userId) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote your own administrator account.' });
    }

    await run('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
    res.json({ message: `User role updated to ${role}.` });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
}

// 4. Reset & Reseed Database
export async function resetDatabase(req, res) {
  try {
    await seed();
    res.json({ message: 'Database successfully reset and re-seeded with demo data.' });
  } catch (err) {
    console.error('Reset DB error:', err);
    res.status(500).json({ error: 'Database reset failed.' });
  }
}
