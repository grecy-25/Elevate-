import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'globetrotter.db');

let SQL;
let dbInstance = null;

// Initialize SQLite engine
export async function getDb() {
  if (dbInstance) return dbInstance;

  SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');
  return dbInstance;
}

// Persist the in-memory SQLite database to disk file
export function persistDb() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper: Run a query and return array of mapped objects
export async function query(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: Run a query and return single record
export async function get(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper: Run an INSERT / UPDATE / DELETE statement
export async function run(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
  
  // Get last insert rowid and changes count
  const lastIdRes = db.exec("SELECT last_insert_rowid() as id, changes() as changes;");
  const lastInsertRowid = (lastIdRes.length && lastIdRes[0].values.length) ? lastIdRes[0].values[0][0] : null;
  const changes = (lastIdRes.length && lastIdRes[0].values.length) ? lastIdRes[0].values[0][1] : 0;
  
  // Auto-persist changes to disk
  persistDb();
  
  return { lastInsertRowid, changes };
}

// Helper: Execute raw multi-statement SQL
export async function exec(sql) {
  const db = await getDb();
  db.exec(sql);
  persistDb();
}

export async function initDatabase() {
  const db = await getDb();
  const schema = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      city TEXT,
      country TEXT,
      bio TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      currency TEXT DEFAULT 'USD',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cities Table (Global destinations)
    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      cost_index INTEGER DEFAULT 2 CHECK(cost_index BETWEEN 1 AND 4),
      popularity_rating REAL DEFAULT 4.5,
      best_season TEXT,
      currency_symbol TEXT DEFAULT '$',
      latitude REAL,
      longitude REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Activities Table (Curated catalog)
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL DEFAULT 0.0,
      duration_mins INTEGER DEFAULT 120,
      description TEXT,
      image_url TEXT,
      rating REAL DEFAULT 4.8,
      location_name TEXT,
      FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
    );

    -- Trips Table
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      budget_allocated REAL DEFAULT 0.0,
      cover_image TEXT,
      travel_style TEXT DEFAULT 'Explorer',
      is_public INTEGER DEFAULT 0,
      share_slug TEXT UNIQUE,
      views_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Trip Stops Table (Cities in a multi-city trip)
    CREATE TABLE IF NOT EXISTS trip_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      city_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      arrival_date DATE NOT NULL,
      departure_date DATE NOT NULL,
      accommodation_name TEXT,
      accommodation_cost REAL DEFAULT 0.0,
      transport_mode TEXT DEFAULT 'Flight',
      transport_cost REAL DEFAULT 0.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT
    );

    -- Trip Scheduled Activities Table (Day-wise activities in a stop)
    CREATE TABLE IF NOT EXISTS trip_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_stop_id INTEGER NOT NULL,
      activity_id INTEGER,
      day_number INTEGER NOT NULL DEFAULT 1,
      custom_title TEXT NOT NULL,
      category TEXT DEFAULT 'Sightseeing',
      start_time TEXT DEFAULT '10:00',
      duration_mins INTEGER DEFAULT 120,
      cost REAL DEFAULT 0.0,
      notes TEXT,
      is_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_stop_id) REFERENCES trip_stops(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
    );

    -- Expenses Table (Financial tracking / budget breakdown)
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    -- Saved / Wishlist Destinations Table
    CREATE TABLE IF NOT EXISTS saved_destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      city_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, city_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
    );

    -- Trip Likes Table (Community engagement)
    CREATE TABLE IF NOT EXISTS trip_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      trip_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, trip_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
  `;

  db.exec(schema);
  persistDb();
  console.log('✅ SQLite Database schema initialized with all relational tables.');
}

export default {
  getDb,
  query,
  get,
  run,
  exec,
  persistDb,
  initDatabase
};
