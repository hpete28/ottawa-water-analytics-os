const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = 'https://water-billing.ottawa.ca';

const extractCsrfToken = (cookieStr) => {
    if (!cookieStr) return '';
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
};

async function testEndpoint(urlPath, method = 'GET', data = null) {
    const cookie = process.env.USER_COOKIE;
    const csrfToken = extractCsrfToken(cookie);

    console.log(`\nTesting ${urlPath}...`);
    try {
        const response = await axios({
            method,
            url: `${BASE_URL}${urlPath}`,
            data,
            headers: {
                Cookie: cookie,
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'RequestVerificationToken': csrfToken,
                moduleid: process.env.MODULE_ID || '480',
                tabid: process.env.TAB_ID || '88',
                'Content-Type': 'application/json'
            }
        });

        console.log(`Success! Data length: ${JSON.stringify(response.data).length}`);
        let preview = response.data;
        if (typeof preview === 'object' && preview.Data) preview = preview.Data;
        console.log(JSON.stringify(preview).substring(0, 300) + '...');
        return preview;
    } catch (e) {
        console.error(`Status ${e.response?.status}: ${e.message}`);
        return null;
    }
}

async function run() {
    const guesses = [
        '/en-ca/API/AdvancedUtility/UsageHistory/summary/GetDailyUsage',
        '/en-ca/API/AdvancedUtility/UsageHistory/summary/Data',
        '/en-ca/API/AdvancedUtility/BillingHistory/summary/data',
        '/en-ca/API/AdvancedUtility/BillingHistory/data',
        '/en-ca/API/AdvancedUtility/Transactions/data',
        '/en-ca/API/AdvancedUtility/Invoice/data',
        '/en-ca/API/AdvancedUtility/BillingSummary/data',
        '/en-ca/API/AdvancedUtility/Financial/data'
    ];

    for (const guess of guesses) {
        await testEndpoint(guess);
        await new Promise(r => setTimeout(r, 1000));
    }

    // Test POST to GetHourlyUsage with different date range just to see if we can get Daily grouping
    console.log('\nTesting POST to UsageHistory/summary/GetHourlyUsage with different data?');
}
run();
