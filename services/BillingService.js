/**
 * services/BillingService.js
 * --------------------------
 * Fetches the latest billing summary from the Ottawa Water Portal.
 */

require('dotenv').config();
const axios = require('axios');
const { getDb, initDb } = require('../db/init');

const COOKIE = process.env.USER_COOKIE;
const BASE_URL = 'https://water-billing.ottawa.ca';
const BILLING_URL = `${BASE_URL}/en-ca/API/AdvancedUtility/BillingSummary/summary/data`;

function extractCsrfToken(cookieStr) {
    if (!cookieStr) return '';
    const match = cookieStr.match(/__RequestVerificationToken=([^;]+)/);
    return match ? match[1] : '';
}

/**
 * Fetches and stores the latest billing summary invoice.
 */
async function fetchAndStoreBillingSummary() {
    if (!COOKIE || COOKIE === 'your_cookie_here') {
        throw new Error('USER_COOKIE is not set.');
    }

    console.log(`💵  BillingService: fetching latest invoice data...`);

    const csrfToken = extractCsrfToken(COOKIE);

    let invoice;
    try {
        const response = await axios.get(BILLING_URL, {
            headers: {
                Cookie: COOKIE,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                Accept: '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'RequestVerificationToken': csrfToken,
                moduleid: process.env.MODULE_ID || '480',
                tabid: process.env.TAB_ID || '88',
            },
            timeout: 15000,
        });

        const json = response.data;

        if (typeof json === 'string' && json.toLowerCase().includes('<!doctype html>')) {
            throw new Error('Auth error: Session cookie has expired and redirected to HTML login. Triggering auto-retry.');
        }

        if (json && json.Data) {
            invoice = json.Data;
        } else {
            console.log(json);
            throw new Error('Ottawa Water API did not return billing Data.');
        }

    } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
            throw new Error(`Auth error (HTTP ${err.response.status}). Session expired.`);
        }
        throw err;
    }

    // Insert into SQLite
    const db = await initDb();

    // Create table if not exists (migrating dynamically just in case)
    await db.run(`
        CREATE TABLE IF NOT EXISTS billing_history (
            bill_number TEXT PRIMARY KEY,
            account_number TEXT,
            bill_date TEXT,
            due_date TEXT,
            current_balance REAL,
            past_balance REAL,
            total_balance REAL
        )
    `);

    const stmt = await db.prepare(`
        INSERT OR REPLACE INTO billing_history 
        (bill_number, account_number, bill_date, due_date, current_balance, past_balance, total_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const billNum = invoice.billNumber ? invoice.billNumber.toString() : 'UNKNOWN';
    const accNum = invoice.account || '';
    const billDate = invoice.billDate?.formattedDate || '';
    const dueDate = invoice.dueDate?.formattedDate || '';
    const currentBalance = invoice.currentBalance || 0;
    const pastBalance = invoice.pastBalance || 0;
    const totalBalance = invoice.totalBalance || 0;

    await stmt.run(billNum, accNum, billDate, dueDate, currentBalance, pastBalance, totalBalance);
    await stmt.finalize();

    console.log(`    ✅  Invoice #${billNum} saved. Total Due: $${totalBalance.toFixed(2)}`);

    return invoice;
}

if (require.main === module) {
    fetchAndStoreBillingSummary()
        .then(() => process.exit(0))
        .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { fetchAndStoreBillingSummary };
