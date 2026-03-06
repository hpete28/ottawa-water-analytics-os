/**
 * intercept_account_switch.js
 * Login with non-headless browser (visible), then click account dropdown and intercept the JS call.
 * Actually, use non-headless mode to let us see what happens.
 * The key insight: the account switch in DNN often uses a redirect URL like:
 *   /en-ca/my-account/usage?account=XXXXXXXX
 * OR changes a server-side session via a DNN web form postback.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function interceptAccountSwitch() {
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
        if (url.includes('water-billing.ottawa.ca')) {
            captured.push({ url, method: req.method(), type });
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

        await new Promise(r => setTimeout(r, 4000));

        // Get the page HTML to extract the onclick of the account switcher
        const pageHtml = await page.content();
        const accountSwitcherIdx = pageHtml.indexOf('accountList');
        if (accountSwitcherIdx >= 0) {
            const snippet = pageHtml.substring(accountSwitcherIdx, accountSwitcherIdx + 3000);
            console.log('Account switcher area source:\n', snippet);
            fs.writeFileSync('account_switcher.html', snippet);
        }

        // Try injecting JS to trigger account switch
        const switchResult = await page.evaluate(() => {
            // Look for any JS function related to account switching
            const func = window.switchAccount || window.selectAccount || window.changeAccount;
            if (func) return 'Found switch function';
            return 'No direct switch function found';
        });
        console.log('Switch function search:', switchResult);

        // Try navigating directly with account parameter
        const tryUrls = [
            `https://water-billing.ottawa.ca/en-ca/my-account/usage?account=10041554`,
            `https://water-billing.ottawa.ca/en-ca/my-account/billing?account=10041554`,
            `https://water-billing.ottawa.ca/en-ca?accountnumber=10041554`,
        ];

        for (const testUrl of tryUrls) {
            console.log(`\nTrying direct URL: ${testUrl}`);
            await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => { });
            await new Promise(r => setTimeout(r, 3000));

            const accountShown = await page.evaluate(() => {
                const el = document.querySelector('#accountList2506, .aus-account-selector-item');
                return el ? el.innerText.trim() : 'not found';
            });
            console.log('Account selector shows:', accountShown.substring(0, 100));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }

    // Save all captured URLs
    fs.writeFileSync('intercepted_switch_calls.json', JSON.stringify(captured, null, 2));
    console.log(`\nSaved ${captured.length} total calls to intercepted_switch_calls.json`);

    await browser.close();
}

interceptAccountSwitch();
