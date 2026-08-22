import { get, run, query } from '../config/db.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
}

// 1. List User Trips
export async function listUserTrips(req, res) {
  try {
    const { status, search } = req.query;
    const userId = req.user.id;

    let sql = `
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM trip_stops WHERE trip_id = t.id) as stops_count,
        (SELECT COUNT(*) FROM trip_activities ta JOIN trip_stops ts ON ta.trip_stop_id = ts.id WHERE ts.trip_id = t.id) as activities_count,
        (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE trip_id = t.id) as total_expenses,
        (SELECT COALESCE(SUM(accommodation_cost + transport_cost), 0) FROM trip_stops WHERE trip_id = t.id) as total_stop_costs,
        (SELECT COALESCE(SUM(ta.cost), 0) FROM trip_activities ta JOIN trip_stops ts ON ta.trip_stop_id = ts.id WHERE ts.trip_id = t.id) as total_activity_costs
      FROM trips t
      WHERE t.user_id = ?
    `;
    const params = [userId];

    if (search) {
      sql += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY t.start_date DESC`;

    const trips = await query(sql, params);
    const today = new Date().toISOString().split('T')[0];

    // Enrich trips with calculated fields and city names
    const enrichedTrips = await Promise.all(trips.map(async (trip) => {
      const cities = await query(`
        SELECT c.id, c.name, c.country, c.image_url 
        FROM trip_stops ts 
        JOIN cities c ON ts.city_id = c.id 
        WHERE ts.trip_id = ? 
        ORDER BY ts.order_index ASC
      `, [trip.id]);

      const totalSpent = Number(trip.total_expenses) + Number(trip.total_stop_costs) + Number(trip.total_activity_costs);
      
      let calculatedStatus = 'upcoming';
      if (trip.start_date <= today && trip.end_date >= today) {
        calculatedStatus = 'ongoing';
      } else if (trip.end_date < today) {
        calculatedStatus = 'completed';
      }

      return {
        id: trip.id,
        userId: trip.user_id,
        title: trip.title,
        description: trip.description,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budgetAllocated: Number(trip.budget_allocated),
        totalSpent: Math.round(totalSpent * 100) / 100,
        budgetRemaining: Math.round((trip.budget_allocated - totalSpent) * 100) / 100,
        percentSpent: trip.budget_allocated > 0 ? Math.min(100, Math.round((totalSpent / trip.budget_allocated) * 100)) : 0,
        coverImage: trip.cover_image,
        travelStyle: trip.travel_style,
        isPublic: Boolean(trip.is_public),
        shareSlug: trip.share_slug,
        viewsCount: trip.views_count,
        stopsCount: trip.stops_count,
        activitiesCount: trip.activities_count,
        likesCount: trip.likes_count,
        cities,
        status: calculatedStatus,
        createdAt: trip.created_at
      };
    }));

    // Filter by status if requested
    const filteredTrips = status && status !== 'all' 
      ? enrichedTrips.filter(t => t.status === status) 
      : enrichedTrips;

    res.json({
      trips: filteredTrips,
      counts: {
        all: enrichedTrips.length,
        ongoing: enrichedTrips.filter(t => t.status === 'ongoing').length,
        upcoming: enrichedTrips.filter(t => t.status === 'upcoming').length,
        completed: enrichedTrips.filter(t => t.status === 'completed').length
      }
    });
  } catch (err) {
    console.error('List trips error:', err);
    res.status(500).json({ error: 'Failed to retrieve trips.' });
  }
}

// 2. Get Single Trip Details (Complete Hierarchy)
export async function getTripDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    const trip = await get('SELECT * FROM trips WHERE id = ?', [id]);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    // Permission check: owner or public trip or admin
    const isOwner = userId && trip.user_id === userId;
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !trip.is_public && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to view this private trip.' });
    }

    // Fetch Stops
    const stops = await query(`
      SELECT 
        ts.*,
        c.name as city_name,
        c.country as city_country,
        c.region as city_region,
        c.image_url as city_image,
        c.cost_index,
        c.currency_symbol,
        c.latitude,
        c.longitude
      FROM trip_stops ts
      JOIN cities c ON ts.city_id = c.id
      WHERE ts.trip_id = ?
      ORDER BY ts.order_index ASC
    `, [trip.id]);

    // Fetch Scheduled Activities for each stop
    const enrichedStops = await Promise.all(stops.map(async (stop) => {
      const activities = await query(`
        SELECT 
          ta.*,
          a.image_url as catalog_image,
          a.location_name as location
        FROM trip_activities ta
        LEFT JOIN activities a ON ta.activity_id = a.id
        WHERE ta.trip_stop_id = ?
        ORDER BY ta.day_number ASC, ta.start_time ASC
      `, [stop.id]);

      return {
        id: stop.id,
        tripId: stop.trip_id,
        cityId: stop.city_id,
        cityName: stop.city_name,
        cityCountry: stop.city_country,
        cityRegion: stop.city_region,
        cityImage: stop.city_image,
        costIndex: stop.cost_index,
        currencySymbol: stop.currency_symbol,
        latitude: stop.latitude,
        longitude: stop.longitude,
        orderIndex: stop.order_index,
        arrivalDate: stop.arrival_date,
        departureDate: stop.departure_date,
        accommodationName: stop.accommodation_name,
        accommodationCost: Number(stop.accommodation_cost || 0),
        transportMode: stop.transport_mode,
        transportCost: Number(stop.transport_cost || 0),
        notes: stop.notes,
        activities: activities.map(a => ({
          id: a.id,
          tripStopId: a.trip_stop_id,
          activityId: a.activity_id,
          dayNumber: a.day_number,
          title: a.custom_title,
          category: a.category,
          startTime: a.start_time,
          durationMins: a.duration_mins,
          cost: Number(a.cost || 0),
          notes: a.notes,
          isCompleted: Boolean(a.is_completed),
          imageUrl: a.catalog_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80',
          locationName: a.location
        }))
      };
    }));

    // Fetch Expenses
    const expenses = await query(`
      SELECT * FROM expenses WHERE trip_id = ? ORDER BY expense_date ASC, created_at DESC
    `, [trip.id]);

    // Financial Breakdown Calculation
    let accommodationTotal = 0;
    let transportTotal = 0;
    let activitiesTotal = 0;
    let diningTotal = 0;
    let miscTotal = 0;

    stops.forEach(s => {
      accommodationTotal += Number(s.accommodation_cost || 0);
      transportTotal += Number(s.transport_cost || 0);
    });

    enrichedStops.forEach(s => {
      s.activities.forEach(a => {
        activitiesTotal += Number(a.cost || 0);
      });
    });

    expenses.forEach(e => {
      const cat = (e.category || '').toLowerCase();
      const amt = Number(e.amount || 0);
      if (cat.includes('food') || cat.includes('din')) diningTotal += amt;
      else if (cat.includes('trans') || cat.includes('flight') || cat.includes('train')) transportTotal += amt;
      else if (cat.includes('hotel') || cat.includes('accom') || cat.includes('stay')) accommodationTotal += amt;
      else if (cat.includes('act') || cat.includes('tour')) activitiesTotal += amt;
      else miscTotal += amt;
    });

    const grandTotalSpent = accommodationTotal + transportTotal + activitiesTotal + diningTotal + miscTotal;

    // Check user like
    let isLiked = false;
    if (userId) {
      const likeRecord = await get('SELECT id FROM trip_likes WHERE user_id = ? AND trip_id = ?', [userId, trip.id]);
      isLiked = Boolean(likeRecord);
    }
    const likesCountRes = await get('SELECT COUNT(*) as count FROM trip_likes WHERE trip_id = ?', [trip.id]);

    // Owner info
    const owner = await get('SELECT id, first_name, last_name, avatar_url, city, country FROM users WHERE id = ?', [trip.user_id]);

    const today = new Date().toISOString().split('T')[0];
    let status = 'upcoming';
    if (trip.start_date <= today && trip.end_date >= today) status = 'ongoing';
    else if (trip.end_date < today) status = 'completed';

    res.json({
      trip: {
        id: trip.id,
        userId: trip.user_id,
        title: trip.title,
        description: trip.description,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budgetAllocated: Number(trip.budget_allocated),
        coverImage: trip.cover_image,
        travelStyle: trip.travel_style,
        isPublic: Boolean(trip.is_public),
        shareSlug: trip.share_slug,
        viewsCount: trip.views_count,
        status,
        createdAt: trip.created_at,
        isOwner,
        likesCount: likesCountRes ? likesCountRes.count : 0,
        isLiked,
        owner: owner ? {
          id: owner.id,
          firstName: owner.first_name,
          lastName: owner.last_name,
          avatarUrl: owner.avatar_url,
          location: `${owner.city || ''}${owner.city && owner.country ? ', ' : ''}${owner.country || ''}`
        } : null
      },
      stops: enrichedStops,
      expenses: expenses.map(e => ({
        id: e.id,
        tripId: e.trip_id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
        expenseDate: e.expense_date,
        notes: e.notes
      })),
      budget: {
        allocated: Number(trip.budget_allocated),
        totalSpent: Math.round(grandTotalSpent * 100) / 100,
        remaining: Math.round((trip.budget_allocated - grandTotalSpent) * 100) / 100,
        percentUtilized: trip.budget_allocated > 0 ? Math.min(100, Math.round((grandTotalSpent / trip.budget_allocated) * 100)) : 0,
        isOverbudget: grandTotalSpent > trip.budget_allocated,
        categories: {
          accommodation: Math.round(accommodationTotal * 100) / 100,
          transport: Math.round(transportTotal * 100) / 100,
          activities: Math.round(activitiesTotal * 100) / 100,
          dining: Math.round(diningTotal * 100) / 100,
          miscellaneous: Math.round(miscTotal * 100) / 100
        }
      }
    });
  } catch (err) {
    console.error('Get trip details error:', err);
    res.status(500).json({ error: 'Failed to retrieve trip details.' });
  }
}

// 3. Create Trip
export async function createTrip(req, res) {
  try {
    const { title, description, startDate, endDate, budgetAllocated, coverImage, travelStyle, isPublic, initialCityId } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Trip title, start date, and end date are required.' });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date cannot be after end date.' });
    }

    const shareSlug = slugify(title);
    const defaultCover = coverImage || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80';

    const { lastInsertRowid } = await run(`
      INSERT INTO trips (user_id, title, description, start_date, end_date, budget_allocated, cover_image, travel_style, is_public, share_slug)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      title.trim(),
      description ? description.trim() : '',
      startDate,
      endDate,
      Number(budgetAllocated) || 0,
      defaultCover,
      travelStyle || 'Explorer',
      isPublic ? 1 : 0,
      shareSlug
    ]);

    // If initialCityId was provided, add it as the first stop automatically!
    if (initialCityId) {
      await run(`
        INSERT INTO trip_stops (trip_id, city_id, order_index, arrival_date, departure_date, accommodation_name, transport_mode)
        VALUES (?, ?, 1, ?, ?, 'Standard Lodging', 'Flight')
      `, [lastInsertRowid, initialCityId, startDate, endDate]);
    }

    res.status(201).json({
      message: 'Trip created successfully!',
      tripId: lastInsertRowid,
      shareSlug
    });
  } catch (err) {
    console.error('Create trip error:', err);
    res.status(500).json({ error: 'Failed to create trip.' });
  }
}

