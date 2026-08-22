import { get, run, query } from '../config/db.js';

// Helper: Map country/coordinates to continent region
function getRegionForCountry(country = '', lat = 0, lon = 0) {
  const c = country.toLowerCase();
  if (['france', 'italy', 'spain', 'germany', 'united kingdom', 'uk', 'netherlands', 'switzerland', 'greece', 'czech republic', 'austria', 'portugal', 'sweden', 'norway', 'denmark', 'finland', 'ireland', 'belgium', 'croatia', 'hungary', 'poland', 'iceland', 'scotland'].some(k => c.includes(k))) return 'Europe';
  if (['japan', 'china', 'india', 'thailand', 'singapore', 'south korea', 'indonesia', 'vietnam', 'malaysia', 'philippines', 'taiwan', 'nepal', 'sri lanka'].some(k => c.includes(k))) return 'Asia';
  if (['united states', 'usa', 'canada', 'brazil', 'mexico', 'argentina', 'colombia', 'peru', 'chile', 'costa rica', 'cuba', 'panama'].some(k => c.includes(k))) return 'Americas';
  if (['south africa', 'egypt', 'morocco', 'kenya', 'tanzania', 'nigeria', 'ghana', 'ethiopia', 'mauritius'].some(k => c.includes(k))) return 'Africa';
  if (['australia', 'new zealand', 'fiji'].some(k => c.includes(k))) return 'Oceania';
  if (['united arab emirates', 'uae', 'dubai', 'saudi arabia', 'qatar', 'turkey', 'jordan', 'israel', 'oman'].some(k => c.includes(k))) return 'Middle East';
  
  // Fallback by longitude/latitude
  if (lon > -30 && lon < 60 && lat > 35) return 'Europe';
  if (lon >= 60 && lon <= 150 && lat >= 0) return 'Asia';
  if (lon <= -30 && lon >= -170) return 'Americas';
  if (lon >= -20 && lon <= 55 && lat <= 35 && lat >= -40) return 'Africa';
  if (lon >= 110 && lat <= 0) return 'Oceania';
  return 'Europe';
}

// 1. List & Search Cities with Worldwide Dynamic Lookup Fallback
export async function listCities(req, res) {
  try {
    const { region, costIndex, search, minRating } = req.query;
    const userId = req.user ? req.user.id : null;

    let sql = `
      SELECT c.*,
        (SELECT COUNT(*) FROM activities WHERE city_id = c.id) as activities_count,
        (SELECT COUNT(*) FROM trip_stops WHERE city_id = c.id) as total_trips_visited
      FROM cities c
      WHERE 1=1
    `;
    const params = [];

    if (region && region !== 'All') {
      sql += ` AND c.region = ?`;
      params.push(region);
    }

    if (costIndex && costIndex !== 'All') {
      sql += ` AND c.cost_index = ?`;
      params.push(Number(costIndex));
    }

    if (minRating) {
      sql += ` AND c.popularity_rating >= ?`;
      params.push(Number(minRating));
    }

    if (search && search.trim()) {
      sql += ` AND (c.name LIKE ? OR c.country LIKE ? OR c.region LIKE ? OR c.description LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ` ORDER BY c.popularity_rating DESC, c.name ASC`;

    let cities = await query(sql, params);

    // Worldwide dynamic lookup: whenever a search term is provided, also reach out to the
    // free OpenStreetMap Nominatim geocoding API so ANY city in the world can be found,
    // not just the ones curated in the local database. Results get cached locally (inserted
    // into the `cities` table) so repeat searches are instant and work offline afterwards.
    if (search && search.trim().length >= 2 && (!region || region === 'All') && (!costIndex || costIndex === 'All')) {
      try {
        const queryTerm = search.trim();
        const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryTerm)}&addressdetails=1&limit=8&featuretype=city`;
        const geoRes = await fetch(geoUrl, {
          headers: { 'User-Agent': 'GlobeTrotterTravelApp/1.0 (travel@globetrotter.com)' }
        });

        if (geoRes.ok) {
          const geoData = await geoRes.json();

          // Track names already present so we don't create duplicate rows
          const existingKeys = new Set(cities.map(c => `${String(c.name).toLowerCase()}|${String(c.country).toLowerCase()}`));

          for (const item of (geoData || [])) {
            const address = item.address || {};
            const cityName = address.city || address.town || address.village || address.municipality || address.county || item.display_name?.split(',')[0] || queryTerm;
            const countryName = address.country || 'Global Destination';
            const key = `${cityName.toLowerCase()}|${countryName.toLowerCase()}`;

            if (existingKeys.has(key)) continue;

            // Check if this city already exists in the DB from a previous search
            let dbCity = await get('SELECT * FROM cities WHERE LOWER(name) = ? AND LOWER(country) = ?', [cityName.toLowerCase(), countryName.toLowerCase()]);

            if (!dbCity) {
              const lat = parseFloat(item.lat) || 0;
              const lon = parseFloat(item.lon) || 0;
              const computedRegion = getRegionForCountry(countryName, lat, lon);

              const imageUrl = `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80`;
              const description = `${cityName} is a renowned destination in ${countryName}, celebrated for its unique cultural heritage, local architecture, and travel experiences.`;
              const costIndexVal = 2;
              const popularityRating = 4.7;
              const bestSeason = 'May - Oct';

              const insertRes = await run(`
                INSERT INTO cities (name, country, region, description, image_url, cost_index, popularity_rating, best_season, currency_symbol, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, '$', ?, ?)
              `, [cityName, countryName, computedRegion, description, imageUrl, costIndexVal, popularityRating, bestSeason, lat, lon]);

              const newCityId = insertRes.lastInsertRowid;

              const defaultActivities = [
                { title: `${cityName} Iconic Sights & Landmark Walking Tour`, category: 'Sightseeing', price: 45, duration: 150, desc: `Explore the most celebrated historical and architectural landmarks of ${cityName}.` },
                { title: `Authentic ${countryName} Culinary & Street Food Safari`, category: 'Culinary', price: 55, duration: 180, desc: `Taste authentic regional specialties and market treats in ${cityName}.` },
                { title: `${cityName} Highlights Museum & Heritage Pass`, category: 'Culture', price: 40, duration: 120, desc: `Skip-the-line access to premier art and history collections.` },
                { title: `Sunset Viewpoint & Evening Drinks`, category: 'Relaxation', price: 35, duration: 90, desc: `Panoramic golden hour views overlooking the city.` }
              ];

              for (const act of defaultActivities) {
                await run(`
                  INSERT INTO activities (city_id, title, category, price, duration_mins, description, image_url, rating, location_name)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 4.9, ?)
                `, [newCityId, act.title, act.category, act.price, act.duration, act.desc, imageUrl, cityName]);
              }

              dbCity = await get('SELECT c.*, 4 as activities_count, 0 as total_trips_visited FROM cities c WHERE c.id = ?', [newCityId]);
            } else {
              dbCity.activities_count = (await get('SELECT COUNT(*) as c FROM activities WHERE city_id = ?', [dbCity.id]))?.c || 0;
              dbCity.total_trips_visited = (await get('SELECT COUNT(*) as c FROM trip_stops WHERE city_id = ?', [dbCity.id]))?.c || 0;
            }

            if (dbCity) {
              cities.push(dbCity);
              existingKeys.add(key);
            }
          }
        }
      } catch (geoErr) {
        console.warn('Worldwide geocoding lookup error (this requires internet access):', geoErr.message || geoErr);
      }
    }

    // Check saved status for logged in user
    let savedCityIds = new Set();
    if (userId) {
      const saved = await query('SELECT city_id FROM saved_destinations WHERE user_id = ?', [userId]);
      savedCityIds = new Set(saved.map(s => s.city_id));
    }

    res.json({
      cities: cities.map(c => ({
        id: c.id,
        name: c.name,
        country: c.country,
        region: c.region,
        description: c.description,
        imageUrl: c.image_url,
        costIndex: c.cost_index,
        popularityRating: Number(c.popularity_rating),
        bestSeason: c.best_season,
        currencySymbol: c.currency_symbol,
        latitude: c.latitude,
        longitude: c.longitude,
        activitiesCount: c.activities_count,
        totalTripsVisited: c.total_trips_visited,
        isSaved: savedCityIds.has(c.id)
      }))
    });
  } catch (err) {
    console.error('List cities error:', err);
    res.status(500).json({ error: 'Failed to retrieve cities.' });
  }
}

