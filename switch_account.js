const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function switchAccounts() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1280,800']
    });
    const page = await browser.newPage();

    try {
        console.log('Logging in...');
        await page.goto('https://water-billing.ottawa.ca/en-ca', { waitUntil: 'load', timeout: 60000 });

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
        console.log('Dashboard loaded!');
        await new Promise(r => setTimeout(r, 5000));

        console.log('Clicking the account dropdown...');
        const dropdownSelector = '.aus-account-selector-item a[data-toggle="dropdown"]';
        await page.waitForSelector(dropdownSelector);
        await page.click(dropdownSelector);

        await new Promise(r => setTimeout(r, 1000));

        // Extract dropdown items
        const menuSelector = '.aus-account-selector-item ul.dropdown-menu';
        const isMenuVisible = await page.$(menuSelector);
        if (isMenuVisible) {
            const accounts = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.aus-account-selector-item ul.dropdown-menu li a'));
                return items.map(item => ({
                    text: item.innerText,
                    onclick: item.getAttribute('onclick') || item.href
                }));
            });
            console.log('Found accounts in dropdown:', accounts);

            // If there's more than one account, click the one that does NOT say Finalled
            if (accounts.length > 0) {
                // Find account that is not the active one
                const activeText = await page.evaluate(() => document.querySelector('.aus-account-selector-item a[data-toggle="dropdown"]').innerText);
                console.log('Current Active Account Text:', activeText);

                const nextAccountIndex = accounts.findIndex(a => !a.text.includes('Finalled') && a.text !== activeText);
                if (nextAccountIndex >= 0) {
                    console.log('Switching to account:', accounts[nextAccountIndex].text);
                    const listItems = await page.$$('.aus-account-selector-item ul.dropdown-menu li a');
                    await listItems[nextAccountIndex].click();

                    console.log('Waiting for reload...');
                    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => { });
                    await new Promise(r => setTimeout(r, 5000));

                    // Take screenshot of dashboard of new account
                    await page.screenshot({ path: 'dashboard_new_account.png', fullPage: true });

                    // Now navigate to Usage page!
                    console.log('Navigating to Usage page for the active account...');
                    await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'networkidle0' });
                    await new Promise(r => setTimeout(r, 7000));

                    await page.screenshot({ path: 'usage_new_account.png', fullPage: true });
                    console.log('Done! Check usage_new_account.png');
                } else {
                    console.log('No other active accounts found to switch to.');
                }
            }

        } else {
            console.log('Dropdown menu not found or not visible.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
    await browser.close();
}

switchAccounts();
