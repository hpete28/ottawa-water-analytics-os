const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ Cookie: process.env.USER_COOKIE });

    console.log('Going to Usage page...');
    await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'networkidle2' });

    const url = page.url();
    console.log('Current URL:', url);

    const state = await page.evaluate(() => {
        const results = {};
        if (typeof goPage !== 'undefined') {
            results.modules = Object.keys(goPage.modules);
            // Try to find the tabId
            results.tabId = goPage.tabId;
        }
        // Search for meter number in the DOM
        const body = document.body.innerText;
        const meterMatch = body.match(/Meter #[:\s]*(\d+)/i) || body.match(/Compteur #[:\s]*(\d+)/i);
        results.meterFromText = meterMatch ? meterMatch[1] : null;

        // Look for any hidden inputs or data attributes
        const meterInput = document.querySelector('input[name*="meter"], [data-meter]');
        results.meterFromInput = meterInput ? (meterInput.value || meterInput.dataset.meter) : null;

        return results;
    });

    console.log('State:', JSON.stringify(state, null, 2));

    // Also list all resources to find the tabid
    const tabIdMatch = url.match(/tabid=(\d+)/i);
    if (tabIdMatch) console.log('TabID from URL:', tabIdMatch[1]);

    await browser.close();
}
run();
