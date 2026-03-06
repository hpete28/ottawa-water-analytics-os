const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    console.log('Logging in to check for password change screen...');
    await page.goto('https://water-billing.ottawa.ca/en-ca', { waitUntil: 'networkidle2' });

    await page.waitForSelector('input#signInName', { timeout: 10000 });
    await page.type('input#signInName', email);
    await page.type('input#password', password);
    await page.click('button#next');

    await new Promise(r => setTimeout(r, 5000));

    const currentUrl = page.url();
    console.log('URL after login:', currentUrl);

    await page.screenshot({ path: 'login_result.png', fullPage: true });

    const isChangePassword = await page.evaluate(() => {
        return document.body.innerText.includes('Change Password') || document.body.innerText.includes('temporary password');
    });

    console.log('Is Change Password Screen?', isChangePassword);

    await browser.close();
}
run().catch(console.error);
