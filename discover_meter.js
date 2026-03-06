/**
 * discover_meter.js
 * Use the fresh cookie (now tied to account 10041554 / 650 Brookwood Cir)
 * to intercept all API calls on the usage page and extract the correct METER_NUMBER.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function discoverMeter() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1440,900']
    });
    const page = await browser.newPage();

    const captured = [];

    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        if (url.includes('water-billing.ottawa.ca') && url.includes('AdvancedUtility')) {
            const headers = req.headers();
            captured.push({
                url,
                method: req.method(),
                moduleid: headers['moduleid'],
                tabid: headers['tabid'],
                postData: req.postData(),
            });
        }
        req.continue();
    });

    // Use the fresh cookie to directly access usage page
    const COOKIE = process.env.USER_COOKIE;
    console.log('Using fresh cookie to navigate directly to usage page...');

    await page.setExtraHTTPHeaders({ Cookie: COOKIE });
    await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', {
        waitUntil: 'networkidle2',
        timeout: 45000
    });

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // If we got redirected to login, do full login
    if (currentUrl.includes('login-connexion') || currentUrl.includes('login')) {
        console.log('Cookie expired, doing full login...');
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

        // Switch to correct account
        const switched = await page.evaluate((target) => {
            const links = Array.from(document.querySelectorAll('a'));
            const match = links.find(l => l.textContent.replace(/\s+/g, '').includes(target));
            if (match) { match.click(); return 'clicked'; }
            return 'not-found';
        }, '10041554');
        console.log('Account switch:', switched);
        if (switched === 'clicked') {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
        }

        // Navigate to usage page
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', {
            waitUntil: 'networkidle2', timeout: 30000
        });
    }

    await new Promise(r => setTimeout(r, 8000));

    console.log(`\nCaptured ${captured.length} API calls.`);

    // Extract UsageHistory calls which contain meter number in params
    const usageCalls = captured.filter(c => c.url.includes('UsageHistory'));
    console.log('\n=== UsageHistory Calls ===');
    usageCalls.forEach(c => {
        const url = new URL(c.url);
        console.log('URL:', c.url);
        console.log('Params:', Object.fromEntries(url.searchParams));
        console.log('moduleid:', c.moduleid, 'tabid:', c.tabid);
        console.log('---');
    });

    // Extract GetModuleInitializationData which often contains the meter
    const initCalls = captured.filter(c => c.url.includes('GetModuleInitializationData'));
    console.log('\n=== GetModuleInitializationData Calls ===');
    initCalls.forEach(c => {
        console.log(c.url, '| moduleid:', c.moduleid, '| tabid:', c.tabid);
    });

    // Save all for analysis
    fs.writeFileSync('new_meter_discovery.json', JSON.stringify(captured, null, 2));
    console.log('\nSaved all calls to new_meter_discovery.json');

    await browser.close();
}

discoverMeter().catch(console.error);
