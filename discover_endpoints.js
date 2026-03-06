const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

// Script to login and intercept network requests to find the exact endpoints for the "Daily Usage Calendar" and the "Billing Table"
async function discoverEndpoints() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1280,800']
    });
    const page = await browser.newPage();

    const interceptedRequests = [];

    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('water-billing.ottawa.ca/en-ca/API/')) {
            interceptedRequests.push({
                url: request.url(),
                method: request.method(),
                postData: request.postData()
            });
        }
        request.continue();
    });

    try {
        console.log('Logging in to capture endpoints...');
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

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 8000)); // wait for all API calls to fire on dashboard load

        console.log('Intercepted Ottawa API Requests:');
        fs.writeFileSync('intercepted_endpoints.json', JSON.stringify(interceptedRequests, null, 2));
        console.log(JSON.stringify(interceptedRequests, null, 2));

    } catch (e) {
        console.error(e);
    }
    await browser.close();
}

discoverEndpoints();
