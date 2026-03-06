/**
 * services/WaterService.js
 * ------------------------
 * Fetches hourly water usage from the Ottawa Water Portal and stores it in SQLite.
 *
 * Key mapping (real API response, confirmed 2026-03-05):
 *   Data.hourlyUsages[{ axisX: "8 AM", axisY: 0.046 }]
 *   axisX → hour integer (0-23) via parseHourLabel()
 *   axisY → consumption_amount (m³)
 *
 * Exports:
 *   fetchAndStoreWaterUsage(date?)  — fetches one day, defaults to yesterday
 *   fetchAndStoreDateRange(startDate, endDate) — fetches a range of days
 */

require('dotenv').config();
const axios = require('axios');
const { getDb, initDb } = require('../db/init');

// ---------------------------------------------------------------------------
// Config from .env
// ---------------------------------------------------------------------------

const COOKIE = process.env.USER_COOKIE;
const METER_NUMBER = process.env.METER_NUMBER || '21385413';
const SERVICE_CODE = process.env.SERVICE_CODE || '30';
const SERVICE_DESC = process.env.SERVICE_DESC || 'Water';
const MODULE_ID = process.env.MODULE_ID || '480';
const TAB_ID = process.env.TAB_ID || '88';

const BASE_URL = 'https://water-billing.ottawa.ca';
const HOURLY_URL = `${BASE_URL}/en-ca/API/AdvancedUtility/UsageHistory/summary/GetHourlyUsage`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a YYYY-MM-DD string offset by `dayOffset` from today.
 * dayOffset=-1 → yesterday (default fetch target).
 */
function getDateString(dayOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().split('T')[0];
}

/**
 * Convert the API's axisX label to a 0-23 integer hour.
 * "12 AM" → 0, "1 AM" → 1, ..., "12 PM" → 12, "1 PM" → 13, "11 PM" → 23
 */
function parseHourLabel(label) {
    if (!label) return null;
    const upper = label.trim().toUpperCase();
    const [timePart, period] = upper.split(' ');
    let hour = parseInt(timePart, 10);

    if (period === 'AM') {
        if (hour === 12) hour = 0; // 12 AM → midnight (0)
    } else if (period === 'PM') {
        if (hour !== 12) hour += 12; // 1 PM → 13, but 12 PM stays 12
    }

    return hour;
}

/**
 * Extract __RequestVerificationToken from cookie string.
 */
function extractCsrfToken(cookieStr) {
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
}

// ---------------------------------------------------------------------------
// Core fetch function
// ---------------------------------------------------------------------------

/**
 * Fetches hourly usage for a single date from the Ottawa Water Portal
 * and inserts / replaces rows into the water_usage table.
 *
 * @param {string} date - YYYY-MM-DD. Defaults to yesterday.
 * @returns {Promise<{ date, rowsInserted, totalConsumption }>}
 */
async function fetchAndStoreWaterUsage(date) {
    const targetDate = date || getDateString(-1);

    if (!COOKIE || COOKIE === 'your_cookie_here') {
        throw new Error('USER_COOKIE is not set. Update .env with a valid session cookie.');
    }

    console.log(`💧  WaterService: fetching hourly usage for ${targetDate}...`);

    // -----------------------------------------------------------------------
    // Fetch from Ottawa Water Portal
    // -----------------------------------------------------------------------
    const csrfToken = extractCsrfToken(COOKIE);

    let hourlyUsages;
    try {
        const response = await axios.get(HOURLY_URL, {
            params: {
                date: targetDate,
                serviceCode: SERVICE_CODE,
                showGraphicChart: true,
                serviceDesc: SERVICE_DESC,
                serviceUnit: '',
                meterNumber: METER_NUMBER,
            },
            headers: {
                Cookie: COOKIE,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                Accept: '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-CA,en-US;q=0.9,en;q=0.7',
                Referer: `${BASE_URL}/en-ca/my-account/usage`,
                'X-Requested-With': 'XMLHttpRequest',
                'RequestVerificationToken': csrfToken,
                moduleid: MODULE_ID,
                tabid: TAB_ID,
            },
            timeout: 15000,
        });

        const json = response.data;

        // 🛑 Bug Fix: Ottawa Water Portal returns 200 OK + HTML when cookies expire during a long loop
        if (typeof json === 'string' && json.toLowerCase().includes('<!doctype html>')) {
            throw new Error('Auth error: Session cookie has expired and redirected to HTML login. Triggering auto-retry.');
        }

        if (!json?.Success) {
            const msg = json?.Exception || json?.Feedback || 'Unknown API error';
            throw new Error(`Ottawa Water API returned Success=false: ${msg}`);
        }

        hourlyUsages = json.Data?.hourlyUsages;

        if (!Array.isArray(hourlyUsages)) {
            throw new Error('API response missing Data.hourlyUsages array');
        }

    } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
            throw new Error(
                `Auth error (HTTP ${err.response.status}). Session cookie has expired. Update USER_COOKIE in .env.`
            );
        }
        throw err; // re-throw network errors
    }

    // -----------------------------------------------------------------------
    // Insert into SQLite
    // -----------------------------------------------------------------------
    const db = await initDb();

    let rowsInserted = 0;
    let totalConsumption = 0;

    const stmt = await db.prepare(`
        INSERT OR REPLACE INTO water_usage (date, hour, consumption_amount)
        VALUES (?, ?, ?)
    `);

    for (const entry of hourlyUsages) {
        const hour = parseHourLabel(entry.axisX);
        const usage = entry.axisY ?? 0;

        if (hour === null) {
            console.warn(`    ⚠️  Could not parse hour label: "${entry.axisX}" — skipping`);
            continue;
        }

        await stmt.run(targetDate, hour, usage);
        totalConsumption += usage;
        rowsInserted++;
    }

    await stmt.finalize();

    console.log(`    ✅  ${rowsInserted} rows inserted for ${targetDate} | Total: ${totalConsumption.toFixed(3)} m³`);

    return { date: targetDate, rowsInserted, totalConsumption };
}

/**
 * Adds 1 day to a YYYY-MM-DD string safely without local timezone interference.
 */
function addOneDay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    return nextDate.toISOString().split('T')[0];
}

/**
 * Fetches and stores water usage for every day in [startDate, endDate] inclusive.
 * Adds a polite 500ms delay between requests to avoid rate limits.
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 */
async function fetchAndStoreDateRange(startDate, endDate) {
    const results = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
        try {
            const result = await fetchAndStoreWaterUsage(currentDate);
            results.push(result);
        } catch (err) {
            console.error(`    ❌  Error for ${currentDate}: ${err.message}`);
            results.push({ date: currentDate, error: err.message });
        }

        // Polite delay between requests
        await new Promise((resolve) => setTimeout(resolve, 500));

        currentDate = addOneDay(currentDate);
    }

    return results;
}

// ---------------------------------------------------------------------------
// Standalone test: node services/WaterService.js
// ---------------------------------------------------------------------------

if (require.main === module) {
    fetchAndStoreWaterUsage()
        .then((result) => {
            console.log('\n📊  Result:', result);
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ ', err.message);
            process.exit(1);
        });
}

module.exports = { fetchAndStoreWaterUsage, fetchAndStoreDateRange };
