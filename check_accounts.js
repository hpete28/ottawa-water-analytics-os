const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://water-billing.ottawa.ca';

const extractCsrfToken = (cookieStr) => {
    if (!cookieStr) return '';
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
};

async function preloadAccounts() {
    const cookie = process.env.USER_COOKIE;
    const csrfToken = extractCsrfToken(cookie);

    console.log('Fetching Account Selector preload data...');
    try {
        const response = await axios({
            method: 'GET',
            url: `${BASE_URL}/en-ca/API/AdvancedUtility/AccountSelector/selector/preload`,
            headers: {
                Cookie: cookie,
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'RequestVerificationToken': csrfToken,
                moduleid: '2506',
                tabid: '605',
                'Content-Type': 'application/json'
            }
        });

        const data = response.data;
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error(`Status ${e.response?.status}: ${e.message}`);
    }
}

preloadAccounts();
