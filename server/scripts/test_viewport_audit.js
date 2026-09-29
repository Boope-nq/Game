const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

const viewports = [
    { name: 'Desktop Full HD (1920x1080)', width: 1920, height: 1080, isMobile: false },
    { name: 'Desktop WXGA+ (1440x900)', width: 1440, height: 900, isMobile: false },
    { name: 'Laptop Standard (1366x768)', width: 1366, height: 768, isMobile: false },
    { name: 'Mobile iPhone SE (375x667)', width: 375, height: 667, isMobile: true, hasTouch: true },
    { name: 'Mobile iPhone 14/15 (390x844)', width: 390, height: 844, isMobile: true, hasTouch: true },
    { name: 'Mobile Pro Max (430x932)', width: 430, height: 932, isMobile: true, hasTouch: true },
    { name: 'Mobile Android (360x800)', width: 360, height: 800, isMobile: true, hasTouch: true },
    { name: 'Mobile Landscape (844x390)', width: 844, height: 390, isMobile: true, hasTouch: true }
];

async function runAudit() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-webgl',
            '--ignore-gpu-blocklist'
        ]
    });

    const issues = [];

    // First login to get token and localstorage for lobby and game pages
    const context = await browser.createBrowserContext();
    const loginPage = await context.newPage();
    await loginPage.goto(`${BASE_URL}/index.html`);
    await loginPage.type('#login-user', 'captain_jack');
    await loginPage.type('#login-pass', '123456');
    await loginPage.click('#form-login button[type="submit"]');
    await new Promise(r => setTimeout(r, 1000));

    const token = await loginPage.evaluate(() => localStorage.getItem('token'));
    const user = await loginPage.evaluate(() => localStorage.getItem('user'));
    await loginPage.close();

    const pagesToTest = [
        { url: `${BASE_URL}/index.html`, name: 'index.html', needAuth: false },
        { url: `${BASE_URL}/lobby.html`, name: 'lobby.html', needAuth: true },
        { url: `${BASE_URL}/game.html?room=TESTWIN`, name: 'game.html', needAuth: true }
    ];

    for (const pageInfo of pagesToTest) {
        console.log(`\n--- Auditing ${pageInfo.name} ---`);
        for (const vp of viewports) {
            const page = await context.newPage();
            await page.setViewport({
                width: vp.width,
                height: vp.height,
                isMobile: vp.isMobile,
                hasTouch: vp.hasTouch || false
            });

            if (pageInfo.needAuth) {
                await page.evaluateOnNewDocument((t, u) => {
                    localStorage.setItem('token', t);
                    localStorage.setItem('user', u);
                    localStorage.setItem('username', 'captain_jack');
                }, token, user);
            }

            page.on('console', msg => {
                if (msg.type() === 'error') {
                    issues.push({ type: 'Console Error', page: pageInfo.name, vp: vp.name, msg: msg.text() });
                }
            });
            page.on('pageerror', err => {
                issues.push({ type: 'Page Error', page: pageInfo.name, vp: vp.name, msg: err.message });
            });
            page.on('response', res => {
                if (res.status() === 404) {
                    issues.push({ type: '404 Resource', page: pageInfo.name, vp: vp.name, msg: res.url() });
                }
            });

            await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 600));

            // Check horizontal overflow
            const overflow = await page.evaluate(() => {
                const docEl = document.documentElement;
                return {
                    scrollWidth: docEl.scrollWidth,
                    clientWidth: docEl.clientWidth,
                    hasOverflow: docEl.scrollWidth > docEl.clientWidth + 2
                };
            });
            if (overflow.hasOverflow) {
                issues.push({
                    type: 'CSS Overflow',
                    page: pageInfo.name,
                    vp: vp.name,
                    msg: `scrollWidth (${overflow.scrollWidth}px) > clientWidth (${overflow.clientWidth}px)`
                });
            }

            // Check mobile touch target sizes on visible interactive elements (< 44px)
            if (vp.isMobile) {
                const smallTouchTargets = await page.evaluate(() => {
                    const bads = [];
                    const targets = document.querySelectorAll('button, .btn, .tab, .profile-tab-btn, input, select');
                    for (const el of targets) {
                        if (el.classList.contains('hidden') || el.offsetParent === null) continue;
                        const style = window.getComputedStyle(el);
                        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            if (rect.height < 40 || rect.width < 40) {
                                bads.push({
                                    id: el.id || el.className,
                                    text: (el.innerText || el.value || el.placeholder || '').trim().slice(0, 20),
                                    w: Math.round(rect.width),
                                    h: Math.round(rect.height)
                                });
                            }
                        }
                    }
                    return bads;
                });
                if (smallTouchTargets.length > 0) {
                    issues.push({
                        type: 'Mobile Touch Target',
                        page: pageInfo.name,
                        vp: vp.name,
                        msg: JSON.stringify(smallTouchTargets)
                    });
                }
            }

            await page.close();
        }
    }

    await browser.close();

    console.log('\n========================================');
    console.log(`TOTAL ISSUES FOUND: ${issues.length}`);
    console.log('========================================');
    for (const iss of issues) {
        console.log(`[${iss.type}] [${iss.page} - ${iss.vp}]: ${iss.msg}`);
    }
    return issues;
}

runAudit();
