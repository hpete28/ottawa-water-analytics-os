/**
 * test_water_api.js
 * -----------------
 * Phase 2 connectivity test for the Ottawa Water Portal.
 *
 * REAL ENDPOINT (discovered via DevTools on 2026-03-05):
 *   GET https://water-billing.ottawa.ca/en-ca/API/AdvancedUtility/UsageHistory/summary/GetHourlyUsage
 *
 * REAL RESPONSE SHAPE:
 *   {
 *     Success: true,
 *     Data: {
 *       hourlyUsages: [{ axisX: "1 AM", axisY: 0.041, date: null, tag: null }, ...]
 *       dailyUsages: null,  // populated when calling the daily endpoint
 *     }
 *   }
 *
 * Run: node test_water_api.js
 */

require('dotenv').config();
const axios = require('axios');

// ---------------------------------------------------------------------------
// Load config from .env
// ---------------------------------------------------------------------------

const COOKIE = process.env.USER_COOKIE;
const METER_NUMBER = process.env.METER_NUMBER || '21385413';
const SERVICE_CODE = process.env.SERVICE_CODE || '30';
const SERVICE_DESC = process.env.SERVICE_DESC || 'Water';
const MODULE_ID = process.env.MODULE_ID || '480';
const TAB_ID = process.env.TAB_ID || '88';

// ---------------------------------------------------------------------------
// Guard: missing or un-filled cookie
// ---------------------------------------------------------------------------

if (!COOKIE || COOKIE === 'your_cookie_here') {
    console.error('❌  ERROR: USER_COOKIE is missing or still set to the placeholder value.');
    console.error('   → Open .env and paste your real Ottawa Water Portal cookie string.');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Endpoint configuration (confirmed from DevTools)
// ---------------------------------------------------------------------------

const BASE_URL = 'https://water-billing.ottawa.ca';
const HOURLY_URL = `${BASE_URL}/en-ca/API/AdvancedUtility/UsageHistory/summary/GetHourlyUsage`;

// Extract __RequestVerificationToken from the cookie string (DNN double-submit CSRF pattern)
const extractCsrfToken = (cookieStr) => {
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
};

// Use yesterday's date as the default test date (today's data is often incomplete)
const getTestDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0]; // e.g. "2026-03-04"
};

// ---------------------------------------------------------------------------
// Main request
// ---------------------------------------------------------------------------

(async () => {
    const testDate = getTestDate();
    const csrfToken = extractCsrfToken(COOKIE);

    console.log('🔍  Testing connection to Ottawa Water Portal API...');
    console.log(`    Endpoint    : ${HOURLY_URL}`);
    console.log(`    Meter       : ${METER_NUMBER}`);
    console.log(`    Date        : ${testDate}`);
    console.log(`    ServiceCode : ${SERVICE_CODE}`);
    console.log(`    CSRF Token  : ${csrfToken ? csrfToken.substring(0, 20) + '...' : '⚠️  not found in cookie'}`);
    console.log('');

    try {
        const response = await axios.get(HOURLY_URL, {
            params: {
                date: testDate,
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

        // ---------------------------------------------------------------
        // Validate response structure
        // ---------------------------------------------------------------

        if (!json || !json.Success) {
            console.warn('⚠️   WARNING: Response received but Success=false.');
            console.warn('    This usually means the session has expired or params are wrong.');
            console.warn('    Raw response:', JSON.stringify(json).substring(0, 400));
            return;
        }

        const hourlyUsages = json.Data?.hourlyUsages;

        if (!Array.isArray(hourlyUsages) || hourlyUsages.length === 0) {
            console.warn('⚠️   WARNING: Success=true but hourlyUsages is empty or null.');
            console.warn('    The meter may not have hourly data for this date.');
            console.warn('    Raw Data:', JSON.stringify(json.Data).substring(0, 400));
            return;
        }

        // ---------------------------------------------------------------
        // SUCCESS — print formatted table
        // ---------------------------------------------------------------

        console.log(`✅  SUCCESS — hourly water data received for ${testDate}!`);
        console.log(`    ${hourlyUsages.length} hourly records returned.`);
        console.log('');

        const totalUsage = hourlyUsages.reduce((sum, h) => sum + (h.axisY ?? 0), 0);
        const peakHour = hourlyUsages.reduce((max, h) => ((h.axisY ?? 0) > (max.axisY ?? 0) ? h : max), hourlyUsages[0]);

        console.log('🕐  Hourly Breakdown:');
        console.log('    Hour    | Usage (m³)');
        console.log('    --------|----------');
        for (const h of hourlyUsages) {
            const val = h.axisY ?? 0;
            const bar = '█'.repeat(Math.round(val * 100));
            const usage = val.toFixed(3).padStart(6);
            console.log(`    ${h.axisX.padEnd(7)} | ${usage}  ${bar}`);
        }

        console.log('');
        console.log(`💧  Daily Total   : ${totalUsage.toFixed(3)} m³`);
        console.log(`📈  Peak Hour     : ${peakHour.axisX} (${(peakHour.axisY ?? 0).toFixed(3)} m³)`);
        console.log('');
        console.log('🎯  Schema confirmed — these fields map to water_usage table:');
        console.log('    date    → (use the query param date)');
        console.log('    axisX   → hour_label');
        console.log('    axisY   → usage_m3');

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            if (status === 401 || status === 403) {
                console.error(`❌  AUTH ERROR (HTTP ${status}): The session cookie has expired.`);
                console.error('   → Log in at https://water-billing.ottawa.ca and copy a fresh cookie from DevTools.');
            } else if (status === 302 || status === 301) {
                console.error(`❌  REDIRECT (HTTP ${status}) → ${error.response.headers.location}`);
                console.error('   → Session expired — grab a fresh cookie from DevTools.');
            } else {
                console.error(`❌  HTTP ERROR (${status}): ${error.response.statusText}`);
            }
        } else if (error.code === 'ECONNABORTED') {
            console.error('❌  TIMEOUT: Request timed out after 15 seconds.');
        } else {
            console.error('❌  NETWORK ERROR:', error.message);
        }
        process.exit(1);
    }
})();