// 2. Get Single City Details with Top Activities & Weather Preview
export async function getCityDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    const city = await get('SELECT * FROM cities WHERE id = ?', [id]);
    if (!city) {
      return res.status(404).json({ error: 'City not found.' });
    }

    const activities = await query('SELECT * FROM activities WHERE city_id = ? ORDER BY rating DESC', [id]);
    
    let isSaved = false;
    if (userId) {
      const saved = await get('SELECT id FROM saved_destinations WHERE user_id = ? AND city_id = ?', [userId, id]);
      isSaved = Boolean(saved);
    }

    // Simulated / live weather preview based on latitude
    const tempCelsius = Math.round(22 + (Math.sin(city.latitude || 40) * 8));

    res.json({
      city: {
        id: city.id,
        name: city.name,
        country: city.country,
        region: city.region,
        description: city.description,
        imageUrl: city.image_url,
        costIndex: city.cost_index,
        popularityRating: Number(city.popularity_rating),
        bestSeason: city.best_season,
        currencySymbol: city.currency_symbol,
        latitude: city.latitude,
        longitude: city.longitude,
        weatherPreview: {
          tempC: tempCelsius,
          tempF: Math.round((tempCelsius * 9/5) + 32),
          condition: 'Sunny / Mild Breezes',
          seasonStatus: 'Great time to travel'
        },
        isSaved
      },
      activities: activities.map(a => ({
        id: a.id,
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
    console.error('Get city details error:', err);
    res.status(500).json({ error: 'Failed to retrieve city.' });
  }
}

// 3. Toggle Bookmark / Save Destination
export async function toggleSaveCity(req, res) {
  try {
    const { cityId } = req.body;
    const userId = req.user.id;

    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required.' });
    }

    const existing = await get('SELECT id FROM saved_destinations WHERE user_id = ? AND city_id = ?', [userId, cityId]);

    if (existing) {
      await run('DELETE FROM saved_destinations WHERE id = ?', [existing.id]);
      return res.json({ isSaved: false, message: 'Removed from saved wishlist.' });
    } else {
      await run('INSERT INTO saved_destinations (user_id, city_id) VALUES (?, ?)', [userId, cityId]);
      return res.json({ isSaved: true, message: 'Saved to your travel wishlist!' });
    }
  } catch (err) {
    console.error('Toggle save city error:', err);
    res.status(500).json({ error: 'Failed to update saved destination.' });
  }
}