// 4. Update Trip
export async function updateTrip(req, res) {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, budgetAllocated, coverImage, travelStyle, isPublic } = req.body;

    const trip = await get('SELECT user_id FROM trips WHERE id = ?', [id]);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    if (trip.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to edit this trip.' });
    }

    await run(`
      UPDATE trips 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          budget_allocated = COALESCE(?, budget_allocated),
          cover_image = COALESCE(?, cover_image),
          travel_style = COALESCE(?, travel_style),
          is_public = COALESCE(?, is_public),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title ? title.trim() : null,
      description !== undefined ? description : null,
      startDate || null,
      endDate || null,
      budgetAllocated !== undefined ? Number(budgetAllocated) : null,
      coverImage || null,
      travelStyle || null,
      isPublic !== undefined ? (isPublic ? 1 : 0) : null,
      id
    ]);

    res.json({ message: 'Trip updated successfully.' });
  } catch (err) {
    console.error('Update trip error:', err);
    res.status(500).json({ error: 'Failed to update trip.' });
  }
}

// 5. Delete Trip
export async function deleteTrip(req, res) {
  try {
    const { id } = req.params;
    const trip = await get('SELECT user_id FROM trips WHERE id = ?', [id]);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    if (trip.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to delete this trip.' });
    }

    await run('DELETE FROM trips WHERE id = ?', [id]);
    res.json({ message: 'Trip and all its itinerary stops deleted successfully.' });
  } catch (err) {
    console.error('Delete trip error:', err);
    res.status(500).json({ error: 'Failed to delete trip.' });
  }
}

// 6. Duplicate / Clone Trip (Copies stops and activities to user's account)
export async function duplicateTrip(req, res) {
  try {
    const { id } = req.params;
    const originalTrip = await get('SELECT * FROM trips WHERE id = ?', [id]);

    if (!originalTrip) {
      return res.status(404).json({ error: 'Source trip not found.' });
    }

    const newTitle = `Copy of ${originalTrip.title}`;
    const newSlug = slugify(newTitle);

    const { lastInsertRowid: newTripId } = await run(`
      INSERT INTO trips (user_id, title, description, start_date, end_date, budget_allocated, cover_image, travel_style, is_public, share_slug)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
      req.user.id,
      newTitle,
      originalTrip.description,
      originalTrip.start_date,
      originalTrip.end_date,
      originalTrip.budget_allocated,
      originalTrip.cover_image,
      originalTrip.travel_style,
      newSlug
    ]);

    // Copy stops
    const stops = await query('SELECT * FROM trip_stops WHERE trip_id = ? ORDER BY order_index ASC', [id]);
    for (const stop of stops) {
      const { lastInsertRowid: newStopId } = await run(`
        INSERT INTO trip_stops (trip_id, city_id, order_index, arrival_date, departure_date, accommodation_name, accommodation_cost, transport_mode, transport_cost, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newTripId,
        stop.city_id,
        stop.order_index,
        stop.arrival_date,
        stop.departure_date,
        stop.accommodation_name,
        stop.accommodation_cost,
        stop.transport_mode,
        stop.transport_cost,
        stop.notes
      ]);

      // Copy activities in stop
      const activities = await query('SELECT * FROM trip_activities WHERE trip_stop_id = ?', [stop.id]);
      for (const act of activities) {
        await run(`
          INSERT INTO trip_activities (trip_stop_id, activity_id, day_number, custom_title, category, start_time, duration_mins, cost, notes, is_completed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
          newStopId,
          act.activity_id,
          act.day_number,
          act.custom_title,
          act.category,
          act.start_time,
          act.duration_mins,
          act.cost,
          act.notes
        ]);
      }
    }

    res.status(201).json({
      message: 'Trip cloned into your account successfully!',
      tripId: newTripId
    });
  } catch (err) {
    console.error('Duplicate trip error:', err);
    res.status(500).json({ error: 'Failed to clone trip.' });
  }
}
