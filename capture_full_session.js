/**
 * capture_full_session.js
 * Full login + account switch + usage page navigate, capturing all XHR responses.
 * The goal is to find the METER_NUMBER, MODULE_ID, and TAB_ID for account 10041554.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function captureFullSession() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({ headless: "new", args: ['--window-size=1440,900'] });
    const page = await browser.newPage();

    const captured = [];

    // Attach response interceptor BEFORE any navigation
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('water-billing.ottawa.ca') && url.includes('API/AdvancedUtility')) {
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
        await new Promise(r => setTimeout(r, 4000));
    } catch (e) {
        console.log('Login step:', e.message);
    }

    // Switch to Brookwood Cir account
    const switched = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const match = links.find(l => l.textContent.replace(/\s+/g, '').includes('10041554'));
        if (match) { match.click(); return 'clicked: ' + match.textContent.trim(); }
        return 'not-found';
    });
    console.log('Account switch:', switched);

    if (switched.startsWith('clicked')) {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 3000));
    }

    // Navigate to usage page
    console.log('Navigating to usage page...');
    await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', {
        waitUntil: 'networkidle0', timeout: 30000
    });
    await new Promise(r => setTimeout(r, 8000));

    console.log(`\nCaptured ${captured.length} API responses:`);
    captured.forEach(r => {
        try {
            const data = JSON.parse(r.body);
            const dataStr = JSON.stringify(data.Data || data).substring(0, 600);
            console.log(`\n✅ ${r.url}`);
            console.log(dataStr);
        } catch (e) {
            console.log(`\n📄 ${r.url} (non-JSON): ${r.body.substring(0, 100)}`);
        }
    });

    fs.writeFileSync('full_session_xhr.json', JSON.stringify(captured, null, 2));
    console.log('\nSaved to full_session_xhr.json');
    await browser.close();
}

captureFullSession().catch(console.error);
