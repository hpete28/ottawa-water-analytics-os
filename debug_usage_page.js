const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function debugUsagePage() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1280,800']
    });
    const page = await browser.newPage();

    try {
        console.log('Logging in and navigating to Usage page...');
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'load', timeout: 60000 });

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

        console.log('Waiting 15 seconds for dashboard and charts to load...');
        await new Promise(r => setTimeout(r, 15000));

        await page.screenshot({ path: 'usage_screenshot.png', fullPage: true });
        console.log('Saved usage_screenshot.png');

        // Extract all text from tables
        const tableData = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            return tables.map(t => t.innerText);
        });

        console.log(`Found ${tableData.length} tables on the page.`);
        fs.writeFileSync('tables_extracted.json', JSON.stringify(tableData, null, 2));

        // Find all iframes
        const iframes = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('iframe')).map(i => i.src);
        });
        console.log(`Found ${iframes.length} iframes:`, iframes);

    } catch (e) {
        console.error('Error:', e);
    }
    await browser.close();
}

debugUsagePage();
