const puppeteer = require('puppeteer');

async function logInputs() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 15000));
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(i => ({
                id: i.id,
                name: i.name,
                type: i.type,
                placeholder: i.placeholder
            }));
        });
        console.log('Inputs found:', JSON.stringify(inputs, null, 2));
    } catch (e) {
        console.error(e);
    }
    await browser.close();
}

logInputs();
