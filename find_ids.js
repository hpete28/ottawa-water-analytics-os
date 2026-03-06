const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ Cookie: process.env.USER_COOKIE });
    await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'networkidle2' });

    const content = await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('[id^="dnn_ctr"]'));
        return divs.map(d => ({ id: d.id, text: d.innerText.substring(0, 100) }));
    });
    console.log(JSON.stringify(content, null, 2));

    await page.screenshot({ path: 'usage_debug.png' });
    await browser.close();
}
run();
