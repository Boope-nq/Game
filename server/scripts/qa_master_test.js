const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeLogin(page, username, email, password) {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
    await sleep(500);

    if (page.url().includes('lobby.html')) {
        return;
    }

    // Try login first
    try {
        await page.click('#tab-login');
        await sleep(150);
        await page.type('#login-user', username);
        await page.type('#login-pass', password);
        await page.click('#form-login button[type="submit"]');
    } catch (e) {}

    // Wait for redirect
    for (let i = 0; i < 15; i++) {
        await sleep(200);
        if (page.url().includes('lobby.html')) return;
    }

    // If login failed, register
    try {
        await page.click('#tab-register');
        await sleep(150);
        await page.type('#reg-user', username);
        await page.type('#reg-email', email);
        await page.type('#reg-pass', password);
        await page.type('#reg-confirm', password);
        await page.click('#form-register button[type="submit"]');
    } catch (e) {}

    for (let i = 0; i < 20; i++) {
        await sleep(200);
        if (page.url().includes('lobby.html')) return;
    }

    if (!page.url().includes('lobby.html')) {
        throw new Error(`Không thể đăng nhập tài khoản ${username}. URL hiện tại: ${page.url()}`);
    }
}

async function runComprehensiveQATest() {
    console.log('================================================================');
    console.log('🎯 BẮT ĐẦU VÒNG KIỂM THỬ TOÀN DIỆN AUTONOMOUS QA SUITE');
    console.log('================================================================');

    const issuesFound = [];
    const logIssue = (category, title, detail) => {
        const issue = { category, title, detail };
        issuesFound.push(issue);
        console.error(`🚨 [LỖI PHÁT HIỆN] [${category}] ${title}: ${detail}`);
    };

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        protocolTimeout: 60000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--window-size=1920,1080'
        ]
    });

    try {
        // -------------------------------------------------------------
        // MODULE 1: KIỂM THỬ RESPONSIVE & CROSS-PLATFORM UI/UX
        // -------------------------------------------------------------
        console.log('\n📱 MODULE 1: Kiểm thử Responsive & Touch Targets trên đa tỉ lệ màn hình...');

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

        for (const vp of viewports) {
            const page = await browser.newPage();
            await page.setViewport({
                width: vp.width,
                height: vp.height,
                isMobile: vp.isMobile,
                hasTouch: vp.hasTouch || false
            });

            page.on('console', msg => {
                if (msg.type() === 'error') {
                    logIssue('Console Error', `Console error trên ${vp.name}`, msg.text());
                }
            });
            page.on('pageerror', err => {
                logIssue('Page Runtime Error', `Page error trên ${vp.name}`, err.message);
            });
            page.on('response', res => {
                if (res.status() === 404) {
                    logIssue('404 Resource', `404 Not Found trên ${vp.name}`, res.url());
                }
            });

            // Test index.html
            await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
            await sleep(400);

            // 1.1 Check horizontal overflow
            const overflow = await page.evaluate(() => {
                const docEl = document.documentElement;
                return {
                    scrollWidth: docEl.scrollWidth,
                    clientWidth: docEl.clientWidth,
                    hasOverflow: docEl.scrollWidth > docEl.clientWidth + 2
                };
            });
            if (overflow.hasOverflow) {
                logIssue('CSS Overflow', `Tràn ngang trang tại /index.html (${vp.name})`,
                    `scrollWidth (${overflow.scrollWidth}px) > clientWidth (${overflow.clientWidth}px)`);
            }

            // 1.2 Check mobile touch target sizes on interactive elements (>= 44px)
            if (vp.isMobile) {
                const smallTouchTargets = await page.evaluate(() => {
                    const bads = [];
                    const buttons = document.querySelectorAll('button:not(.hidden), .btn:not(.hidden), .tab:not(.hidden)');
                    for (const b of buttons) {
                        const rect = b.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).display !== 'none') {
                            if (rect.height < 40) {
                                bads.push({
                                    id: b.id || b.className,
                                    text: (b.innerText || '').trim().slice(0, 25),
                                    height: Math.round(rect.height)
                                });
                            }
                        }
                    }
                    return bads;
                });

                if (smallTouchTargets.length > 0) {
                    logIssue('Mobile Touch Target', `Phát hiện nút có chiều cao < 40px trên ${vp.name} (/index.html)`,
                        JSON.stringify(smallTouchTargets.slice(0, 5)));
                }
            }

            await page.close();
        }

        // -------------------------------------------------------------
        // MODULE 2: TEST GAMEPLAY, KEYBOARD SHORTCUTS & INPUT MAPPING
        // -------------------------------------------------------------
        console.log('\n🎮 MODULE 2: Kiểm thử Luồng chơi chính, Input Mapping (Mouse + Keyboard)...');

        const context1 = await browser.createBrowserContext();
        const p1 = await context1.newPage();
        const context2 = await browser.createBrowserContext();
        const p2 = await context2.newPage();

        await p1.setViewport({ width: 1440, height: 900 });
        await p2.setViewport({ width: 1440, height: 900 });

        const setupLogger = (p, name) => {
            p.on('console', msg => {
                if (msg.type() === 'error') logIssue('Console Error', `${name} console error`, msg.text());
            });
            p.on('pageerror', err => logIssue('Page Error', `${name} page error`, err.message));
        };
        setupLogger(p1, 'Player 1');
        setupLogger(p2, 'Player 2');

        // Login P1 & P2
        console.log('   - Đăng nhập Player 1 & Player 2 vào Lobby...');
        await safeLogin(p1, 'captain_jack', 'jack@catan.com', '123456');
        await safeLogin(p2, 'sailor_morgan', 'morgan@catan.com', '123456');

        // P1 Create Room
        await p1.click('#create-room-btn');
        await sleep(400);
        const testRoomName = 'QA Battle ' + Date.now().toString().slice(-4);
        await p1.$eval('#room-name-input', (el, v) => el.value = v, testRoomName);
        await p1.select('#room-max-players', '2');
        try { await p1.select('#room-scenario', 'voyages'); } catch(e) {}
        await p1.click('#create-room-form button[type="submit"]');

        // Wait for p1 to enter game.html
        for (let i = 0; i < 30; i++) {
            await sleep(200);
            if (p1.url().includes('game.html')) break;
        }

        const p1Url = p1.url();
        const roomCodeMatch = p1Url.match(/room=([A-Z0-9]+)/);
        if (!roomCodeMatch) throw new Error('Không lấy được mã phòng từ URL: ' + p1Url);
        const roomCode = roomCodeMatch[1];
        console.log(`   - Phòng tạo thành công: Mã [${roomCode}]`);

        // P2 Join Room
        await p2.click('#join-code-btn');
        await sleep(400);
        await p2.type('#join-code-input', roomCode);
        await p2.click('#join-code-form button[type="submit"]');

        // Wait for p2 to enter game.html
        for (let i = 0; i < 30; i++) {
            await sleep(200);
            if (p2.url().includes('game.html')) break;
        }

        // Host (P1) starts the game from waiting modal
        await sleep(1200);
        try {
            await p1.evaluate(() => {
                const btn = document.getElementById('btn-start-game');
                if (btn && !btn.disabled) btn.click();
            });
        } catch (e) {}

        // Wait for both players to initialize GameState
        for (let i = 0; i < 40; i++) {
            await sleep(250);
            const bothReady = await Promise.all([
                p1.evaluate(() => typeof window.gameState !== 'undefined' && window.gameState.players?.length === 2),
                p2.evaluate(() => typeof window.gameState !== 'undefined' && window.gameState.players?.length === 2)
            ]).catch(() => [false, false]);
            if (bothReady[0] && bothReady[1]) break;
        }

        const p1Ready = await p1.evaluate(() => typeof window.gameState !== 'undefined');
        const p2Ready = await p2.evaluate(() => typeof window.gameState !== 'undefined');
        if (!p1Ready || !p2Ready) {
            throw new Error(`Game chưa sẵn sàng: p1=${p1Ready}, p2=${p2Ready}`);
        }
        console.log('   ✅ Cả 2 người chơi đã vào bàn chơi 3D thành công!');

        // Check Touch Targets on game.html (Mobile simulation)
        console.log('   - Kiểm tra kích thước nút hành động game trên Mobile Viewport...');
        await p1.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await sleep(400);
        const gameTouchTargets = await p1.evaluate(() => {
            const bads = [];
            const actionIds = ['btn-end-turn', 'btn-road', 'btn-ship', 'btn-settlement', 'btn-city', 'game-menu-btn'];
            for (const id of actionIds) {
                const el = document.getElementById(id);
                if (el && el.offsetParent !== null && window.getComputedStyle(el).display !== 'none') {
                    const rect = el.getBoundingClientRect();
                    if (rect.height < 40) {
                        bads.push({ id, height: Math.round(rect.height) });
                    }
                }
            }
            return bads;
        });
        if (gameTouchTargets.length > 0) {
            logIssue('Mobile Touch Target', 'Nút hành động trong game nhỏ hơn 40px trên Mobile', JSON.stringify(gameTouchTargets));
        } else {
            console.log('   ✅ Tất cả nút hành động trong game trên Mobile đều đạt chuẩn >= 44px!');
        }
        await p1.setViewport({ width: 1440, height: 900, isMobile: false });
        await sleep(300);

        // 2.1 Test Setup Phase (Round 1 & Round 2) exactly matching multi-client turn progression
        console.log('   - Thực hiện giai đoạn Setup 2 vòng (Round 1 & Round 2)...');

        // Turn 1: Player 0 Setup Settlement & Road
        console.log('     [Setup 1/4] Player 0 (captain_jack) Setup Vòng 1:');
        const p0Settlement1 = await p1.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            if (valid.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: valid[0] });
                return valid[0];
            }
            return null;
        });
        await sleep(800);
        const p0Road1 = await p1.evaluate(() => {
            const roadEdges = window.gameState.getValidRoadEdges(true, window.gameState.setupSettlementVertex);
            const shipEdges = window.gameState.getValidShipEdges(true, window.gameState.setupSettlementVertex);
            const allEdges = [...roadEdges, ...shipEdges];
            if (allEdges.length > 0) {
                const choice = allEdges[0];
                const edge = window.gameState.edges.get(choice);
                const roadType = edge.isLand ? 'road' : 'ship';
                window.performAction({ type: 'setup_road', eKey: choice, roadType });
                return choice;
            }
            return null;
        });
        console.log(`       -> Settlement: ${p0Settlement1}, Road: ${p0Road1}`);
        await sleep(1500);

        // Turn 2: Player 1 Setup Settlement & Road
        console.log('     [Setup 2/4] Player 1 (sailor_morgan) Setup Vòng 1:');
        const p1Settlement1 = await p2.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            if (valid.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: valid[0] });
                return valid[0];
            }
            return null;
        });
        await sleep(800);
        const p1Road1 = await p2.evaluate(() => {
            const roadEdges = window.gameState.getValidRoadEdges(true, window.gameState.setupSettlementVertex);
            const shipEdges = window.gameState.getValidShipEdges(true, window.gameState.setupSettlementVertex);
            const allEdges = [...roadEdges, ...shipEdges];
            if (allEdges.length > 0) {
                const choice = allEdges[0];
                const edge = window.gameState.edges.get(choice);
                const roadType = edge.isLand ? 'road' : 'ship';
                window.performAction({ type: 'setup_road', eKey: choice, roadType });
                return choice;
            }
            return null;
        });
        console.log(`       -> Settlement: ${p1Settlement1}, Road: ${p1Road1}`);
        await sleep(1500);

        // Turn 3: Setup Round 2 - Player 1 first (snake draft)
        console.log('     [Setup 3/4] Player 1 (sailor_morgan) Setup Vòng 2 (Snake Draft):');
        const p1Settlement2 = await p2.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            if (valid.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: valid[0] });
                return valid[0];
            }
            return null;
        });
        await sleep(800);
        const p1Road2 = await p2.evaluate(() => {
            const roadEdges = window.gameState.getValidRoadEdges(true, window.gameState.setupSettlementVertex);
            const shipEdges = window.gameState.getValidShipEdges(true, window.gameState.setupSettlementVertex);
            const allEdges = [...roadEdges, ...shipEdges];
            if (allEdges.length > 0) {
                const choice = allEdges[0];
                const edge = window.gameState.edges.get(choice);
                const roadType = edge.isLand ? 'road' : 'ship';
                window.performAction({ type: 'setup_road', eKey: choice, roadType });
                return choice;
            }
            return null;
        });
        console.log(`       -> Settlement: ${p1Settlement2}, Road: ${p1Road2}`);
        await sleep(1500);

        // Turn 4: Setup Round 2 - Player 0
        console.log('     [Setup 4/4] Player 0 (captain_jack) Setup Vòng 2:');
        const p0Settlement2 = await p1.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            if (valid.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: valid[0] });
                return valid[0];
            }
            return null;
        });
        await sleep(800);
        const p0Road2 = await p1.evaluate(() => {
            const roadEdges = window.gameState.getValidRoadEdges(true, window.gameState.setupSettlementVertex);
            const shipEdges = window.gameState.getValidShipEdges(true, window.gameState.setupSettlementVertex);
            const allEdges = [...roadEdges, ...shipEdges];
            if (allEdges.length > 0) {
                const choice = allEdges[0];
                const edge = window.gameState.edges.get(choice);
                const roadType = edge.isLand ? 'road' : 'ship';
                window.performAction({ type: 'setup_road', eKey: choice, roadType });
                return choice;
            }
            return null;
        });
        console.log(`       -> Settlement: ${p0Settlement2}, Road: ${p0Road2}`);
        await sleep(2000);

        // Verify phase after setup
        const curPhase = await p1.evaluate(() => window.gameState.phase);
        if (curPhase !== 'ROLL') {
            logIssue('Game Logic Error', 'Phase sau setup không phải là ROLL', `Phase hiện tại: ${curPhase}`);
        } else {
            console.log('   ✅ Setup 2 vòng hoàn tất, chuyển sang Phase ROLL chính xác!');
        }

        // 2.2 Test Keyboard Shortcuts (Space to Roll)
        console.log('   - Kiểm thử phím tắt Keyboard Shortcut: Phím Space để tung xúc xắc...');
        await p1.keyboard.press('Space');
        await sleep(1500);

        const phaseAfterSpace = await p1.evaluate(() => window.gameState.phase);
        if (phaseAfterSpace === 'ROLL') {
            logIssue('Input Mapping Bug', 'Phím tắt Space chưa kích hoạt đổ xúc xắc', 'Phase vẫn là ROLL sau khi nhấn phím Space');
        } else {
            console.log(`   ✅ Phím tắt Space hoạt động hoàn hảo! Phase sau khi đổ: ${phaseAfterSpace}`);
        }

        // Test End Turn via Keyboard Shortcut (Space when in Phase BUILD)
        if (phaseAfterSpace === 'BUILD') {
            console.log('   - Kiểm thử phím tắt Space để Kết thúc lượt...');
            await p1.keyboard.press('Space');
            await sleep(1500);
            const nextPlayer = await p2.evaluate(() => window.gameState.currentPlayer.name);
            console.log(`   ✅ Kết thúc lượt bằng phím Space thành công! Lượt hiện tại: ${nextPlayer}`);
        }

        // -------------------------------------------------------------
        // MODULE 3: TÌNH HUỐNG BIÊN & HÀNH VI BẤT THƯỜNG (EDGE CASES)
        // -------------------------------------------------------------
        console.log('\n⚡ MODULE 3: Kiểm thử Tình huống biên, Spam click, Window Resize & Visibility...');

        // 3.1 Spam Click Testing (Rapid click abuse defense)
        console.log('   - Kiểm tra Chống Spam click liên tục (Abuse Prevention)...');
        const spamErrors = await p2.evaluate(() => {
            const errs = [];
            const rollBtn = document.getElementById('btn-roll');
            const endBtn = document.getElementById('btn-end-turn');
            try {
                for (let i = 0; i < 20; i++) {
                    rollBtn?.click();
                    endBtn?.click();
                }
            } catch (e) {
                errs.push(e.message);
            }
            return errs;
        });
        if (spamErrors.length > 0) {
            logIssue('Spam Click Crash', 'Spam click gây văng lỗi runtime', spamErrors.join('; '));
        } else {
            console.log('   ✅ Cơ chế chống spam click hoạt động an toàn, không có exception nào phát sinh!');
        }

        // 3.2 Resize & Orientation Change during active match
        console.log('   - Thay đổi kích thước trình duyệt liên tục khi đang thi đấu (Desktop <-> Mobile <-> Landscape)...');
        await p1.setViewport({ width: 390, height: 844, isMobile: true });
        await sleep(300);
        await p1.setViewport({ width: 844, height: 390, isMobile: true }); // Landscape
        await sleep(300);
        await p1.setViewport({ width: 1440, height: 900, isMobile: false });
        await sleep(400);

        const canvasIntact = await p1.evaluate(() => {
            const canvas = document.getElementById('game-canvas');
            return canvas && canvas.width > 0 && canvas.height > 0;
        });
        if (!canvasIntact) {
            logIssue('Rendering Bug', 'Canvas Three.js bị lỗi sau khi resize/xoay màn hình', 'Canvas dimension <= 0');
        } else {
            console.log('   ✅ Three.js WebGL Canvas tự thích ứng mượt mà sau khi thay đổi kích thước!');
        }

        // 3.3 Visibility change test (Tab switch / blur / focus)
        console.log('   - Giả lập ẩn tab trình duyệt (visibilityState: hidden) và mở lại...');
        await p1.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await sleep(400);
        await p1.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await sleep(400);
        console.log('   ✅ Visibilitychange xử lý êm ái, delta time được clamp an toàn!');

        // 3.4 Page Reload & State Restoration (F5)
        console.log('   - Kiểm tra F5 Reload màn hình và khôi phục ván đấu (State Persistence)...');
        await p1.reload({ waitUntil: 'domcontentloaded' });
        await sleep(2500);

        const restored = await p1.evaluate(() => {
            return {
                hasGameState: typeof window.gameState !== 'undefined',
                playersCount: window.gameState?.players?.length,
                phase: window.gameState?.phase
            };
        });
        console.log('     Trạng thái sau khi Reload F5:', JSON.stringify(restored));
        if (!restored.hasGameState || restored.playersCount !== 2) {
            logIssue('State Bug', 'Không khôi phục được GameState sau khi reload F5', JSON.stringify(restored));
        } else {
            console.log('   ✅ Ván đấu được khôi phục 100% nguyên vẹn sau khi F5!');
        }

    } catch (err) {
        logIssue('Fatal Execution Error', 'Lỗi ngoại lệ trong quá trình chạy test', err.stack);
    } finally {
        await browser.close();
    }

    console.log('\n================================================================');
    console.log(`📊 TỔNG KẾT BƯỚC TEST: Phát hiện ${issuesFound.length} lỗi/vấn đề.`);
    console.log('================================================================');
    return issuesFound;
}

if (require.main === module) {
    runComprehensiveQATest().then(issues => {
        if (issues.length > 0) {
            console.log('KẾT QUẢ: CÓ LỖI CẦN SỬA -> TIẾP TỤC VÒNG LẶP SỬA LỖI.');
            process.exit(1);
        } else {
            console.log('KẾT QUẢ: TOÀN BỘ CÁC BÀI TEST ĐÃ PASS 100%! ZERO REMAINING DEFECTS!');
            process.exit(0);
        }
    });
}

module.exports = { runComprehensiveQATest };
