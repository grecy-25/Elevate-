import { get, run, query } from '../config/db.js';

// 1. Add Stop to Trip
export async function addStop(req, res) {
  try {
    const { tripId, cityId, arrivalDate, departureDate, accommodationName, accommodationCost, transportMode, transportCost, notes } = req.body;

    if (!tripId || !cityId || !arrivalDate || !departureDate) {
      return res.status(400).json({ error: 'Trip ID, City ID, arrival date, and departure date are required.' });
    }

    const trip = await get('SELECT user_id FROM trips WHERE id = ?', [tripId]);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    if (trip.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to add stops to this trip.' });
    }

    const maxOrderRes = await get('SELECT MAX(order_index) as max_order FROM trip_stops WHERE trip_id = ?', [tripId]);
    const nextOrder = (maxOrderRes && maxOrderRes.max_order !== null) ? maxOrderRes.max_order + 1 : 1;

    const { lastInsertRowid } = await run(`
      INSERT INTO trip_stops (trip_id, city_id, order_index, arrival_date, departure_date, accommodation_name, accommodation_cost, transport_mode, transport_cost, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tripId,
      cityId,
      nextOrder,
      arrivalDate,
      departureDate,
      accommodationName || 'City Accommodation',
      Number(accommodationCost) || 0,
      transportMode || 'Flight',
      Number(transportCost) || 0,
      notes || ''
    ]);

    const createdStop = await get(`
      SELECT ts.*, c.name as city_name, c.country as city_country, c.image_url as city_image
      FROM trip_stops ts
      JOIN cities c ON ts.city_id = c.id
      WHERE ts.id = ?
    `, [lastInsertRowid]);

    res.status(201).json({
      message: 'Stop added to itinerary successfully.',
      stop: {
        id: createdStop.id,
        tripId: createdStop.trip_id,
        cityId: createdStop.city_id,
        cityName: createdStop.city_name,
        cityCountry: createdStop.city_country,
        cityImage: createdStop.city_image,
        orderIndex: createdStop.order_index,
        arrivalDate: createdStop.arrival_date,
        departureDate: createdStop.departure_date,
        accommodationName: createdStop.accommodation_name,
        accommodationCost: Number(createdStop.accommodation_cost),
        transportMode: createdStop.transport_mode,
        transportCost: Number(createdStop.transport_cost),
        notes: createdStop.notes,
        activities: []
      }
    });
  } catch (err) {
    console.error('Add stop error:', err);
    res.status(500).json({ error: 'Failed to add stop to trip.' });
  }
}

// 2. Update Stop
export async function updateStop(req, res) {
  try {
    const { id } = req.params;
    const { arrivalDate, departureDate, accommodationName, accommodationCost, transportMode, transportCost, notes } = req.body;

    const stop = await get(`
      SELECT ts.*, t.user_id 
      FROM trip_stops ts 
      JOIN trips t ON ts.trip_id = t.id 
      WHERE ts.id = ?
    `, [id]);

    if (!stop) {
      return res.status(404).json({ error: 'Stop not found.' });
    }

    if (stop.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to edit this stop.' });
    }

    await run(`
      UPDATE trip_stops
      SET arrival_date = COALESCE(?, arrival_date),
          departure_date = COALESCE(?, departure_date),
          accommodation_name = COALESCE(?, accommodation_name),
          accommodation_cost = COALESCE(?, accommodation_cost),
          transport_mode = COALESCE(?, transport_mode),
          transport_cost = COALESCE(?, transport_cost),
          notes = COALESCE(?, notes)
      WHERE id = ?
    `, [
      arrivalDate || null,
      departureDate || null,
      accommodationName !== undefined ? accommodationName : null,
      accommodationCost !== undefined ? Number(accommodationCost) : null,
      transportMode !== undefined ? transportMode : null,
      transportCost !== undefined ? Number(transportCost) : null,
      notes !== undefined ? notes : null,
      id
    ]);

    res.json({ message: 'Stop updated successfully.' });
  } catch (err) {
    console.error('Update stop error:', err);
    res.status(500).json({ error: 'Failed to update stop.' });
  }
}

// 3. Delete Stop
export async function deleteStop(req, res) {
  try {
    const { id } = req.params;

    const stop = await get(`
      SELECT ts.*, t.user_id 
      FROM trip_stops ts 
      JOIN trips t ON ts.trip_id = t.id 
      WHERE ts.id = ?
    `, [id]);

    if (!stop) {
      return res.status(404).json({ error: 'Stop not found.' });
    }

    if (stop.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this stop.' });
    }

    await run('DELETE FROM trip_stops WHERE id = ?', [id]);
    res.json({ message: 'Stop removed from itinerary.' });
  } catch (err) {
    console.error('Delete stop error:', err);
    res.status(500).json({ error: 'Failed to delete stop.' });
  }
}

// 4. Reorder Stops
export async function reorderStops(req, res) {
  try {
    const { tripId, stopOrder } = req.body; // Array of { stopId, orderIndex }

    if (!tripId || !Array.isArray(stopOrder)) {
      return res.status(400).json({ error: 'tripId and stopOrder array are required.' });
    }

    const trip = await get('SELECT user_id FROM trips WHERE id = ?', [tripId]);
    if (!trip || (trip.user_id !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Unauthorized to reorder stops for this trip.' });
    }

    for (const item of stopOrder) {
      await run('UPDATE trip_stops SET order_index = ? WHERE id = ? AND trip_id = ?', [item.orderIndex, item.stopId, tripId]);
    }

    res.json({ message: 'Stops reordered successfully.' });
  } catch (err) {
    console.error('Reorder stops error:', err);
    res.status(500).json({ error: 'Failed to reorder stops.' });
  }
}
