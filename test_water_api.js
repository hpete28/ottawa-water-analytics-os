const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = 'https://water-billing.ottawa.ca';
const HOURLY_URL = `${BASE_URL}/en-ca/API/AdvancedUtility/UsageHistory/summary/GetHourlyUsage`;

const extractCsrfToken = (cookieStr) => {
    if (!cookieStr) return '';
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
};

async function checkDate(targetDate) {
    const COOKIE = process.env.USER_COOKIE;
    const csrfToken = extractCsrfToken(COOKIE);

    console.log(`Testing UsageHistory GET HOUR DATA with TargetDate: ${targetDate}`);
    try {
        const response = await axios.get(HOURLY_URL, {
            params: {
                date: targetDate,
                serviceCode: process.env.SERVICE_CODE || '30',
                showGraphicChart: true,
                serviceDesc: process.env.SERVICE_DESC || 'Water',
                serviceUnit: '',
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
                moduleid: process.env.MODULE_ID || '480',
                tabid: process.env.TAB_ID || '88',
            }
        });

        if (response.data && response.data.Data && response.data.Data.hourlyUsages) {
            console.log(`Found ${response.data.Data.hourlyUsages.length} hourly usages.`);
            let sum = 0;
            response.data.Data.hourlyUsages.forEach(entry => {
                sum += entry.axisY;
                console.log(`  ${entry.axisX} -> ${entry.axisY}`);
            });
            console.log(`Total Sum for ${targetDate}: ${sum.toFixed(3)}`);
        } else {
            console.log("No hourlyUsages found.");
            console.log(response.data);
        }
    } catch (e) {
        console.error(`Status ${e.response?.status}: ${e.message}`);
    }
}

checkDate('2025-12-31');
