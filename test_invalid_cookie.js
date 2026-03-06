const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://water-billing.ottawa.ca';
const HOURLY_URL = `${BASE_URL}/en-ca/API/AdvancedUtility/UsageHistory/summary/GetHourlyUsage`;

async function run() {
    try {
        const response = await axios.get(HOURLY_URL, {
            params: {
                date: '2026-03-01',
                serviceCode: process.env.SERVICE_CODE || '30',
                showGraphicChart: true,
                serviceDesc: process.env.SERVICE_DESC || 'Water',
                serviceUnit: '',
                meterNumber: process.env.METER_NUMBER || '21385413',
            },
            headers: {
                Cookie: 'ASP.NET_SessionId=invalidcookie123; visid_incap_123=abc; incap_ses_123=def',
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                moduleid: process.env.MODULE_ID || '480',
                tabid: process.env.TAB_ID || '88',
            },
            validateStatus: () => true // Accept all statuses
        });

        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('Data Preview:', typeof response.data === 'string' ? response.data.substring(0, 200) : response.data);
    } catch (e) {
        console.error(e.message);
    }
}
run();
