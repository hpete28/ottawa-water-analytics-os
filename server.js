/**
 * server.js
 * ---------
 * Express REST API for the Ottawa Water Analytics Dashboard.
 *
 * Endpoints:
 *   GET  /api/water-usage          — hourly usage for a date (default: yesterday)
 *   GET  /api/weather              — daily weather for a date range (default: last 30 days)
 *   GET  /api/summary              — month totals, avg daily usage, peak day
 *   POST /api/scrape               — trigger both scrapers on demand
 *
 * Run: node server.js
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDb, getDb } = require('./db/init');
const { fetchAndStoreWaterUsage, fetchAndStoreDateRange } = require('./services/WaterService');
const { fetchAndStoreWeather } = require('./services/WeatherService');
const { analyzeWaterData } = require('./services/AIService');
const { refreshSessionCookie } = require('./services/AuthScraper');

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // bind to all interfaces

// ── Serve built React frontend (production / Tailscale access) ─────────────
const FRONTEND_DIST = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateString(dayOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().split('T')[0];
}

function sendError(res, status, message) {
    return res.status(status).json({ success: false, error: message });
}

// ---------------------------------------------------------------------------
// GET /api/water-usage
// ---------------------------------------------------------------------------
// Query params:
//   date   YYYY-MM-DD (optional, defaults to yesterday)
//
// Returns all 24 hourly rows for the target date.
// ---------------------------------------------------------------------------

app.get('/api/water-usage', async (req, res) => {
    try {
        const date = req.query.date || getDateString(-1);

        // Basic date format validation
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
        }

        const db = await getDb();
        const rows = await db.all(
            'SELECT id, date, hour, consumption_amount FROM water_usage WHERE date = ? ORDER BY hour ASC',
            [date]
        );

        const totalConsumption = rows.reduce((sum, r) => sum + r.consumption_amount, 0);
        const peakHour = rows.length
            ? rows.reduce((max, r) => (r.consumption_amount > max.consumption_amount ? r : max), rows[0])
            : null;

        res.json({
            success: true,
            date,
            count: rows.length,
            totalConsumption: parseFloat(totalConsumption.toFixed(3)),
            peakHour: peakHour ? { hour: peakHour.hour, consumption_amount: peakHour.consumption_amount } : null,
            data: rows,
        });
    } catch (err) {
        console.error('[GET /api/water-usage]', err.message);
        sendError(res, 500, err.message);
    }
});

// ---------------------------------------------------------------------------
// GET /api/weather
// ---------------------------------------------------------------------------
// Query params:
//   start  YYYY-MM-DD (optional, defaults to 30 days ago)
//   end    YYYY-MM-DD (optional, defaults to yesterday)
//
// Returns daily weather_log rows for the given range.
// ---------------------------------------------------------------------------

app.get('/api/weather', async (req, res) => {
    try {
        const start = req.query.start || getDateString(-30);
        const end = req.query.end || getDateString(-1);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
            return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD for start and end.');
        }

        if (start > end) {
            return sendError(res, 400, 'start date must be on or before end date.');
        }

        const db = await getDb();
        const rows = await db.all(
            'SELECT date, max_temp, mean_temp, avg_humidity FROM weather_log WHERE date BETWEEN ? AND ? ORDER BY date ASC',
            [start, end]
        );

        res.json({
            success: true,
            dateRange: { start, end },
            count: rows.length,
            data: rows,
        });
    } catch (err) {
        console.error('[GET /api/weather]', err.message);
        sendError(res, 500, err.message);
    }
});

// ---------------------------------------------------------------------------
// GET /api/daily-usage
// ---------------------------------------------------------------------------
// Query params:
//   start  YYYY-MM-DD
//   end    YYYY-MM-DD
//
// Returns daily water consumption sums for the exact range.
// ---------------------------------------------------------------------------

app.get('/api/daily-usage', async (req, res) => {
    try {
        const start = req.query.start || getDateString(-30);
        const end = req.query.end || getDateString(-1);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
            return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
        }

        const db = await getDb();
        const rows = await db.all(
            `SELECT date, SUM(consumption_amount) as totalConsumption 
             FROM water_usage 
             WHERE date BETWEEN ? AND ? 
             GROUP BY date 
             ORDER BY date ASC`,
            [start, end]
        );

        res.json({
            success: true,
            dateRange: { start, end },
            count: rows.length,
            data: rows,
        });
    } catch (err) {
        console.error('[GET /api/daily-usage]', err.message);
        sendError(res, 500, err.message);
    }
});

// ---------------------------------------------------------------------------
// GET /api/summary
// ---------------------------------------------------------------------------
// Query params:
//   start  YYYY-MM-DD
//   end    YYYY-MM-DD
//
// Returns:
//   totalMonthConsumption  — sum of all usage in the range
//   avgDailyUsage          — average daily total
//   highestUsageDay        — { date, totalConsumption }
//   daysWithData           — number of distinct days scraped
// ---------------------------------------------------------------------------

app.get('/api/summary', async (req, res) => {
    try {
        const start = req.query.start || getDateString(-30);
        const end = req.query.end || getDateString(-1);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
            return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
        }

        const db = await getDb();

        // Total and per-day aggregates
        const dailyTotals = await db.all(
            `SELECT date, SUM(consumption_amount) AS daily_total
             FROM water_usage
             WHERE date BETWEEN ? AND ?
             GROUP BY date
             ORDER BY date ASC`,
            [start, end]
        );

        if (dailyTotals.length === 0) {
            return res.json({
                success: true,
                dateRange: { start, end },
                message: 'No water usage data found for this range. Run the scraper first.',
                totalMonthConsumption: 0,
                avgDailyUsage: 0,
                highestUsageDay: null,
                daysWithData: 0,
                data: [],
            });
        }

        const totalMonthConsumption = dailyTotals.reduce((sum, d) => sum + d.daily_total, 0);
        const avgDailyUsage = totalMonthConsumption / dailyTotals.length;
        const highestUsageDay = dailyTotals.reduce(
            (max, d) => (d.daily_total > max.daily_total ? d : max),
            dailyTotals[0]
        );

        res.json({
            success: true,
            dateRange: { start, end },
            totalMonthConsumption: parseFloat(totalMonthConsumption.toFixed(3)),
            avgDailyUsage: parseFloat(avgDailyUsage.toFixed(3)),
            highestUsageDay: {
                date: highestUsageDay.date,
                totalConsumption: parseFloat(highestUsageDay.daily_total.toFixed(3)),
            },
            daysWithData: dailyTotals.length,
            data: dailyTotals.map(d => ({ date: d.date, totalConsumption: parseFloat(d.daily_total.toFixed(3)) })),
        });
    } catch (err) {
        console.error('[GET /api/summary]', err.message);
        sendError(res, 500, err.message);
    }
});

app.post('/api/scrape', async (req, res) => {
    const body = req.body || {};

    // Support both single `date` (legacy) and `startDate`/`endDate` range
    let startDate = body.startDate || body.date || getDateString(-1);
    let endDate = body.endDate || body.date || getDateString(-1);

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
        return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
    }
    if (startDate > endDate) {
        return sendError(res, 400, 'startDate must be on or before endDate.');
    }

    const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    console.log(`\n🚀  /api/scrape triggered: ${startDate} → ${endDate} (${days} day${days > 1 ? 's' : ''})`);

    const errors = [];
    let waterResults = [];
    let weatherResult = null;

    // ── Water: scrape each day individually (sequential, polite delay built in)
    try {
        waterResults = await fetchAndStoreDateRange(startDate, endDate);
        // Collect any per-day errors
        for (const r of waterResults) {
            if (r.error) errors.push({ service: 'water', date: r.date, message: r.error });
        }
    } catch (err) {
        console.error('  [scrape] Water range error:', err.message);
        errors.push({ service: 'water', message: err.message });
    }

    // ── Weather: fetch the whole range in one API call (much more efficient)
    try {
        weatherResult = await fetchAndStoreWeather(startDate, endDate);
    } catch (err) {
        console.error('  [scrape] Weather error:', err.message);
        errors.push({ service: 'weather', message: err.message });
    }

    // ── Check if we failed solely due to auth/cookie
    const hasOnlyCookieErrors = errors.length > 0 && errors.every(e =>
        /cookie|auth|401|403|expired/i.test(e.message || '')
    );

    // ── Attempt Headless Auth Retry
    if (hasOnlyCookieErrors) {
        console.log('\n🔄 [server] Ottawa API cookie expired. Triggering Headless Auth Retry...');
        try {
            await refreshSessionCookie();

            // Clear previous water errors and try exactly once more
            errors.length = 0;
            console.log('🔄 [server] Retrying Water fetch with new cookie...');
            waterResults = await fetchAndStoreDateRange(startDate, endDate);

            for (const r of waterResults) {
                if (r.error) errors.push({ service: 'water', date: r.date, message: r.error });
            }
        } catch (authErr) {
            console.error('❌ [server] Headless Auth failed:', authErr.message);
            errors.push({ service: 'auth', message: 'Automated login failed. Please check OTTAWA_EMAIL and OTTAWA_PASSWORD in .env.' });
        }
    }

    const finalHasOnlyCookieErrors = errors.every(e =>
        /cookie|auth|401|403|expired/i.test(e.message || '')
    );

    const success = errors.length === 0;
    res.status(success ? 200 : 207).json({
        success,
        dateRange: { start: startDate, end: endDate, days },
        results: waterResults,
        weather: weatherResult,
        errors,
        // Flag so the frontend can detect expired cookie without string parsing
        cookieExpired: !success && finalHasOnlyCookieErrors,
    });
});

// ---------------------------------------------------------------------------
// POST /api/insights
// ---------------------------------------------------------------------------
// Query params:
//   Local JSON Body: { startDate: YYYY-MM-DD, endDate: YYYY-MM-DD }
//
// Returns a markdown string generated by Google Gemini analyzing 
// the given date range's water and weather correlation.
// ---------------------------------------------------------------------------

app.post('/api/insights', async (req, res) => {
    try {
        const body = req.body || {};
        let startDate = body.startDate || getDateString(-30);
        let endDate = body.endDate || getDateString(-1);

        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
            return sendError(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
        }

        const db = await getDb();

        // Fetch aggregated water totals for the range
        const waterLog = await db.all(
            `SELECT date, SUM(consumption_amount) AS daily_total
             FROM water_usage
             WHERE date BETWEEN ? AND ?
             GROUP BY date
             ORDER BY date ASC`,
            [startDate, endDate]
        );

        // Fetch weather for the range
        const weatherLog = await db.all(
            'SELECT date, max_temp, mean_temp, avg_humidity FROM weather_log WHERE date BETWEEN ? AND ? ORDER BY date ASC',
            [startDate, endDate]
        );

        if (waterLog.length === 0) {
            return sendError(res, 404, 'No water data found for the selected range to analyze.');
        }

        // Send to Gemini
        const markdownReport = await analyzeWaterData(startDate, endDate, waterLog, weatherLog);

        res.json({ success: true, report: markdownReport });

    } catch (err) {
        console.error('[POST /api/insights]', err.message);
        sendError(res, 500, err.message);
    }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// SPA fallback — serve index.html for any non-API route
// (enables React Router and direct URL access to the dashboard)
// ---------------------------------------------------------------------------

app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
        if (err) {
            // frontend/dist not built yet — guide the user
            res.status(404).json({
                error: 'Frontend not built. Run: cd frontend && npm run build',
            });
        }
    });
});

// ---------------------------------------------------------------------------
// Start server (after DB is initialized)
// ---------------------------------------------------------------------------

initDb()
    .then(() => {
        app.listen(PORT, HOST, () => {
            console.log(`\n🚀  Ottawa Water Analytics API running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
            console.log(`    📶  Tailscale / LAN URL : http://100.100.159.67:${PORT}`);
            console.log(`    GET  /api/water-usage`);
            console.log(`    GET  /api/weather`);
            console.log(`    GET  /api/summary`);
            console.log(`    POST /api/scrape`);
            console.log(`    GET  /api/health`);
        });
    })
    .catch((err) => {
        console.error('❌  Failed to start server:', err.message);
        process.exit(1);
    });

module.exports = app; // export for testing
