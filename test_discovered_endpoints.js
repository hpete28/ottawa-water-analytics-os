const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = 'https://water-billing.ottawa.ca';

const extractCsrfToken = (cookieStr) => {
    if (!cookieStr) return '';
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
};

async function testDiscovered() {
    const COOKIE = process.env.USER_COOKIE;
    const csrfToken = extractCsrfToken(COOKIE);

    const endpoints = JSON.parse(fs.readFileSync('usage_endpoints_all.json', 'utf8'));

    // Filter to only /API/AdvancedUtility calls
    const apis = endpoints.filter(e => e.url.includes('/API/AdvancedUtility/'));

    for (const api of apis) {
        // Skip preload and module initializations which we already know about
        if (api.url.includes('preload') || api.url.includes('GetModuleInitializationData')) continue;

        console.log(`\nTesting ${api.method} ${api.url}`);
        try {
            const config = {
                method: api.method,
                url: api.url,
                headers: {
                    Cookie: COOKIE,
                    'User-Agent': 'Mozilla/5.0',
                    Accept: '*/*',
                    'X-Requested-With': 'XMLHttpRequest',
                    'RequestVerificationToken': csrfToken,
                    moduleid: process.env.MODULE_ID || '2506', // 2506 is the account selector module, but we'll try default 480 
                    tabid: process.env.TAB_ID || '88',
                }
            };

            if (api.postData) {
                config.data = api.postData;
                config.headers['Content-Type'] = 'application/json';
            }

            const response = await axios(config);

            if (response.data && response.data.Data) {
                console.log(`SUCCESS! Extracted Data:`);
                console.log(JSON.stringify(response.data.Data, null, 2).substring(0, 1000));
            } else {
                console.log('Success, but no .Data field:', JSON.stringify(response.data).substring(0, 200));
            }

        } catch (e) {
            console.error(`Status ${e.response?.status}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

testDiscovered();
