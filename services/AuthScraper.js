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
    let browser = null;
    let page = null;

    if (!email || !password || email === 'your_email_here' || password === 'your_password_here') {
        throw new Error('OTTAWA_EMAIL and OTTAWA_PASSWORD must be strictly set in .env for headless auth to work.');
    }

    console.log('🤖 [AuthScraper] Booting headless browser for auto-login...');

    // Launch Chromium headlessly
    browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1280,800']
    });

    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Set user agent so we don't look like a basic scraper
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('   -> Navigating to Ottawa Water Portal...');
        await page.goto('https://water-billing.ottawa.ca/en-ca/my-account/usage', { waitUntil: 'load', timeout: 60000 });
        console.log('   -> Arrived at:', await page.url());

        // Often redirects to Azure/MyServiceOttawa or a standard login portal
        // We look for standard email/pass input fields. 
        console.log('   -> Entering email...');
        await page.waitForSelector('input#signInName, input#email, input#Email', { timeout: 20000 });
        await page.type('input#signInName, input#email, input#Email', email, { delay: 50 });

        console.log('   -> Entering password...');
        await page.waitForSelector('input#password, input#Password', { timeout: 20000 });
        await page.type('input#password, input#Password', password, { delay: 50 });

        console.log('   -> Clicking Login...');
        await page.click('button#next, button[type="submit"], .buttons.next button');

        // Wait a bit for the redirect
        await new Promise(r => setTimeout(r, 2000));

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

        // Give it 3 extra seconds for all tracking/incapsula cookies to settle
        await new Promise(r => setTimeout(r, 3000));

        // ── Account Switch: if ACCOUNT_NUMBER is configured, try selecting it ──
        const targetAccount = process.env.ACCOUNT_NUMBER;
        if (targetAccount) {
            console.log(`   -> Looking for account ${targetAccount} to switch to...`);
            // Wait another 5s for the AccountSelector JS module to populate via AJAX
            await new Promise(r => setTimeout(r, 5000));

            const switched = await page.evaluate((target) => {
                // The DNN AccountSelectorController populates the dropdown dynamically.
                // Look for any <a> tag inside the account list that contains our target account number.
                const container = document.querySelector('#accountList2506');
                if (!container) return 'no-container';
                const links = Array.from(container.querySelectorAll('a'));
                const match = links.find(l => l.textContent.includes(target));
                if (match) {
                    match.click();
                    return 'clicked-' + match.textContent.trim();
                }
                // Also try looking everywhere on the page
                const allLinks = Array.from(document.querySelectorAll('a'));
                const anyMatch = allLinks.find(l => l.textContent.replace(/\s+/g, '').includes(target));
                if (anyMatch) {
                    anyMatch.click();
                    return 'clicked-global-' + anyMatch.textContent.trim();
                }
                return 'not-found';
            }, targetAccount);

            console.log(`   -> Account switch result: ${switched}`);

            if (switched.startsWith('clicked')) {
                console.log('   -> Waiting for page to reload after account switch...');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
                await new Promise(r => setTimeout(r, 3000));
            }
        }

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
        if (page) {
            console.log('   -> Current URL at failure:', page.url());
            console.log('   -> Attempting to capture diagnostic screenshot...');
            await page.screenshot({ path: 'auth_failure_diagnostic.png', fullPage: true }).then(() => {
                console.log('   -> Screenshot saved as auth_failure_diagnostic.png');
            }).catch(sErr => {
                console.error('   -> Screenshot failed:', sErr.message);
            });
        }
        if (browser) await browser.close();
        throw err;
    }
}

module.exports = { refreshSessionCookie };
