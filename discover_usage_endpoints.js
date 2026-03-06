const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function discoverUsageEndpoints() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1280,800']
    });
    const page = await browser.newPage();

    const endpoints = [];

    // Intercept requests
    await page.setRequestInterception(true);
    page.on('request', async request => {
        if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
            const url = request.url();
            const method = request.method();
            const postData = request.postData();
            endpoints.push({ url, method, postData });
            console.log(`[Intercepted XHR/Fetch] ${method} ${url}`);
        }
        request.continue();
    });

    try {
        console.log('Logging in and navigating to Usage page...');
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'load', timeout: 60000 });

        await page.waitForSelector('input#signInName, input#email, input#Email', { timeout: 20000 });
        await page.type('input#signInName, input#email, input#Email', email, { delay: 50 });

        await page.waitForSelector('input#password, input#Password', { timeout: 20000 });
        await page.type('input#password, input#Password', password, { delay: 50 });

        await page.click('button#next, button[type="submit"], .buttons.next button');

        await new Promise(r => setTimeout(r, 2000));

        try {
            await page.waitForSelector('input[value="Yes"], input[value="Accept"], button#idSIButton9', { timeout: 5000 });
            await page.click('input[value="Yes"], input[value="Accept"], button#idSIButton9');
        } catch (e) { }

        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => { });

        console.log('Waiting for external data requests to finish (10s)...');
        await new Promise(r => setTimeout(r, 10000));

        // Click on "Table View" or "List" if it exists, to trigger data loads
        try {
            const tabs = await page.$$('a[data-toggle="tab"], .nav-tabs li a, button[role="tab"]');
            for (const tab of tabs) {
                await tab.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) { }

        fs.writeFileSync('usage_endpoints_all.json', JSON.stringify(endpoints, null, 2));
        console.log(`Saved ${endpoints.length} API calls to usage_endpoints_all.json`);

    } catch (e) {
        console.error(e);
    }
    await browser.close();
}

discoverUsageEndpoints();
