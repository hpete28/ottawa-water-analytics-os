/**
 * discover_new_account.js
 * Login and switch to the correct account, then capture all API calls
 * to discover the correct MODULE_ID, TAB_ID, and METER_NUMBER.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const TARGET_ACCOUNT = process.env.ACCOUNT_NUMBER || '10041554'; // 650 Brookwood Cir

async function discoverAccount() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1280,900']
    });
    const page = await browser.newPage();

    const captured = [];

    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        const type = req.resourceType();
        if ((type === 'xhr' || type === 'fetch') && url.includes('water-billing.ottawa.ca')) {
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

    try {
        console.log('Logging in...');
        await page.goto('https://water-billing.ottawa.ca/en-ca', { waitUntil: 'networkidle2', timeout: 60000 });

        // Handle login redirect
        try {
            await page.waitForSelector('input#signInName, input#email', { timeout: 10000 });
            await page.type('input#signInName, input#email', email, { delay: 50 });
            await page.waitForSelector('input#password, input#Password', { timeout: 10000 });
            await page.type('input#password, input#Password', password, { delay: 50 });
            await page.click('button#next, button[type="submit"], .buttons.next button');
            await new Promise(r => setTimeout(r, 3000));
            try {
                await page.waitForSelector('button#idSIButton9', { timeout: 5000 });
                await page.click('button#idSIButton9');
            } catch (e) { }
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
        } catch (e) {
            console.log('Already logged in or different flow:', e.message);
        }

        console.log('Dashboard loaded. Looking for account selector...');
        await new Promise(r => setTimeout(r, 3000));

        // Find account switcher dropdown  
        const accountSelectorHTML = await page.evaluate(() => {
            const el = document.querySelector('#accountList2506, .aus-account-selector-item');
            return el ? el.outerHTML : 'Not found';
        });
        console.log('Account selector HTML:\n', accountSelectorHTML.substring(0, 500));

        // Check if we can find the target account link
        const targetLink = await page.evaluate((target) => {
            const links = Array.from(document.querySelectorAll('a, li'));
            const match = links.find(el => el.textContent.includes(target));
            return match ? match.outerHTML : null;
        }, TARGET_ACCOUNT);

        if (targetLink) {
            console.log(`\nFound target account link! Clicking...`);
            await page.evaluate((target) => {
                const links = Array.from(document.querySelectorAll('a'));
                const match = links.find(el => el.textContent.includes(target) || el.href?.includes(target));
                if (match) match.click();
            }, TARGET_ACCOUNT);

            await new Promise(r => setTimeout(r, 5000));
        } else {
            console.log(`Target account ${TARGET_ACCOUNT} not found in dropdown — may need a different URL.`);
        }

        // Navigate to Usage page to capture meter/module IDs
        console.log('Navigating to Usage page to capture API headers...');
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 8000));

        // Extract all cookies
        const cookies = await page.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        console.log('\n=== Fresh Cookie ===');
        console.log(cookieStr.substring(0, 100) + '...');

        // Save captured API calls
        fs.writeFileSync('new_account_endpoints.json', JSON.stringify(captured, null, 2));
        console.log(`\nSaved ${captured.length} API calls to new_account_endpoints.json`);

        // Extract key headers from water-billing API calls
        const waterCalls = captured.filter(c => c.url.includes('AdvancedUtility'));
        console.log('\n=== Captured Water API Calls ===');
        waterCalls.forEach(c => {
            console.log(`${c.method} ${c.url}`);
            if (c.moduleid) console.log(`  moduleid: ${c.moduleid}, tabid: ${c.tabid}`);
        });

        // Take a screenshot to confirm we are on the right account page
        await page.screenshot({ path: 'new_account_usage.png', fullPage: true });
        console.log('\nSaved new_account_usage.png');

    } catch (e) {
        console.error('Error:', e);
    }
    await browser.close();
}

discoverAccount();
