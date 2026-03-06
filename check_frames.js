const puppeteer = require('puppeteer');

async function checkIframes() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 10000));
        const iframes = await page.frames();
        console.log('Total frames:', iframes.length);
        for (let i = 0; i < iframes.length; i++) {
            console.log(`Frame ${i} URL:`, iframes[i].url());
        }
    } catch (e) {
        console.error(e);
    }
    await browser.close();
}

checkIframes();
