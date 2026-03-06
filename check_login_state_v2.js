const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    try {
        console.log('Navigating...');
        await page.goto('https://water-billing.ottawa.ca/en-ca', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'state_1_start.png' });

        console.log('Filling creds...');
        const emailSel = 'input#signInName, input#email';
        await page.waitForSelector(emailSel, { timeout: 10000 });
        await page.type(emailSel, email);

        const passSel = 'input#password, input#Password';
        await page.type(passSel, password);

        await page.screenshot({ path: 'state_2_filled.png' });

        console.log('Clicking login...');
        const btnSel = 'button#next, button[type=\"submit\"]';
        await page.click(btnSel);

        await new Promise(r => setTimeout(r, 5000));
        console.log('URL:', page.url());
        await page.screenshot({ path: 'state_3_after_login.png', fullPage: true });

    } catch (e) {
        console.error(e);
        await page.screenshot({ path: 'state_error.png' });
    } finally {
        await browser.close();
    }
}
run();
