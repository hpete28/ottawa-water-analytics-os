/**
 * services/WeatherService.js
 * --------------------------
 * Fetches historical daily weather data from Open-Meteo for Ottawa, ON
 * and stores it in the weather_log SQLite table.
 *
 * Ottawa coordinates: Lat 45.4215, Lon -75.6972, TZ America/Toronto
 *
 * Exports:
 *   fetchAndStoreWeather(startDate?, endDate?)  — defaults to last 7 days
 */

require('dotenv').config();
const axios = require('axios');
const { getDb, initDb } = require('../db/init');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OTTAWA_LAT = 45.4215;
const OTTAWA_LON = -75.6972;
const TIMEZONE = 'America/Toronto';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

const DAILY_VARIABLES = [
    'temperature_2m_max',
    'temperature_2m_mean',
    'relative_humidity_2m_mean',
].join(',');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateString(dayOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Core fetch + store function
// ---------------------------------------------------------------------------

/**
 * Fetches daily weather data from Open-Meteo for the given date range
 * and inserts / replaces rows in the weather_log table.
 *
 * @param {string} startDate - YYYY-MM-DD (default: 7 days ago)
 * @param {string} endDate   - YYYY-MM-DD (default: yesterday)
 * @returns {Promise<{ rowsInserted, dateRange }>}
 */
async function fetchAndStoreWeather(startDate, endDate) {
    // Open-Meteo archive lags by ~1 day; use yesterday as default end
    const resolvedEnd = endDate || getDateString(-1);
    const resolvedStart = startDate || getDateString(-7);

    console.log(`🌤️   WeatherService: fetching weather ${resolvedStart} → ${resolvedEnd}...`);

    // -----------------------------------------------------------------------
    // Fetch from Open-Meteo
    // -----------------------------------------------------------------------
    let daily;
    try {
        const response = await axios.get(ARCHIVE_URL, {
            params: {
                latitude: OTTAWA_LAT,
                longitude: OTTAWA_LON,
                start_date: resolvedStart,
                end_date: resolvedEnd,
                daily: DAILY_VARIABLES,
                timezone: TIMEZONE,
            },
            timeout: 15000,
        });

        daily = response.data?.daily;

        if (
            !daily ||
            !Array.isArray(daily.time) ||
            !Array.isArray(daily.temperature_2m_max) ||
            !Array.isArray(daily.temperature_2m_mean) ||
            !Array.isArray(daily.relative_humidity_2m_mean)
        ) {
            throw new Error('Open-Meteo response is missing expected daily arrays');
        }

    } catch (err) {
        if (err.response) {
            throw new Error(`Open-Meteo API error (HTTP ${err.response.status}): ${JSON.stringify(err.response.data).substring(0, 200)}`);
        }
        throw err;
    }

    // -----------------------------------------------------------------------
    // Insert into SQLite
    // -----------------------------------------------------------------------
    const db = await initDb();

    const stmt = await db.prepare(`
        INSERT OR REPLACE INTO weather_log (date, max_temp, mean_temp, avg_humidity)
        VALUES (?, ?, ?, ?)
    `);

    let rowsInserted = 0;

    for (let i = 0; i < daily.time.length; i++) {
        const date = daily.time[i];
        const maxTemp = daily.temperature_2m_max[i] ?? null;
        const meanTemp = daily.temperature_2m_mean[i] ?? null;
        const avgHumidity = daily.relative_humidity_2m_mean[i] ?? null;

        await stmt.run(date, maxTemp, meanTemp, avgHumidity);
        rowsInserted++;

        console.log(
            `    [${date}]  max=${maxTemp !== null ? maxTemp.toFixed(1) + '°C' : 'N/A'}` +
            `  mean=${meanTemp !== null ? meanTemp.toFixed(1) + '°C' : 'N/A'}` +
            `  humidity=${avgHumidity !== null ? avgHumidity.toFixed(1) + '%' : 'N/A'}`
        );
    }

    await stmt.finalize();

    console.log(`    ✅  ${rowsInserted} weather rows stored (${resolvedStart} → ${resolvedEnd})`);

    return { rowsInserted, dateRange: { start: resolvedStart, end: resolvedEnd } };
}

// ---------------------------------------------------------------------------
// Standalone test: node services/WeatherService.js
// ---------------------------------------------------------------------------

if (require.main === module) {
    fetchAndStoreWeather()
        .then((result) => {
            console.log('\n📊  Result:', result);
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ ', err.message);
            process.exit(1);
        });
}

module.exports = { fetchAndStoreWeather };
