const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * services/AuthScraper.js
 * -----------------------
 * Navigates to the Ottawa Water Portal, simulates user login,
 * captures the authenticated cookie, and injects it back into .env.
 */

async function refreshSessionCookie() {
    const email = process.env.OTTAWA_EMAIL;
    const password = process.env.OTTAWA_PASSWORD;

    if (!email || !password || email === 'your_email_here' || password === 'your_password_here') {
        throw new Error('OTTAWA_EMAIL and OTTAWA_PASSWORD must be strictly set in .env for headless auth to work.');
    }

    console.log('🤖 [AuthScraper] Booting headless browser for auto-login...');

    // Launch Chromium headlessly
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set user agent so we don't look like a basic scraper
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('   -> Navigating to Ottawa Water Portal...');
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'networkidle2' });

        // Often redirects to Azure/MyServiceOttawa or a standard login portal
        // We look for standard email/pass input fields. 
        console.log('   -> Entering email...');
        await page.waitForSelector('input[type="email"], input[name="loginfmt"], input[name="Email"], input[name="username"], input[name="UserName"]', { timeout: 15000 });
        const emailInput = await page.$('input[type="email"], input[name="loginfmt"], input[name="Email"], input[name="username"], input[name="UserName"]');
        await emailInput.type(email, { delay: 50 });
        await page.keyboard.press('Enter');

        // Wait to make sure the password box activates (some portals are two-step, some are one-step)
        await new Promise(r => setTimeout(r, 2000));

        console.log('   -> Entering password...');
        await page.waitForSelector('input[type="password"], input[name="passwd"], input[name="Password"]', { timeout: 15000 });
        const passInput = await page.$('input[type="password"], input[name="passwd"], input[name="Password"]');
        await passInput.type(password, { delay: 50 });

        // Wait a slight random delay before submission
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Enter');

        // Handle possible "Stay signed in?" screen typical of Azure B2C
        try {
            await page.waitForSelector('input[value="Yes"], input[value="Accept"], button#idSIButton9', { timeout: 5000 });
            console.log('   -> Bypassing "Stay Signed In?" prompt...');
            await page.click('input[value="Yes"], input[value="Accept"], button#idSIButton9');
        } catch (e) {
            // Ignored, prompt didn't appear.
        }

        console.log('   -> Awaiting successful redirect to dashboard...');
        // Wait for the final navigation sequence to finish settling
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });

        // Give it 3 extra seconds to ensure all tracking incapsula cookies settle in the browser storage
        await new Promise(r => setTimeout(r, 3000));

        console.log('   -> Scraping fresh cookies...');
        const cookies = await page.cookies();

        // Make sure we caught our big boys (incap_ses or ASP.NET_SessionId)
        if (cookies.length === 0) {
            throw new Error('Browser returned 0 cookies. The login likely failed or hit a ReCaptcha.');
        }

        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Update .env file
        const envPath = path.resolve(process.cwd(), '.env');
        let envFile = fs.readFileSync(envPath, 'utf-8');

        if (/^USER_COOKIE=.*$/m.test(envFile)) {
            envFile = envFile.replace(/^USER_COOKIE=.*$/m, `USER_COOKIE=${cookieStr}`);
        } else {
            envFile += `\nUSER_COOKIE=${cookieStr}`;
        }

        fs.writeFileSync(envPath, envFile, 'utf-8');

        // Dynamically update current process's memory
        process.env.USER_COOKIE = cookieStr;

        console.log('✅ [AuthScraper] Cookie successfully updated and loaded into memory.');
        await browser.close();
        return true;

    } catch (err) {
        console.error('❌ [AuthScraper] Headless Auth Failed:', err.message);
        await browser.close();
        throw err;
    }
}

module.exports = { refreshSessionCookie };
