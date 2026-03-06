/**
 * switch_via_js.js
 * The Ottawa Water portal uses a DNN JS module (goPage.AccountSelectorController)
 * to populate the account dropdown AFTER page load via its preload API.
 * Strategy: wait after the preload XHR fires, then look for the account link and click it.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const TARGET = '10041554';

async function switchViaJS() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1440,900']
    });
    const page = await browser.newPage();

    const apiCalls = [];
    let freshCookies = '';

    await page.setRequestInterception(true);
    page.on('request', req => {
        if (req.url().includes('water-billing.ottawa.ca') &&
            (req.resourceType() === 'xhr' || req.resourceType() === 'fetch')) {
            apiCalls.push({ url: req.url(), method: req.method() });
        }
        req.continue();
    });

    try {
        console.log('Logging in...');
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
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => { });
        } catch (e) { }

        // Wait for the DNN account selector JS to populate the dropdown
        console.log('Waiting 8s for JS modules to load...');
        await new Promise(r => setTimeout(r, 8000));

        // Check if the dropdown got populated now
        const dropdownContent = await page.evaluate(() => {
            const container = document.querySelector('#accountList2506');
            return container ? container.innerHTML.length + ' chars: ' + container.innerHTML.substring(0, 400) : 'Not found';
        });
        console.log('Dropdown content:', dropdownContent.substring(0, 500));

        // Look for any anchor with the target account number
        const accountLinks = await page.evaluate((target) => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .filter(l => l.textContent.includes(target) || (l.href && l.href.includes(target)) || JSON.stringify(l.dataset).includes(target))
                .map(l => ({ text: l.textContent.trim(), href: l.href, onclick: l.getAttribute('onclick'), dataset: l.dataset }));
        }, TARGET);
        console.log('\nAccount links found:', JSON.stringify(accountLinks, null, 2));

        // Try clicking the toggle to open dropdown, then wait for it to populate via XHR
        console.log('\nTrying to open the dropdown trigger...');
        await page.evaluate(() => {
            const toggle = document.querySelector('[data-toggle="dropdown"], .dropdown-toggle');
            if (toggle) toggle.click();
        });
        await new Promise(r => setTimeout(r, 3000));

        const dropdownAfterClick = await page.evaluate(() => {
            const container = document.querySelector('#accountList2506 .dropdown-menu, #accountList2506');
            return container ? container.innerHTML.substring(0, 800) : 'Not found';
        });
        console.log('\nDropdown after click:', dropdownAfterClick);

        // Capture fresh cookies
        const cookies = await page.cookies();
        freshCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        await page.screenshot({ path: 'dropdown_open.png', fullPage: false });
        console.log('\nSaved dropdown_open.png');

        // Save all API calls
        fs.writeFileSync('api_calls_after_dropdown.json', JSON.stringify(apiCalls, null, 2));
        console.log(`Captured ${apiCalls.length} API calls`);

    } catch (e) {
        console.error('Error:', e.message);
    }
    await browser.close();

    console.log('\nFresh Cookie (first 150 chars):', freshCookies.substring(0, 150));
}

switchViaJS();
