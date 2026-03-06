const { refreshSessionCookie } = require('./services/AuthScraper');

async function testAuth() {
    console.log('🚀 Starting Automated Auth Test...');
    try {
        const success = await refreshSessionCookie();
        if (success) {
            console.log('\n✨ TEST SUCCESSFUL!');
            console.log('The headless browser logged in and updated your .env with a fresh cookie.');
        }
    } catch (err) {
        console.error('\n❌ TEST FAILED');
        console.error(err.message);
        console.log('\nPlease check that your OTTAWA_EMAIL and OTTAWA_PASSWORD are correct in .env.');
    }
}

testAuth();
