/**
 * capture_usage_xhr.js
 * Intercept the UsageHistory API response body using page.on('response')
 * to extract meter number, service code, module ID and tab ID for account 10041554.
 */
const puppeteer = require('puppeteer');
require('dotenv').config();

async function captureUsageXHR() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    const xhrResponses = [];

    // Intercept ALL XHR/Fetch responses to look at their bodies
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('water-billing.ottawa.ca') && url.includes('API/AdvancedUtility')) {
            try {
                const text = await response.text();
                xhrResponses.push({
                    url,
                    status: response.status(),
                    headers: response.headers(),
                    body: text.substring(0, 2000),
                });
            } catch (e) { }
        }
    });

    const COOKIE = process.env.USER_COOKIE;

    console.log('Loading usage page with interceptor active...');
    await page.setExtraHTTPHeaders({ Cookie: COOKIE });
    await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', {
        waitUntil: 'networkidle0',
        timeout: 45000
    });

    // Wait extra time for all XHR to fire
    await new Promise(r => setTimeout(r, 6000));

    console.log(`\nCaptured ${xhrResponses.length} API responses:`);
    xhrResponses.forEach(r => {
        console.log(`\nURL: ${r.url.split('.ottawa.ca')[1]}`);
        console.log(`Status: ${r.status}`);
        try {
            const data = JSON.parse(r.body);
            if (data.Data) {
                const str = JSON.stringify(data.Data).substring(0, 600);
                console.log('Data:', str);
            } else {
                console.log('Body (no .Data):', r.body.substring(0, 200));
            }
        } catch (e) {
            console.log('Non-JSON body:', r.body.substring(0, 100));
        }
    });

    await browser.close();
}

captureUsageXHR().catch(console.error);
