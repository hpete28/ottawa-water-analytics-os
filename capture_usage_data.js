/**
 * capture_usage_data.js
 * After login and account switch, click the Usage tab/graph to trigger
 * the UsageHistory data API which contains the METER_NUMBER.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function captureUsageData() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({ headless: "new", args: ['--window-size=1440,900'] });
    const page = await browser.newPage();

    const captured = [];
    const requestHeaders = {};

    // Intercept requests to get module headers
    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        if (url.includes('water-billing.ottawa.ca') && url.includes('API/AdvancedUtility')) {
            const h = req.headers();
            requestHeaders[url.split('.ottawa.ca')[1]] = { moduleid: h['moduleid'], tabid: h['tabid'] };
        }
        req.continue();
    });

    // Intercept responses
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('water-billing.ottawa.ca') && url.includes('API/AdvancedUtility') && url.includes('Usage')) {
            try {
                const text = await response.text();
                captured.push({ url: url.split('.ottawa.ca')[1], status: response.status(), body: text });
            } catch (e) { }
        }
    });

    console.log('Starting full login flow...');
    await page.goto('https://water-billing.ottawa.ca/en-ca', { waitUntil: 'networkidle0', timeout: 60000 });

    try {
        await page.waitForSelector('input#signInName', { timeout: 10000 });
        await page.type('input#signInName', email, { delay: 50 });
        await page.type('input#password', password, { delay: 50 });
        await page.click('button#next, button[type="submit"]');
        await new Promise(r => setTimeout(r, 3000));
        try {
            await page.waitForSelector('button#idSIButton9', { timeout: 5000 });
            await page.click('button#idSIButton9');
        } catch (e) { }
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
        console.log('Login:', e.message);
    }

    // Switch to Brookwood Cir account
    const switched = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const match = links.find(l => l.textContent.replace(/\s+/g, '').includes('10041554'));
        if (match) { match.click(); return 'clicked: ' + match.textContent.trim().substring(0, 50); }
        return 'not-found';
    });
    console.log('Account switch:', switched);
    if (switched.startsWith('clicked')) {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 3000));
    }

    // Navigate directly to Usage page
    console.log('Going to Usage page...');
    await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', {
        waitUntil: 'networkidle0', timeout: 30000
    });
    await new Promise(r => setTimeout(r, 10000));

    // Try clicking on any usage/graph link or date selector to trigger UsageHistory API
    const usageLinks = await page.evaluate(() => {
        const selectors = ['a[href*="usage"]', '.usage-tab', '#usage-tab', 'button.usage', '.graph-tab'];
        const found = [];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) found.push(sel + ': ' + el.textContent.trim().substring(0, 30));
        }
        return found;
    });
    console.log('Usage links found:', usageLinks);

    console.log(`\nCaptured ${captured.length} UsageHistory API responses:`);
    captured.forEach(r => {
        try {
            const data = JSON.parse(r.body);
            console.log('\nURL:', r.url);
            console.log('Data:', JSON.stringify(data.Data || data).substring(0, 600));
        } catch (e) {
            console.log('\nURL:', r.url, 'Non-JSON:', r.body.substring(0, 100));
        }
    });

    console.log('\nCaptured request headers detail:');
    Object.entries(requestHeaders).forEach(([url, h]) => {
        console.log(`${url} | mid: ${h.moduleid} | tid: ${h.tabid}`);
    });

    fs.writeFileSync('usage_data_xhr.json', JSON.stringify({ captured, requestHeaders }, null, 2));
    console.log('\nSaved to usage_data_xhr.json');
    await browser.close();
}

captureUsageData().catch(console.error);
