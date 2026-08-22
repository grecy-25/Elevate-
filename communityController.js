import { get, run, query } from '../config/db.js';

// 1. List Public Community Itineraries
export async function listPublicTrips(req, res) {
  try {
    const { search, style, sort } = req.query;
    const userId = req.user ? req.user.id : null;

    let sql = `
      SELECT 
        t.*,
        u.first_name,
        u.last_name,
        u.avatar_url as author_avatar,
        u.city as author_city,
        u.country as author_country,
        (SELECT COUNT(*) FROM trip_stops WHERE trip_id = t.id) as stops_count,
        (SELECT COUNT(*) FROM trip_activities ta JOIN trip_stops ts ON ta.trip_stop_id = ts.id WHERE ts.trip_id = t.id) as activities_count,
        (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE t.is_public = 1
    `;
    const params = [];

    if (style && style !== 'All') {
      sql += ` AND t.travel_style = ?`;
      params.push(style);
    }

    if (search) {
      sql += ` AND (t.title LIKE ? OR t.description LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (sort === 'likes') sql += ` ORDER BY likes_count DESC, t.views_count DESC`;
    else if (sort === 'views') sql += ` ORDER BY t.views_count DESC`;
    else sql += ` ORDER BY t.created_at DESC`;

    const trips = await query(sql, params);

    // Get user likes if logged in
    let userLikedTripIds = new Set();
    if (userId) {
      const userLikes = await query('SELECT trip_id FROM trip_likes WHERE user_id = ?', [userId]);
      userLikedTripIds = new Set(userLikes.map(l => l.trip_id));
    }

    const enriched = await Promise.all(trips.map(async (t) => {
      const cities = await query(`
        SELECT c.id, c.name, c.country, c.image_url 
        FROM trip_stops ts 
        JOIN cities c ON ts.city_id = c.id 
        WHERE ts.trip_id = ? 
        ORDER BY ts.order_index ASC
      `, [t.id]);

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        startDate: t.start_date,
        endDate: t.end_date,
        budgetAllocated: Number(t.budget_allocated),
        coverImage: t.cover_image,
        travelStyle: t.travel_style,
        shareSlug: t.share_slug,
        viewsCount: t.views_count,
        stopsCount: t.stops_count,
        activitiesCount: t.activities_count,
        likesCount: t.likes_count,
        isLiked: userLikedTripIds.has(t.id),
        cities,
        author: {
          id: t.user_id,
          name: `${t.first_name} ${t.last_name}`,
          avatarUrl: t.author_avatar,
          location: `${t.author_city || ''}${t.author_city && t.author_country ? ', ' : ''}${t.author_country || ''}`
        },
        createdAt: t.created_at
      };
    }));

    res.json({ trips: enriched });
  } catch (err) {
    console.error('List public trips error:', err);
    res.status(500).json({ error: 'Failed to retrieve public itineraries.' });
  }
}

// 2. Get Public Itinerary by Share Slug
export async function getPublicTripBySlug(req, res) {
  try {
    const { slug } = req.params;
    const userId = req.user ? req.user.id : null;

    const trip = await get('SELECT * FROM trips WHERE share_slug = ?', [slug]);
    if (!trip) {
      return res.status(404).json({ error: 'Shared itinerary not found.' });
    }

    // Increment views count
    await run('UPDATE trips SET views_count = views_count + 1 WHERE id = ?', [trip.id]);

    // Fetch Stops & Scheduled activities
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

    const enrichedStops = await Promise.all(stops.map(async (stop) => {
      const activities = await query(`
        SELECT ta.*, a.image_url as catalog_image, a.location_name as location
        FROM trip_activities ta
        LEFT JOIN activities a ON ta.activity_id = a.id
        WHERE ta.trip_stop_id = ?
        ORDER BY ta.day_number ASC, ta.start_time ASC
      `, [stop.id]);

      return {
        id: stop.id,
        cityName: stop.city_name,
        cityCountry: stop.city_country,
        cityImage: stop.city_image,
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
          dayNumber: a.day_number,
          title: a.custom_title,
          category: a.category,
          startTime: a.start_time,
          durationMins: a.duration_mins,
          cost: Number(a.cost || 0),
          notes: a.notes,
          imageUrl: a.catalog_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80',
          locationName: a.location
        }))
      };
    }));

    // Author
    const author = await get('SELECT id, first_name, last_name, avatar_url, city, country, bio FROM users WHERE id = ?', [trip.user_id]);

    // Likes
    let isLiked = false;
    if (userId) {
      const like = await get('SELECT id FROM trip_likes WHERE user_id = ? AND trip_id = ?', [userId, trip.id]);
      isLiked = Boolean(like);
    }
    const likesCountRes = await get('SELECT COUNT(*) as count FROM trip_likes WHERE trip_id = ?', [trip.id]);

    res.json({
      trip: {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budgetAllocated: Number(trip.budget_allocated),
        coverImage: trip.cover_image,
        travelStyle: trip.travel_style,
        shareSlug: trip.share_slug,
        viewsCount: trip.views_count + 1,
        likesCount: likesCountRes ? likesCountRes.count : 0,
        isLiked,
        createdAt: trip.created_at,
        author: author ? {
          id: author.id,
          name: `${author.first_name} ${author.last_name}`,
          avatarUrl: author.avatar_url,
          location: `${author.city || ''}${author.city && author.country ? ', ' : ''}${author.country || ''}`,
          bio: author.bio
        } : null
      },
      stops: enrichedStops
    });
  } catch (err) {
    console.error('Get public trip by slug error:', err);
    res.status(500).json({ error: 'Failed to retrieve shared itinerary.' });
  }
}

// 3. Toggle Like on Trip
export async function toggleLikeTrip(req, res) {
  try {
    const { tripId } = req.body;
    const userId = req.user.id;

    if (!tripId) {
      return res.status(400).json({ error: 'tripId is required.' });
    }

    const existing = await get('SELECT id FROM trip_likes WHERE user_id = ? AND trip_id = ?', [userId, tripId]);

    if (existing) {
      await run('DELETE FROM trip_likes WHERE id = ?', [existing.id]);
      const countRes = await get('SELECT COUNT(*) as count FROM trip_likes WHERE trip_id = ?', [tripId]);
      return res.json({ isLiked: false, likesCount: countRes ? countRes.count : 0 });
    } else {
      await run('INSERT INTO trip_likes (user_id, trip_id) VALUES (?, ?)', [userId, tripId]);
      const countRes = await get('SELECT COUNT(*) as count FROM trip_likes WHERE trip_id = ?', [tripId]);
      return res.json({ isLiked: true, likesCount: countRes ? countRes.count : 0 });
    }
  } catch (err) {
    console.error('Toggle like trip error:', err);
    res.status(500).json({ error: 'Failed to update like status.' });
  }
}
