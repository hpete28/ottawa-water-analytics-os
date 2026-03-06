/**
 * test_account_switch.js
 * Try to directly call the Ottawa Water account selector API to switch context.
 */
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = 'https://water-billing.ottawa.ca';

const extractCsrfToken = (cookieStr) => {
    if (!cookieStr) return '';
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
};

const ACCOUNT_NUM = '10041554'; // New active account at 650 Brookwood Cir

async function switchAccount() {
    const COOKIE = process.env.USER_COOKIE;
    const csrfToken = extractCsrfToken(COOKIE);

    console.log(`Attempting to switch to account: ${ACCOUNT_NUM}`);

    // Try the account selector API — this is what the browser calls when you click an account in dropdown
    // Typical DNN pattern: POST to AccountSelector/selector/SetActiveAccount
    const urlsToTry = [
        `${BASE_URL}/en-ca/API/AdvancedUtility/AccountSelector/selector/SetActiveAccount`,
        `${BASE_URL}/en-ca/API/AdvancedUtility/AccountSelector/selector/SelectAccount`,
        `${BASE_URL}/en-ca/API/AdvancedUtility/AccountSelector/selector/SwitchAccount`,
        `${BASE_URL}/en-ca/API/AdvancedUtility/AccountSelector/selector/ChangeAccount`,
    ];

    for (const url of urlsToTry) {
        console.log(`\nTrying: POST ${url}`);
        try {
            const res = await axios.post(url,
                JSON.stringify({ accountNumber: ACCOUNT_NUM }),
                {
                    headers: {
                        Cookie: COOKIE,
                        'User-Agent': 'Mozilla/5.0',
                        Accept: '*/*',
                        'X-Requested-With': 'XMLHttpRequest',
                        'RequestVerificationToken': csrfToken,
                        moduleid: '2506',
                        tabid: '605',
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000,
                }
            );
            console.log('Success:', JSON.stringify(res.data).substring(0, 200));
        } catch (e) {
            console.error(`Status ${e.response?.status}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    // After trying, fetch the billing summary to confirm current account
    console.log('\nFetching BillingSummary after switch attempts...');
    try {
        const res = await axios.get(`${BASE_URL}/en-ca/API/AdvancedUtility/BillingSummary/summary/data`, {
            headers: {
                Cookie: COOKIE,
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'RequestVerificationToken': csrfToken,
                moduleid: '2499',
                tabid: '605',
            }
        });
        if (res.data && res.data.Data) {
            console.log('Current active account in session:', res.data.Data.account);
            console.log(JSON.stringify(res.data.Data, null, 2).substring(0, 400));
        }
    } catch (e) {
        console.error('Billing fetch error:', e.message);
    }
}

switchAccount();
