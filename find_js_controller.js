/**
 * find_js_controller.js
 * Download and analyze the Ottawa Water JS bundle to find the account switch API
 */
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const COOKIE = process.env.USER_COOKIE;
const BASE = 'https://water-billing.ottawa.ca';

async function findController() {
    // First get the main page HTML
    const html = fs.readFileSync('account_switcher.html', 'utf8');

    // Try to get the main page to find JS script URLs
    const res = await axios.get(`${BASE}/en-ca`, {
        headers: {
            Cookie: COOKIE,
            'User-Agent': 'Mozilla/5.0',
            Accept: 'text/html'
        },
        maxRedirects: 0,
    }).catch(e => e.response);

    if (!res || !res.data) {
        console.log('No response');
        return;
    }

    const pageHtml = res.data;

    // Find all script src tags
    const scriptRegex = /src="([^"]*AccountSelector[^"]*|[^"]*goPage[^"]*|[^"]*ausModule[^"]*|[^"]*utility[^"]*)"/gi;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(pageHtml)) !== null) {
        scripts.push(match[1]);
    }
    console.log('Found relevant script URLs:', scripts);

    // Search for any key patterns in the full HTML
    const switchIdx = pageHtml.indexOf('getAccounts');
    if (switchIdx >= 0) console.log('getAccounts pattern:', pageHtml.substring(switchIdx, switchIdx + 200));

    const changeIdx = pageHtml.indexOf('changeAccount');
    if (changeIdx >= 0) console.log('changeAccount pattern:', pageHtml.substring(changeIdx, changeIdx + 200));

    const loadIdx = pageHtml.indexOf('LoadAccounts');
    if (loadIdx >= 0) console.log('LoadAccounts pattern:', pageHtml.substring(loadIdx, loadIdx + 200));

    fs.writeFileSync('ottawa_main.html', pageHtml.substring(0, 100000));
    console.log('Saved first 100k chars of page to ottawa_main.html');
}

findController().catch(console.error);
