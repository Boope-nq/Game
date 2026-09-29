const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new'
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()));
    page.on('response', res => {
        if (res.url().includes('/api/auth/')) {
            res.text().then(t => console.log(`API [${res.status()}] ${res.url()}:`, t));
        }
    });

    await page.goto('http://localhost:3000/index.html');
    await page.click('#tab-login');
    await page.type('#login-user', 'captain_jack');
    await page.type('#login-pass', '123456');
    await page.click('#form-login button[type="submit"]');
    await new Promise(r => setTimeout(r, 1200));

    const loginErr = await page.$eval('#login-error', el => el.textContent);
    console.log('Login error displayed:', loginErr);

    await browser.close();
})();
