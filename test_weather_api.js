/**
 * test_weather_api.js
 * -------------------
 * Phase 2 connectivity test for the Open-Meteo Historical Weather API.
 *
 * Purpose: Verify that we can fetch historical daily weather data for Ottawa
 * (latitude 45.4215, longitude -75.6972) using the free Open-Meteo API.
 * No API key required.
 *
 * Variables fetched:
 *   - temperature_2m_max   (°C) — Daily maximum temperature at 2m
 *   - temperature_2m_mean  (°C) — Daily mean temperature at 2m
 *   - relative_humidity_2m_mean (%) — Daily mean relative humidity at 2m
 *
 * Run: node test_weather_api.js
 */

const axios = require('axios');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OTTAWA_LAT = 45.4215;
const OTTAWA_LON = -75.6972;
const OPEN_METEO_URL = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * Returns a date string in YYYY-MM-DD format, offset by `dayOffset` days
 * from today (negative = past).
 */
function getDateString(dayOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().split('T')[0];
}

// Fetch the last 7 days (ending yesterday, since today is incomplete).
const endDate = getDateString(-1);
const startDate = getDateString(-7);

// ---------------------------------------------------------------------------
// Main request
// ---------------------------------------------------------------------------

(async () => {
    console.log('🌤️   Testing connection to Open-Meteo Historical Weather API...');
    console.log(`    Location : Ottawa, ON (lat=${OTTAWA_LAT}, lon=${OTTAWA_LON})`);
    console.log(`    Date range: ${startDate}  →  ${endDate}`);
    console.log(`    Endpoint : ${OPEN_METEO_URL}`);
    console.log('');

    try {
        const response = await axios.get(OPEN_METEO_URL, {
            params: {
                latitude: OTTAWA_LAT,
                longitude: OTTAWA_LON,
                start_date: startDate,
                end_date: endDate,
                daily: [
                    'temperature_2m_max',
                    'temperature_2m_mean',
                    'relative_humidity_2m_mean',
                ].join(','),
                timezone: 'America/Toronto',
            },
            timeout: 15000,
        });

        const data = response.data;
        const daily = data.daily;

        if (
            daily &&
            Array.isArray(daily.time) &&
            Array.isArray(daily.temperature_2m_max) &&
            Array.isArray(daily.temperature_2m_mean) &&
            Array.isArray(daily.relative_humidity_2m_mean)
        ) {
            console.log('✅  SUCCESS — Historical weather data received.');
            console.log(`    Records returned : ${daily.time.length} days`);
            console.log('');
            console.log(
                '📅  Date            | Max Temp (°C) | Mean Temp (°C) | Mean Humidity (%)'
            );
            console.log(
                '    ----------------|---------------|----------------|-------------------'
            );

            for (let i = 0; i < daily.time.length; i++) {
                const date = daily.time[i];
                const maxTemp = daily.temperature_2m_max[i] !== null ? daily.temperature_2m_max[i].toFixed(1) : 'N/A';
                const meanTemp = daily.temperature_2m_mean[i] !== null ? daily.temperature_2m_mean[i].toFixed(1) : 'N/A';
                const humidity = daily.relative_humidity_2m_mean[i] !== null ? daily.relative_humidity_2m_mean[i].toFixed(1) : 'N/A';

                console.log(
                    `    ${date}  |     ${String(maxTemp).padStart(6)}      |     ${String(meanTemp).padStart(6)}       |     ${String(humidity).padStart(6)}`
                );
            }

            console.log('');
            console.log('🎯  Schema check: These three fields map directly to the `weather_log` table:');
            console.log('    temperature_2m_max   → max_temp');
            console.log('    temperature_2m_mean  → mean_temp');
            console.log('    relative_humidity_2m_mean → avg_humidity');
        } else {
            console.warn('⚠️   WARNING: Response received but structure is unexpected.');
            console.warn('    Raw response (first 500 chars):');
            console.warn('   ', JSON.stringify(data).substring(0, 500));
        }
    } catch (error) {
        if (error.response) {
            console.error(`❌  HTTP ERROR (${error.response.status}): ${error.response.statusText}`);
            console.error('    Response body:', JSON.stringify(error.response.data).substring(0, 300));
        } else if (error.code === 'ECONNABORTED') {
            console.error('❌  TIMEOUT: The request timed out after 15 seconds.');
            console.error('   → Check your internet connection or try again later.');
        } else {
            console.error('❌  NETWORK ERROR:', error.message);
        }
        process.exit(1);
    }
})();
