const puppeteer = require('puppeteer');

async function debugScreen() {
    console.log('📸 Debugging Ottawa Portal View...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 5000)); // Wait 5s for any redirects
        console.log('   Current URL:', page.url());
        await page.screenshot({ path: 'debug_portal.png', fullPage: true });
        console.log('   Screenshot saved as debug_portal.png');
    } catch (e) {
        console.error('   Failed:', e.message);
    }
    await browser.close();
}

debugScreen();
