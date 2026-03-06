/**
 * db/init.js
 * ----------
 * Initializes the SQLite database for Ottawa Water Analytics.
 *
 * Exports:
 *   initDb()  — Creates tables, safe to call multiple times (IF NOT EXISTS)
 *   getDb()   — Returns the open database singleton (initializes if needed)
 *
 * Run standalone to create the DB file:
 *   node db/init.js
 */

const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

// ---------------------------------------------------------------------------
// Database file location — project root
// ---------------------------------------------------------------------------

const DB_PATH = path.join(__dirname, '..', 'water_analytics.db');

let _db = null; // singleton instance

// ---------------------------------------------------------------------------
// getDb — open (or reuse) the DB connection
// ---------------------------------------------------------------------------

async function getDb() {
    if (_db) return _db;

    _db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
    });

    // Enable WAL mode for better concurrent write performance
    await _db.run('PRAGMA journal_mode = WAL');
    await _db.run('PRAGMA foreign_keys = ON');

    return _db;
}

// ---------------------------------------------------------------------------
// initDb — create tables if they don't already exist
// ---------------------------------------------------------------------------

async function initDb() {
    const db = await getDb();

    // -----------------------------------------------------------------------
    // Table: water_usage
    // Stores hourly water consumption scraped from the Ottawa Water Portal.
    // UNIQUE(date, hour) ensures the scraper is idempotent.
    // -----------------------------------------------------------------------
    await db.run(`
        CREATE TABLE IF NOT EXISTS water_usage (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            date               TEXT    NOT NULL,
            hour               INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
            consumption_amount REAL    NOT NULL DEFAULT 0,
            UNIQUE(date, hour)
        )
    `);

    // -----------------------------------------------------------------------
    // Table: weather_log
    // Stores one row per day from the Open-Meteo Historical API.
    // date is the PRIMARY KEY so INSERT OR REPLACE is idempotent.
    // -----------------------------------------------------------------------
    await db.run(`
        CREATE TABLE IF NOT EXISTS weather_log (
            date         TEXT PRIMARY KEY,
            max_temp     REAL,
            mean_temp    REAL,
            avg_humidity REAL
        )
    `);

    console.log(`✅  Database initialized at: ${DB_PATH}`);
    console.log('    Tables ready: water_usage, weather_log');

    return db;
}

// ---------------------------------------------------------------------------
// Standalone execution: node db/init.js
// ---------------------------------------------------------------------------

if (require.main === module) {
    initDb()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('❌  Failed to initialize database:', err.message);
            process.exit(1);
        });
}

module.exports = { getDb, initDb };
