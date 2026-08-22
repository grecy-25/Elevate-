import { get, run, query } from '../config/db.js';

// 1. List / Search Catalog Activities
export async function listActivities(req, res) {
  try {
    const { cityId, cityName, category, maxPrice, search, sort } = req.query;

    let sql = `
      SELECT a.*, c.name as city_name, c.country as city_country, c.currency_symbol
      FROM activities a
      JOIN cities c ON a.city_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (cityId) {
      sql += ` AND a.city_id = ?`;
      params.push(Number(cityId));
    } else if (cityName && cityName.trim() && cityName.trim().toLowerCase() !== 'all') {
      sql += ` AND LOWER(c.name) LIKE ?`;
      params.push(`%${cityName.trim().toLowerCase()}%`);
    }

    if (category && category !== 'All') {
      sql += ` AND a.category = ?`;
      params.push(category);
    }

    if (maxPrice && !isNaN(Number(maxPrice))) {
      sql += ` AND a.price <= ?`;
      params.push(Number(maxPrice));
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(a.title) LIKE ? OR LOWER(a.description) LIKE ? OR LOWER(a.category) LIKE ? OR LOWER(a.location_name) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(c.country) LIKE ?)`;
      params.push(term, term, term, term, term, term);
    }

    if (sort === 'price_asc') sql += ` ORDER BY a.price ASC`;
    else if (sort === 'price_desc') sql += ` ORDER BY a.price DESC`;
    else if (sort === 'rating') sql += ` ORDER BY a.rating DESC`;
    else sql += ` ORDER BY a.rating DESC, a.id ASC`;

    const activities = await query(sql, params);

    res.json({
      activities: activities.map(a => ({
        id: a.id,
        cityId: a.city_id,
        cityName: a.city_name,
        cityCountry: a.city_country,
        currencySymbol: a.currency_symbol,
        title: a.title,
        category: a.category,
        price: Number(a.price),
        durationMins: a.duration_mins,
        description: a.description,
        imageUrl: a.image_url,
        rating: Number(a.rating),
        locationName: a.location_name
      }))
    });
  } catch (err) {
    console.error('List activities error:', err);
    res.status(500).json({ error: 'Failed to retrieve activities.' });
  }
}

// 2. Get Activities for a Specific City
export async function getCityActivities(req, res) {
  try {
    const { cityId } = req.params;
    const activities = await query('SELECT * FROM activities WHERE city_id = ? ORDER BY rating DESC', [cityId]);
    res.json({ activities });
  } catch (err) {
    console.error('Get city activities error:', err);
    res.status(500).json({ error: 'Failed to retrieve city activities.' });
  }
}

// 3. Schedule Activity into a Trip Stop
export async function scheduleActivity(req, res) {
  try {
    const { tripStopId, activityId, dayNumber, customTitle, category, startTime, durationMins, cost, notes } = req.body;

    if (!tripStopId || !customTitle) {
      return res.status(400).json({ error: 'tripStopId and title are required.' });
    }

    const stop = await get(`
      SELECT ts.*, t.user_id 
      FROM trip_stops ts 
      JOIN trips t ON ts.trip_id = t.id 
      WHERE ts.id = ?
    `, [tripStopId]);

    if (!stop) {
      return res.status(404).json({ error: 'Trip stop not found.' });
    }

    if (stop.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to schedule activities in this stop.' });
    }

    const { lastInsertRowid } = await run(`
      INSERT INTO trip_activities (trip_stop_id, activity_id, day_number, custom_title, category, start_time, duration_mins, cost, notes, is_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      tripStopId,
      activityId || null,
      Number(dayNumber) || 1,
      customTitle.trim(),
      category || 'Sightseeing',
      startTime || '10:00',
      Number(durationMins) || 120,
      Number(cost) || 0,
      notes || ''
    ]);

    const created = await get(`
      SELECT ta.*, a.image_url as catalog_image, a.location_name
      FROM trip_activities ta
      LEFT JOIN activities a ON ta.activity_id = a.id
      WHERE ta.id = ?
    `, [lastInsertRowid]);

    res.status(201).json({
      message: 'Activity scheduled successfully.',
      activity: {
        id: created.id,
        tripStopId: created.trip_stop_id,
        activityId: created.activity_id,
        dayNumber: created.day_number,
        title: created.custom_title,
        category: created.category,
        startTime: created.start_time,
        durationMins: created.duration_mins,
        cost: Number(created.cost),
        notes: created.notes,
        isCompleted: Boolean(created.is_completed),
        imageUrl: created.catalog_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80',
        locationName: created.location_name
      }
    });
  } catch (err) {
    console.error('Schedule activity error:', err);
    res.status(500).json({ error: 'Failed to schedule activity.' });
  }
}

// 4. Update Scheduled Activity
export async function updateScheduledActivity(req, res) {
  try {
    const { id } = req.params;
    const { dayNumber, customTitle, category, startTime, durationMins, cost, notes, isCompleted } = req.body;

    const act = await get(`
      SELECT ta.*, t.user_id 
      FROM trip_activities ta
      JOIN trip_stops ts ON ta.trip_stop_id = ts.id
      JOIN trips t ON ts.trip_id = t.id
      WHERE ta.id = ?
    `, [id]);

    if (!act) {
      return res.status(404).json({ error: 'Scheduled activity not found.' });
    }

    if (act.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to edit this activity.' });
    }

    await run(`
      UPDATE trip_activities
      SET day_number = COALESCE(?, day_number),
          custom_title = COALESCE(?, custom_title),
          category = COALESCE(?, category),
          start_time = COALESCE(?, start_time),
          duration_mins = COALESCE(?, duration_mins),
          cost = COALESCE(?, cost),
          notes = COALESCE(?, notes),
          is_completed = COALESCE(?, is_completed)
      WHERE id = ?
    `, [
      dayNumber !== undefined ? Number(dayNumber) : null,
      customTitle ? customTitle.trim() : null,
      category || null,
      startTime || null,
      durationMins !== undefined ? Number(durationMins) : null,
      cost !== undefined ? Number(cost) : null,
      notes !== undefined ? notes : null,
      isCompleted !== undefined ? (isCompleted ? 1 : 0) : null,
      id
    ]);

    res.json({ message: 'Activity updated successfully.' });
  } catch (err) {
    console.error('Update activity error:', err);
    res.status(500).json({ error: 'Failed to update activity.' });
  }
}

// 5. Delete Scheduled Activity
export async function deleteScheduledActivity(req, res) {
  try {
    const { id } = req.params;

    const act = await get(`
      SELECT ta.*, t.user_id 
      FROM trip_activities ta
      JOIN trip_stops ts ON ta.trip_stop_id = ts.id
      JOIN trips t ON ts.trip_id = t.id
      WHERE ta.id = ?
    `, [id]);

    if (!act) {
      return res.status(404).json({ error: 'Scheduled activity not found.' });
    }

    if (act.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this activity.' });
    }

    await run('DELETE FROM trip_activities WHERE id = ?', [id]);
    res.json({ message: 'Activity removed from schedule.' });
  } catch (err) {
    console.error('Delete scheduled activity error:', err);
    res.status(500).json({ error: 'Failed to delete activity.' });
  }
}
