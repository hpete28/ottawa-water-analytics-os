/**
 * get_usage_module_id.js
 * Login, switch to Brookwood Cir, navigate to usage page,
 * extract the resolved DNN module IDs from the rendered HTML.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function getUsageModuleId() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    const browser = await puppeteer.launch({ headless: "new", args: ['--window-size=1440,900'] });
    const page = await browser.newPage();

    console.log('Starting full login...');
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
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 5000));
    } catch (e) { console.log('Login:', e.message); }

    // Switch to Brookwood Cir account
    const switched = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const match = links.find(l => l.textContent.replace(/\s+/g, '').includes('10041554'));
        if (match) { match.click(); return 'clicked: ' + match.textContent.trim().substring(0, 50); }
        return 'not-found';
    });
    console.log('Account switch:', switched);
    if (switched.startsWith('clicked')) {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 3000));
    }

    // Click into the Usage nav menu
    console.log('Clicking Usage menu link...');
    try {
        // Try clicking the nav Usage link to ensure we load the usage-specific modules
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const usage = links.find(l => l.textContent.trim() === 'Usage' && l.href.includes('usage'));
            if (usage) usage.click();
        });
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => { });
    } catch (e) { }

    await new Promise(r => setTimeout(r, 8000));

    // Extract all addModule calls to get resolved module IDs
    const moduleIds = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        const moduleMap = {};
        for (const s of scripts) {
            const text = s.textContent;
            const regex = /addModule\('(\d+)',\s*moduleController\)/g;
            let m;
            while ((m = regex.exec(text)) !== null) {
                moduleMap[m[1]] = true;
            }
        }
        return Object.keys(moduleMap);
    });

    console.log('\nResolved module IDs:', moduleIds);

    // Also extract specific DNN module content divs to map types
    const moduleTypes = await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('[id^="dnn_ctr"]'));
        return divs.map(d => {
            const match = d.id.match(/dnn_ctr(\d+)/);
            const modId = match ? match[1] : '?';
            const classes = d.className;
            return `${modId}: ${classes.substring(0, 80)}`;
        });
    });
    console.log('\nModule div types:', moduleTypes);

    // Save the full rendered HTML for analysis
    const html = await page.content();
    fs.writeFileSync('usage_page_new_account.html', html);
    console.log('\nSaved rendered HTML to usage_page_new_account.html');

    await browser.close();
}

getUsageModuleId().catch(console.error);
