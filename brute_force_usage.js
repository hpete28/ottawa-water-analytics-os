const axios = require('axios');
require('dotenv').config();

const COOKIE = process.env.USER_COOKIE;
const csrf = (COOKIE.match(/__RequestVerificationToken=([^;]+)/) || [])[1] || '';

async function findUsageConfig() {
    const account = '10041554';
    const meters = ['21385413', '27577885']; // Old and suspected new
    const mids = ['480', '481', '2499', '2506', '2500', '2507', '2538'];
    const tids = ['88', '605', '606', '607', '608', '609', '610'];

    for (const meter of meters) {
        for (const mid of mids) {
            for (const tid of tids) {
                try {
                    const res = await axios.get('https://water-billing.ottawa.ca/en-ca/API/AdvancedUtility/UsageHistory/usagehistory/data', {
                        params: { meterNumber: meter, serviceCode: '30', date: '2025-12-31', granularity: 'Hour' },
                        headers: {
                            Cookie: COOKIE,
                            'X-Requested-With': 'XMLHttpRequest',
                            'RequestVerificationToken': csrf,
                            moduleid: mid,
                            tabid: tid
                        },
                        timeout: 5000
                    });
                    if (res.data && res.data.Success) {
                        console.log(`\nSUCCESS! meter=${meter}, mid=${mid}, tid=${tid}`);
                        console.log(JSON.stringify(res.data.Data).substring(0, 200));
                        return;
                    }
                } catch (e) {
                    process.stdout.write('.');
                }
            }
        }
    }
    console.log('\nFailed to find config.');
}

findUsageConfig();
