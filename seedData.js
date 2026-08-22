import bcrypt from 'bcryptjs';
import db, { initDatabase, run, get, exec } from '../config/db.js';

export async function seed() {
  console.log('🌱 Seeding GlobeTrotter relational database with expanded global cities...');
  await initDatabase();

  // Clear existing data in correct FK order
  await exec(`
    DELETE FROM trip_likes;
    DELETE FROM saved_destinations;
    DELETE FROM expenses;
    DELETE FROM trip_activities;
    DELETE FROM trip_stops;
    DELETE FROM trips;
    DELETE FROM activities;
    DELETE FROM cities;
    DELETE FROM users;
  `);

  // 1. Insert Users
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminHash = await bcrypt.hash('admin123', 10);

  await run(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, phone, city, country, bio, avatar_url, role, currency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    1,
    'traveler@globetrotter.com',
    passwordHash,
    'Alex',
    'Morgan',
    '+1 (555) 234-5678',
    'San Francisco',
    'United States',
    'Passionate world traveler, food enthusiast, and amateur photographer exploring one continent at a time.',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    'user',
    'USD'
  ]);

  await run(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, phone, city, country, bio, avatar_url, role, currency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    2,
    'admin@globetrotter.com',
    adminHash,
    'Sarah',
    'Chen',
    '+1 (555) 987-6543',
    'London',
    'United Kingdom',
    'GlobeTrotter Lead Platform Administrator & Travel Curations Director.',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
    'admin',
    'USD'
  ]);

  // 2. Comprehensive Global Cities (30+ Major World Destinations)
  const cities = [
    {
      id: 1,
      name: 'Paris',
      country: 'France',
      region: 'Europe',
      description: 'The City of Light captivates with timeless art, haute cuisine, iconic architecture, and romantic avenues along the Seine.',
      image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.9,
      best_season: 'Apr - Oct',
      currency_symbol: '€',
      latitude: 48.8566,
      longitude: 2.3522
    },
    {
      id: 2,
      name: 'Tokyo',
      country: 'Japan',
      region: 'Asia',
      description: 'A dazzling blend of ultramodern neon skyscrapers, serene Shinto shrines, unmatched gastronomy, and vibrant subcultures.',
      image_url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.95,
      best_season: 'Mar - May, Sep - Nov',
      currency_symbol: '¥',
      latitude: 35.6762,
      longitude: 139.6503
    },
    {
      id: 3,
      name: 'Rome',
      country: 'Italy',
      region: 'Europe',
      description: 'An open-air museum filled with ancient gladiatorial ruins, baroque fountains, Vatican treasures, and exquisite pasta.',
      image_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.85,
      best_season: 'May - Sep',
      currency_symbol: '€',
      latitude: 41.9028,
      longitude: 12.4964
    },
    {
      id: 4,
      name: 'Bali',
      country: 'Indonesia',
      region: 'Asia',
      description: 'Island of the Gods boasting emerald rice terraces, spiritual water temples, world-class surf breaks, and wellness sanctuaries.',
      image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&auto=format&fit=crop&q=80',
      cost_index: 1,
      popularity_rating: 4.88,
      best_season: 'May - Oct',
      currency_symbol: 'Rp',
      latitude: -8.4095,
      longitude: 115.1889
    },
    {
      id: 5,
      name: 'Barcelona',
      country: 'Spain',
      region: 'Europe',
      description: 'Catalan jewel celebrated for Gaudí’s surreal masterworks, lively Mediterranean beaches, vibrant tapas culture, and Gothic alleys.',
      image_url: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.82,
      best_season: 'May - Oct',
      currency_symbol: '€',
      latitude: 41.3874,
      longitude: 2.1686
    },
    {
      id: 6,
      name: 'New York City',
      country: 'United States',
      region: 'Americas',
      description: 'The energetic global metropolis featuring Broadway, Central Park, Michelin-starred dining, iconic skyline, and endless culture.',
      image_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&auto=format&fit=crop&q=80',
      cost_index: 4,
      popularity_rating: 4.9,
      best_season: 'All Year',
      currency_symbol: '$',
      latitude: 40.7128,
      longitude: -74.0060
    },
    {
      id: 7,
      name: 'Kyoto',
      country: 'Japan',
      region: 'Asia',
      description: 'Japan’s cultural soul home to thousand-year-old wooden temples, bamboo groves, geisha districts, and Zen rock gardens.',
      image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.92,
      best_season: 'Mar - May, Oct - Nov',
      currency_symbol: '¥',
      latitude: 35.0116,
      longitude: 135.7681
    },
    {
      id: 8,
      name: 'Cape Town',
      country: 'South Africa',
      region: 'Africa',
      description: 'Where majestic Table Mountain meets two oceans, offering coastal vineyard drives, penguin colonies, and vibrant culinary scenes.',
      image_url: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.78,
      best_season: 'Nov - Mar',
      currency_symbol: 'R',
      latitude: -33.9249,
      longitude: 18.4241
    },
    {
      id: 9,
      name: 'London',
      country: 'United Kingdom',
      region: 'Europe',
      description: 'Rich royal history, world-renowned West End theater, iconic red double-deckers, historic pubs, and expansive royal parks.',
      image_url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.87,
      best_season: 'May - Sep',
      currency_symbol: '£',
      latitude: 51.5074,
      longitude: -0.1278
    },
    {
      id: 10,
      name: 'Dubai',
      country: 'United Arab Emirates',
      region: 'Middle East',
      description: 'Futuristic architectural wonders, world-record landmarks, luxury desert safaris, and dazzling marina skylines.',
      image_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&auto=format&fit=crop&q=80',
      cost_index: 4,
      popularity_rating: 4.8,
      best_season: 'Nov - Apr',
      currency_symbol: 'AED',
      latitude: 25.2048,
      longitude: 55.2708
    },
    {
      id: 11,
      name: 'Santorini',
      country: 'Greece',
      region: 'Europe',
      description: 'Whitewashed cliffside villas overlooking azure Aegean waters, dramatic caldera sunsets, and unique volcanic beaches.',
      image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.93,
      best_season: 'May - Oct',
      currency_symbol: '€',
      latitude: 36.3932,
      longitude: 25.4615
    },
    {
      id: 12,
      name: 'Sydney',
      country: 'Australia',
      region: 'Oceania',
      description: 'Harbour city living with world-famous Opera House, Bondi coastal walks, golden beaches, and sun-soaked dining.',
      image_url: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.84,
      best_season: 'Sep - Mar',
      currency_symbol: 'A$',
      latitude: -33.8688,
      longitude: 151.2093
    },
    {
      id: 13,
      name: 'Singapore',
      country: 'Singapore',
      region: 'Asia',
      description: 'Garden city with futuristic Supertree Grove, Marina Bay Sands, world-famous hawker centers, and lush botanical gardens.',
      image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.91,
      best_season: 'Nov - Jun',
      currency_symbol: 'S$',
      latitude: 1.3521,
      longitude: 103.8198
    },
    {
      id: 14,
      name: 'Amsterdam',
      country: 'Netherlands',
      region: 'Europe',
      description: 'Charming 17th-century canal rings, world-class Van Gogh and Rijksmuseum collections, and vibrant cycling culture.',
      image_url: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.86,
      best_season: 'Apr - Sep',
      currency_symbol: '€',
      latitude: 52.3676,
      longitude: 4.9041
    },
    {
      id: 15,
      name: 'Zurich',
      country: 'Switzerland',
      region: 'Europe',
      description: 'Alpine lakeside splendor, historic Altstadt alleys, luxury Swiss chocolatiers, and crystal-clear mountain panoramic views.',
      image_url: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=1200&auto=format&fit=crop&q=80',
      cost_index: 4,
      popularity_rating: 4.88,
      best_season: 'Jun - Oct, Dec - Mar',
      currency_symbol: 'CHF',
      latitude: 47.3769,
      longitude: 8.5417
    },
    {
      id: 16,
      name: 'Berlin',
      country: 'Germany',
      region: 'Europe',
      description: 'Creative hub renowned for modern art galleries, Brandenburg Gate, Museum Island, and world-famous music scenes.',
      image_url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.81,
      best_season: 'May - Sep',
      currency_symbol: '€',
      latitude: 52.5200,
      longitude: 13.4050
    },
    {
      id: 17,
      name: 'Mumbai',
      country: 'India',
      region: 'Asia',
      description: 'The City of Dreams boasting Gateway of India, Marine Drive promenade, Bollywood magic, and world-class street food.',
      image_url: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200&auto=format&fit=crop&q=80',
      cost_index: 1,
      popularity_rating: 4.79,
      best_season: 'Oct - Mar',
      currency_symbol: '₹',
      latitude: 19.0760,
      longitude: 72.8777
    },
    {
      id: 18,
      name: 'Vancouver',
      country: 'Canada',
      region: 'Americas',
      description: 'Pacific coastal gem where snow-capped mountains meet temperate rainforests, Stanley Park seawall, and fresh seafood.',
      image_url: 'https://images.unsplash.com/photo-1559511260-66a65e09b9eb?w=1200&auto=format&fit=crop&q=80',
      cost_index: 3,
      popularity_rating: 4.85,
      best_season: 'Jun - Sep',
      currency_symbol: 'C$',
      latitude: 49.2827,
      longitude: -123.1207
    },
    {
      id: 19,
      name: 'Seoul',
      country: 'South Korea',
      region: 'Asia',
      description: 'Dynamic metropolis fusing Joseon Dynasty palaces, cutting-edge K-pop culture, 24/7 night markets, and mouthwatering Korean BBQ.',
      image_url: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.89,
      best_season: 'Mar - May, Sep - Nov',
      currency_symbol: '₩',
      latitude: 37.5665,
      longitude: 126.9780
    },
    {
      id: 20,
      name: 'Cairo',
      country: 'Egypt',
      region: 'Africa',
      description: 'The City of a Thousand Minarets, gateway to the Great Pyramids of Giza, Sphinx, and the treasures of the Grand Egyptian Museum.',
      image_url: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=1200&auto=format&fit=crop&q=80',
      cost_index: 1,
      popularity_rating: 4.83,
      best_season: 'Oct - Apr',
      currency_symbol: 'E£',
      latitude: 30.0444,
      longitude: 31.2357
    },
    {
      id: 21,
      name: 'Rio de Janeiro',
      country: 'Brazil',
      region: 'Americas',
      description: 'Iconic Christ the Redeemer statue, Copacabana and Ipanema beaches, Sugarloaf Mountain cable cars, and infectious Samba energy.',
      image_url: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.86,
      best_season: 'Dec - Mar',
      currency_symbol: 'R$',
      latitude: -22.9068,
      longitude: -43.1729
    },
    {
      id: 22,
      name: 'Bangkok',
      country: 'Thailand',
      region: 'Asia',
      description: 'Ornate Grand Palace shrines, bustling Chao Phraya canal riverboats, vibrant street night markets, and world-acclaimed Thai cuisine.',
      image_url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&auto=format&fit=crop&q=80',
      cost_index: 1,
      popularity_rating: 4.87,
      best_season: 'Nov - Feb',
      currency_symbol: '฿',
      latitude: 13.7563,
      longitude: 100.5018
    },
    {
      id: 23,
      name: 'Prague',
      country: 'Czech Republic',
      region: 'Europe',
      description: 'Fairytale Gothic spires, Charles Bridge statues, historic Astronomical Clock, and romantic cobblestone Old Town squares.',
      image_url: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=1200&auto=format&fit=crop&q=80',
      cost_index: 2,
      popularity_rating: 4.88,
      best_season: 'May - Sep',
      currency_symbol: 'Kč',
      latitude: 50.0755,
      longitude: 14.4378
    },
    {
      id: 24,
      name: 'Marrakesh',
      country: 'Morocco',
      region: 'Africa',
      description: 'Sensory wonderland of bustling Jemaa el-Fnaa medina souks, Bahia Palace tilework, tranquil riads, and Atlas mountain views.',
      image_url: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1200&auto=format&fit=crop&q=80',
      cost_index: 1,
      popularity_rating: 4.82,
      best_season: 'Mar - May, Sep - Nov',
      currency_symbol: 'MAD',
      latitude: 31.6295,
      longitude: -7.9811
    }
  ];

  for (const c of cities) {
    await run(`
      INSERT INTO cities (id, name, country, region, description, image_url, cost_index, popularity_rating, best_season, currency_symbol, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [c.id, c.name, c.country, c.region, c.description, c.image_url, c.cost_index, c.popularity_rating, c.best_season, c.currency_symbol, c.latitude, c.longitude]);
  }

  // 3. Curated Activities
  const activities = [
    // Paris
    { id: 1, city_id: 1, title: 'Eiffel Tower Summit & Champagne Tasting', category: 'Sightseeing', price: 65, duration_mins: 150, description: 'Skip the line to the summit of the Eiffel Tower with an audio guide, ending with a flute of French champagne at sunset.', image_url: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800&auto=format&fit=crop&q=80', rating: 4.9, location_name: 'Champ de Mars, Paris' },
    { id: 2, city_id: 1, title: 'Louvre Museum Masterpieces Guided Tour', category: 'Culture', price: 75, duration_mins: 180, description: 'Explore the Mona Lisa, Venus de Milo, and Winged Victory with an expert art historian skipping all general entry lines.', image_url: 'https://images.unsplash.com/photo-1565099824688-e93eb20fe622?w=800&auto=format&fit=crop&q=80', rating: 4.85, location_name: 'Musée du Louvre' },
    { id: 3, city_id: 1, title: 'Montmartre Secret Bakeries & Macaron Walking Tour', category: 'Culinary', price: 55, duration_mins: 120, description: 'Taste authentic croissants, artisanal cheeses, gourmet chocolates, and warm baguettes in the bohemian artists quarter.', image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80', rating: 4.92, location_name: 'Montmartre, 18th Arr.' },
    { id: 4, city_id: 1, title: 'Seine River Sunset Dinner Cruise', category: 'Relaxation', price: 95, duration_mins: 120, description: 'Glide past Notre-Dame and illuminated monuments aboard a glass canopy boat enjoying a 3-course Parisian dinner.', image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80', rating: 4.88, location_name: 'Port de la Bourdonnais' },

    // Tokyo
    { id: 5, city_id: 2, title: 'Shibuya & Harajuku Hidden Food & Street Art Tour', category: 'Culinary', price: 60, duration_mins: 180, description: 'Navigate the bustling Shibuya Crossing, sample wagyu skewers, fluffy pancakes in Harajuku, and explore backstreet alleyways.', image_url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&auto=format&fit=crop&q=80', rating: 4.96, location_name: 'Shibuya Scramble' },
    { id: 6, city_id: 2, title: 'teamLab Planets Immersive Digital Art Experience', category: 'Culture', price: 38, duration_mins: 120, description: 'Wade through water and lose yourself in infinite crystal universes and projection-mapped floating flower gardens.', image_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80', rating: 4.94, location_name: 'Toyosu, Tokyo' },
    { id: 7, city_id: 2, title: 'Mount Fuji & Lake Kawaguchi Day Trip', category: 'Adventure', price: 110, duration_mins: 480, description: 'Full-day scenic excursion to 5th Station of Mt. Fuji, panoramic cable car ride, and traditional thatched Oshino Hakkai village.', image_url: 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=800&auto=format&fit=crop&q=80', rating: 4.89, location_name: 'Mount Fuji' },
    { id: 8, city_id: 2, title: 'Shinjuku Golden Gai Izakaya & Nightlife Crawl', category: 'Nightlife', price: 50, duration_mins: 180, description: 'Experience Tokyo’s legendary atmospheric tiny bars, craft sake tastings, and smoky yakitori stalls with a local guide.', image_url: 'https://images.unsplash.com/photo-1554797589-7241bb691973?w=800&auto=format&fit=crop&q=80', rating: 4.91, location_name: 'Golden Gai, Shinjuku' },

    // Rome
    { id: 9, city_id: 3, title: 'Colosseum Underground & Gladiator Arena VIP Tour', category: 'Sightseeing', price: 80, duration_mins: 180, description: 'Exclusive access to subterranean chambers where gladiators prepared, Roman Forum ruins, and the Palatine Hill vantage point.', image_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&auto=format&fit=crop&q=80', rating: 4.93, location_name: 'Piazza del Colosseo' },
    { id: 10, city_id: 3, title: 'Trastevere Sunset Pasta & Wine Making Masterclass', category: 'Culinary', price: 70, duration_mins: 150, description: 'Handmake fresh fettuccine and ravioli from scratch with a local Roman chef on a sunlit rooftop overlooking Trastevere.', image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80', rating: 4.97, location_name: 'Trastevere, Rome' },
    { id: 11, city_id: 3, title: 'Vatican Museums & Sistine Chapel Early Access', category: 'Culture', price: 85, duration_mins: 210, description: 'Enter the Sistine Chapel before the general public to gaze in peace at Michelangelo’s iconic ceiling frescoes and St. Peter’s Basilica.', image_url: 'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?w=800&auto=format&fit=crop&q=80', rating: 4.88, location_name: 'Vatican City' },

    // Bali
    { id: 12, city_id: 4, title: 'Ubud Sacred Monkey Forest & Tegallalang Rice Terrace', category: 'Sightseeing', price: 35, duration_mins: 240, description: 'Walk through ancient mossy temples guarded by playful macaques and swing over cascading emerald rice paddies in Ubud.', image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&auto=format&fit=crop&q=80', rating: 4.89, location_name: 'Ubud, Bali' },
    { id: 13, city_id: 4, title: 'Mount Batur Sunrise Volcano Trek & Hot Springs', category: 'Adventure', price: 45, duration_mins: 360, description: 'Early morning hike up Mount Batur caldera to watch the sunrise above the clouds, followed by soaking in natural volcanic hot springs.', image_url: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&auto=format&fit=crop&q=80', rating: 4.95, location_name: 'Kintamani, Bali' },

    // Singapore
    { id: 14, city_id: 13, title: 'Gardens by the Bay & Cloud Forest Dome Pass', category: 'Sightseeing', price: 42, duration_mins: 150, description: 'Marvel at the indoor waterfall in Cloud Forest and watch the evening Garden Rhapsody light and music show at Supertree Grove.', image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&auto=format&fit=crop&q=80', rating: 4.93, location_name: 'Marina Gardens Dr' },
    { id: 15, city_id: 13, title: 'Michelin Hawker Street Food Walking Safari', category: 'Culinary', price: 50, duration_mins: 180, description: 'Savor Hainanese chicken rice, laksa, satay, and chili crab across Chinatown Complex and Maxwell Food Centre.', image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80', rating: 4.96, location_name: 'Chinatown, Singapore' },

    // Amsterdam
    { id: 16, city_id: 14, title: 'Classic Canal Cruise with Dutch Cheese & Wine', category: 'Relaxation', price: 38, duration_mins: 90, description: 'Drift along UNESCO canal houses with local Gouda cheese platters and fine wine.', image_url: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&auto=format&fit=crop&q=80', rating: 4.88, location_name: 'Prinsengracht, Amsterdam' },
    { id: 17, city_id: 14, title: 'Van Gogh Museum & Rijksmuseum Guided Highlights', category: 'Culture', price: 68, duration_mins: 180, description: 'Skip-the-line journey through Sunflowers, Almond Blossom, and Rembrandt’s Night Watch.', image_url: 'https://images.unsplash.com/photo-1584003564911-a7a321c84e1c?w=800&auto=format&fit=crop&q=80', rating: 4.92, location_name: 'Museumplein' },

    // Zurich
    { id: 18, city_id: 15, title: 'Lake Zurich Steamboat Cruise & Lindt Chocolate Home', category: 'Culinary', price: 58, duration_mins: 210, description: 'Cruise Lake Zurich to the Lindt Home of Chocolate featuring the world’s tallest chocolate fountain and unlimited tastings.', image_url: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&auto=format&fit=crop&q=80', rating: 4.95, location_name: 'Kilchberg, Zurich' },

    // Mumbai
    { id: 19, city_id: 17, title: 'Heritage South Mumbai Architecture & Street Food Trail', category: 'Culinary', price: 30, duration_mins: 180, description: 'Discover Victorian Gothic architecture, Gateway of India, and sample authentic Vada Pav, Pav Bhaji, and cutting chai.', image_url: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&auto=format&fit=crop&q=80', rating: 4.91, location_name: 'Colaba, Mumbai' }
  ];

  for (const a of activities) {
    await run(`
      INSERT INTO activities (id, city_id, title, category, price, duration_mins, description, image_url, rating, location_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [a.id, a.city_id, a.title, a.category, a.price, a.duration_mins, a.description, a.image_url, a.rating, a.location_name]);
  }

  // 4. Sample Trips for Alex (User 1)
  await run(`
    INSERT INTO trips (id, user_id, title, description, start_date, end_date, budget_allocated, cover_image, travel_style, is_public, share_slug, views_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    1,
    1,
    'Grand European Odyssey: Paris, Rome & Barcelona',
    'An unforgettable 10-day expedition through Europe’s greatest cultural capitals, exploring world-renowned art museums, culinary wonders, and Mediterranean coastlines.',
    '2026-09-01',
    '2026-09-10',
    3500.0,
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&auto=format&fit=crop&q=80',
    'Explorer',
    1,
    'grand-european-odyssey-2026',
    142
  ]);

  // Trip 1 Stops
  await run(`
    INSERT INTO trip_stops (id, trip_id, city_id, order_index, arrival_date, departure_date, accommodation_name, accommodation_cost, transport_mode, transport_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [1, 1, 1, 1, '2026-09-01', '2026-09-04', 'Hôtel Le Petit Paris (Latin Quarter)', 480.0, 'Flight', 350.0, 'Arrive Paris CDG at 10:00 AM.']);

  await run(`
    INSERT INTO trip_stops (id, trip_id, city_id, order_index, arrival_date, departure_date, accommodation_name, accommodation_cost, transport_mode, transport_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [2, 1, 3, 2, '2026-09-04', '2026-09-07', 'Boutique Hotel Campo de Fiori', 420.0, 'Flight', 140.0, 'Air France flight to Rome FCO.']);

  await run(`
    INSERT INTO trip_stops (id, trip_id, city_id, order_index, arrival_date, departure_date, accommodation_name, accommodation_cost, transport_mode, transport_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [3, 1, 5, 3, '2026-09-07', '2026-09-10', 'Hotel Pulitzer Barcelona', 450.0, 'Flight', 120.0, 'Direct flight to BCN.']);

  // Scheduled Activities for Trip 1
  const tripActivities = [
    [1, 1, 1, 1, 'Eiffel Tower Summit & Champagne Tasting', 'Sightseeing', '16:30', 150, 65.0, 'Booked sunset slot.', 1],
    [2, 1, 2, 2, 'Louvre Museum Masterpieces Guided Tour', 'Culture', '09:30', 180, 75.0, 'Skip-the-line entrance.', 0],
    [3, 1, 3, 2, 'Montmartre Secret Bakeries & Macaron Walking Tour', 'Culinary', '14:30', 120, 55.0, 'Meet at Abbesses station.', 0],
    [4, 1, 4, 3, 'Seine River Sunset Dinner Cruise', 'Relaxation', '19:30', 120, 95.0, '3-course dinner.', 0],
    [5, 2, 9, 4, 'Colosseum Underground & Gladiator Arena VIP Tour', 'Sightseeing', '09:00', 180, 80.0, 'Passports required.', 0],
    [6, 2, 10, 5, 'Trastevere Sunset Pasta & Wine Making Masterclass', 'Culinary', '17:00', 150, 70.0, 'Fresh pasta making.', 0]
  ];

  for (const ta of tripActivities) {
    await run(`
      INSERT INTO trip_activities (id, trip_stop_id, activity_id, day_number, custom_title, category, start_time, duration_mins, cost, notes, is_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ta);
  }

  // Trip 1 Expenses
  const expenses = [
    [1, 1, 'Flight SFO to Paris CDG', 'Transport', 350.0, '2026-09-01', 'International flight booking'],
    [2, 1, 'Hôtel Le Petit Paris 3 Nights', 'Accommodation', 480.0, '2026-09-01', 'Hotel reservation'],
    [3, 1, 'Dinner at Le Comptoir du Relais', 'Food', 85.0, '2026-09-01', 'French bistro dinner'],
    [4, 1, 'Eiffel Tower Summit tickets', 'Activities', 65.0, '2026-09-01', 'Online booking']
  ];

  for (const exp of expenses) {
    await run(`INSERT INTO expenses (id, trip_id, title, category, amount, expense_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`, exp);
  }

  // Saved Wishlist
  await run(`INSERT INTO saved_destinations (user_id, city_id) VALUES (?, ?)`, [1, 2]); // Tokyo
  await run(`INSERT INTO saved_destinations (user_id, city_id) VALUES (?, ?)`, [1, 11]); // Santorini
  await run(`INSERT INTO saved_destinations (user_id, city_id) VALUES (?, ?)`, [1, 15]); // Zurich

  // Trip Likes
  await run(`INSERT INTO trip_likes (user_id, trip_id) VALUES (?, ?)`, [1, 1]);
  await run(`INSERT INTO trip_likes (user_id, trip_id) VALUES (?, ?)`, [2, 1]);

  console.log('✅ GlobeTrotter database seeded successfully with expanded world cities!');
}

if (process.argv[1] && process.argv[1].endsWith('seedData.js')) {
  seed().catch(err => {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  });
}
