const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://water-billing.ottawa.ca';

const extractCsrfToken = (cookieStr) => {
    if (!cookieStr) return '';
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
};

async function testDailySummary() {
    const COOKIE = process.env.USER_COOKIE;
    const csrfToken = extractCsrfToken(COOKIE);

    console.log(`Testing UsageHistory GET HOUR DATA with TargetDate...`);
    try {
        const response = await axios.get(`${BASE_URL}/en-ca/API/AdvancedUtility/UsageHistory/summary/data`, {
            params: {
                meterNumber: process.env.METER_NUMBER || '21385413',
                serviceCode: process.env.SERVICE_CODE || '30',
                serviceDesc: process.env.SERVICE_DESC || 'Water',
                startDate: '2025-12-01',
                endDate: '2026-03-01',
                resolution: 'Day',
                unitType: 'Cons'
            },
            headers: {
                Cookie: COOKIE,
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'RequestVerificationToken': csrfToken,
                moduleid: process.env.MODULE_ID || '480',
                tabid: process.env.TAB_ID || '88',
            }
        });

        if (response.data && response.data.Data) {
            console.log(JSON.stringify(response.data.Data, null, 2).substring(0, 1000));
        } else {
            console.log("No data found.", response.data);
        }
    } catch (e) {
        console.error(`Status ${e.response?.status}: ${e.message}`);
    }
}

testDailySummary();
