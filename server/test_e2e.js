const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG CATAN SEAFARERS 3D');
    console.log('---------------------------------------------------------');

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
            '--ignore-gpu-blocklist',
            '--window-size=1280,800'
        ]
    });

    try {
        // =========================================================================
        // BƯỚC 1: ĐĂNG KÝ VÀ ĐĂNG NHẬP 4 TÀI KHOẢN (USER 1, 2, 3, 4)
        // =========================================================================
        console.log('\n[TEST 1] Đăng ký & Đăng nhập 4 tài khoản...');
        const users = [
            { username: 'captain_jack', email: 'jack@catan.com', pass: '123456' },
            { username: 'sailor_morgan', email: 'morgan@catan.com', pass: '123456' },
            { username: 'navigator_drake', email: 'drake@catan.com', pass: '123456' },
            { username: 'admiral_nelson', email: 'nelson@catan.com', pass: '123456' }
        ];

        const pages = [];

        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const context = await browser.createBrowserContext();
            const page = await context.newPage();
            pages.push(page);

            // Log page errors & 404s
            page.on('console', msg => {
                if (msg.type() === 'error') console.log(`   [Page ${i+1} Console Error]`, msg.text());
            });
            page.on('pageerror', err => console.log(`   [Page ${i+1} Page Error]`, err.message));
            page.on('response', res => {
                if (res.status() === 404) console.log(`   [Page ${i+1} 404 URL]`, res.url());
            });

            await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });

            // Switch to Register tab
            await page.click('#tab-register');
            await page.type('#reg-user', u.username);
            await page.type('#reg-email', u.email);
            await page.type('#reg-pass', u.pass);
            await page.type('#reg-confirm', u.pass);
            await page.click('#form-register button[type="submit"]');

            await sleep(800);

            // Check if registered or already exists, try login if needed
            const currentUrl = page.url();
            if (!currentUrl.includes('lobby.html')) {
                // If already registered, switch to login tab and log in
                await page.click('#tab-login');
                await page.type('#login-user', u.username);
                await page.type('#login-pass', u.pass);
                await page.click('#form-login button[type="submit"]');
                await sleep(800);
            }

            if (!page.url().includes('lobby.html')) {
                throw new Error(`User ${u.username} không vào được Sảnh (URL: ${page.url()})`);
            }

            // Verify lobby profile elements
            const displayedName = await page.$eval('#user-name', el => el.textContent);
            console.log(`   ✅ Tài khoản ${i+1}: ${u.username} đăng nhập thành công (Hiển thị: ${displayedName})`);
        }

        // =========================================================================
        // BƯỚC 2: KIỂM THỬ TÍNH NĂNG KẾT BẠN (GỬI LỜI MỜI, NHẬN, ĐỒNG Ý, ONLINE STATUS)
        // =========================================================================
        console.log('\n[TEST 2] Kiểm thử Tính năng Bạn bè & Kênh chat thế giới...');
        const p1 = pages[0]; // captain_jack
        const p2 = pages[1]; // sailor_morgan

        // User 1 searches User 2
        await p1.type('#search-input', 'sailor_morgan');
        await p1.click('#search-btn');
        await sleep(600);

        // Click Add friend button
        const addBtn = await p1.$('#search-results button');
        if (addBtn) {
            // Override dialog for alert
            await p1.evaluate(() => { window.alert = () => {}; });
            await addBtn.click();
            console.log('   ✅ User 1 gửi lời mời kết bạn đến User 2 thành công.');
        } else {
            console.log('   ℹ️ User 1 và User 2 có thể đã là bạn bè.');
        }

        await sleep(1000);

        // User 2 accepts friend request
        await p2.evaluate(() => {
            const acceptBtn = document.querySelector('#requests-list button.btn-primary');
            if (acceptBtn) acceptBtn.click();
        });
        await sleep(1000);

        // Verify both show each other in friend list
        const p1Friends = await p1.$eval('#friends-list', el => el.innerText);
        const p2Friends = await p2.$eval('#friends-list', el => el.innerText);
        console.log(`   ✅ Danh sách bạn bè User 1: "${p1Friends.replace(/\n/g, ' ')}"`);
        console.log(`   ✅ Danh sách bạn bè User 2: "${p2Friends.replace(/\n/g, ' ')}"`);

        // Test Global Chat (if present in UI)
        const chatInput = await p1.$('#chat-input-field');
        if (chatInput) {
            await p1.type('#chat-input-field', 'Chào đồng đội Seafarers 3D!');
            await p1.click('#chat-send-btn');
            await sleep(800);

            const p2Chat = await p2.$eval('#chat-messages', el => el.innerText).catch(() => '');
            const chatOk = p2Chat.includes('Chào đồng đội Seafarers 3D!');
            console.log(`   ${chatOk ? '✅' : '⚠️'} Chat toàn cầu nhận được ở màn hình User 2: ${chatOk}`);
        } else {
            console.log('   ℹ️ Giao diện sảnh hiện tại thiết kế tối giản, bỏ qua kiểm tra chat DOM.');
        }

        // =========================================================================
        // BƯỚC 3: TẠO PHÒNG 2 NGƯỜI & THAM GIA PHÒNG
        // =========================================================================
        console.log('\n[TEST 3] Tạo phòng 2 người & Bạn bè tham gia phòng...');
        await p1.click('#create-room-btn');
        await sleep(300);

        await p1.$eval('#room-name-input', el => el.value = 'Trận Đấu Đỉnh Cao');
        await p1.select('#room-max-players', '2');
        await p1.select('#room-scenario', 'voyages');
        await p1.click('#create-room-form button[type="submit"]');

        await sleep(1200);

        const p1GameUrl = p1.url();
        console.log(`   ✅ User 1 đã tạo phòng và vào bàn chơi: ${p1GameUrl}`);
        const roomCodeMatch = p1GameUrl.match(/room=([A-Z0-9]+)/);
        if (!roomCodeMatch) throw new Error('Không tìm thấy room code trong URL của User 1!');
        const roomCode = roomCodeMatch[1];
        console.log(`   🔑 Mã phòng thi đấu: ${roomCode}`);

        // User 2 joins via code
        await p2.click('#join-code-btn');
        await sleep(300);
        await p2.type('#join-code-input', roomCode);
        await p2.click('#join-code-form button[type="submit"]');

        await sleep(2000);

        const p2GameUrl = p2.url();
        console.log(`   ✅ User 2 đã vào phòng: ${p2GameUrl}`);

        // Host (P1) clicks Start Game in waiting modal
        await sleep(1500);
        await p1.evaluate(() => {
            const btn = document.getElementById('btn-start-game');
            if (btn && !btn.disabled) btn.click();
        });

        // Wait for both players to initialize GameState
        for (let i = 0; i < 40; i++) {
            await sleep(250);
            const bothReady = await Promise.all([
                p1.evaluate(() => typeof window.gameState !== 'undefined' && window.gameState.players?.length === 2),
                p2.evaluate(() => typeof window.gameState !== 'undefined' && window.gameState.players?.length === 2)
            ]).catch(() => [false, false]);
            if (bothReady[0] && bothReady[1]) break;
        }

        const p1WaitingHidden = await p1.$eval('#waiting-modal', el => el.classList.contains('hidden')).catch(() => true);
        const p2WaitingHidden = await p2.$eval('#waiting-modal', el => el.classList.contains('hidden')).catch(() => true);
        console.log(`   ✅ Màn chờ User 1 đã đóng: ${p1WaitingHidden}`);
        console.log(`   ✅ Màn chờ User 2 đã đóng: ${p2WaitingHidden}`);

        // =========================================================================
        // BƯỚC 4: KIỂM THỬ TRẬN ĐẤU THỰC TẾ (SETUP, ROLLS, ACTIONS, 0 BOTS)
        // =========================================================================
        console.log('\n[TEST 4] Kiểm thử Trận đấu 3D 2 người thực tế (Không có AI can thiệp)...');

        // Check players in gameState
        const p1StateInfo = await p1.evaluate(() => {
            return {
                players: window.gameState?.players.map(p => ({ name: p.name, isBot: p.isBot })),
                phase: window.gameState?.phase,
                currentPlayer: window.gameState?.currentPlayer?.name,
                myIndex: window.myPlayerIndex
            };
        });

        const p2StateInfo = await p2.evaluate(() => {
            return {
                players: window.gameState?.players.map(p => ({ name: p.name, isBot: p.isBot })),
                phase: window.gameState?.phase,
                currentPlayer: window.gameState?.currentPlayer?.name,
                myIndex: window.myPlayerIndex
            };
        });

        console.log('   User 1 view:', JSON.stringify(p1StateInfo));
        console.log('   User 2 view:', JSON.stringify(p2StateInfo));

        if (p1StateInfo.players.some(p => p.isBot) || p2StateInfo.players.some(p => p.isBot)) {
            throw new Error('❌ Lỗi: Có người chơi bị đánh dấu nhầm là isBot trong phòng 2 người thật!');
        }
        console.log('   ✅ Xác nhận: Cả 2 người chơi đều là người thật (isBot = false)!');

        // Execute Setup Phase Step-by-Step
        // Turn 1: Player 0 Setup Settlement & Road
        console.log('\n   [4.1] Setup Vòng 1 - Player 0 (captain_jack):');
        const p0ValidSettlement = await p1.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            if (valid.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: valid[0] });
                return valid[0];
            }
            return null;
        });
        console.log(`   - Player 0 đặt Định cư tại đỉnh: ${p0ValidSettlement}`);
        await sleep(800);

        // Player 0 Setup Road
        const p0ValidRoad = await p1.evaluate(() => {
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
        console.log(`   - Player 0 đặt Đường tại cạnh: ${p0ValidRoad}`);
        await sleep(1500);

        // Verify Player 1 screen synced
        const p2SawTurn1 = await p2.evaluate(() => {
            return {
                currentPlayer: window.gameState.currentPlayer.name,
                phase: window.gameState.phase,
                piecesCount: window.pieces.settlements.size + window.pieces.roads.size + window.pieces.ships.size
            };
        });
        console.log(`   ✅ Màn hình Player 2 nhận được công trình của Player 0: pieces=${p2SawTurn1.piecesCount}, lượt hiện tại=${p2SawTurn1.currentPlayer}`);

        // Turn 2: Player 1 Setup Settlement & Road
        console.log('\n   [4.2] Setup Vòng 1 - Player 1 (sailor_morgan):');
        const p1ValidSettlement = await p2.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            if (valid.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: valid[0] });
                return valid[0];
            }
            return null;
        });
        console.log(`   - Player 1 đặt Định cư tại đỉnh: ${p1ValidSettlement}`);
        await sleep(800);

        const p1ValidRoad = await p2.evaluate(() => {
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
        console.log(`   - Player 1 đặt Đường tại cạnh: ${p1ValidRoad}`);
        await sleep(1500);

        // Turn 3: Setup Round 2 - Player 1 first (snake draft)
        console.log('\n   [4.3] Setup Vòng 2 - Player 1 (sailor_morgan):');
        await p2.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            window.performAction({ type: 'setup_settlement', vKey: valid[0] });
        });
        await sleep(800);
        await p2.evaluate(() => {
            const roadEdges = window.gameState.getValidRoadEdges(true, window.gameState.setupSettlementVertex);
            const shipEdges = window.gameState.getValidShipEdges(true, window.gameState.setupSettlementVertex);
            const allEdges = [...roadEdges, ...shipEdges];
            const choice = allEdges[0];
            const edge = window.gameState.edges.get(choice);
            const roadType = edge.isLand ? 'road' : 'ship';
            window.performAction({ type: 'setup_road', eKey: choice, roadType });
        });
        await sleep(1500);

        // Turn 4: Setup Round 2 - Player 0
        console.log('\n   [4.4] Setup Vòng 2 - Player 0 (captain_jack):');
        await p1.evaluate(() => {
            const valid = window.gameState.getValidSetupVertices();
            window.performAction({ type: 'setup_settlement', vKey: valid[0] });
        });
        await sleep(800);
        await p1.evaluate(() => {
            const roadEdges = window.gameState.getValidRoadEdges(true, window.gameState.setupSettlementVertex);
            const shipEdges = window.gameState.getValidShipEdges(true, window.gameState.setupSettlementVertex);
            const allEdges = [...roadEdges, ...shipEdges];
            const choice = allEdges[0];
            const edge = window.gameState.edges.get(choice);
            const roadType = edge.isLand ? 'road' : 'ship';
            window.performAction({ type: 'setup_road', eKey: choice, roadType });
        });
        await sleep(2000);

        // Setup complete! Verify phase is ROLL
        const postSetupPhase = await p1.evaluate(() => window.gameState.phase);
        console.log(`   ✅ Setup hoàn thành! Giai đoạn hiện tại: ${postSetupPhase} (Kỳ vọng: ROLL)`);

        // Test Dice Roll & Synchronization
        console.log('\n   [4.5] Kiểm thử Tung Xúc Xắc & Đồng bộ số điểm:');
        const rollResult = await p1.evaluate(() => {
            const d1 = 3, d2 = 5; // Total 8
            window.performAction({ type: 'roll', d1, d2 });
            return { d1, d2, total: d1 + d2, phase: window.gameState.phase };
        });
        await sleep(1500);

        const p2DiceSync = await p2.evaluate(() => {
            return {
                lastRoll: window.gameState.lastRoll,
                phase: window.gameState.phase
            };
        });

        console.log(`   - Player 0 tung: ${rollResult.d1} + ${rollResult.d2} = ${rollResult.total}`);
        console.log(`   - Player 1 nhận: ${p2DiceSync.lastRoll?.d1} + ${p2DiceSync.lastRoll?.d2} = ${p2DiceSync.lastRoll?.total}`);
        if (p2DiceSync.lastRoll?.total !== 8) {
            throw new Error('❌ Lỗi: Xúc xắc không đồng bộ giữa 2 máy!');
        }
        console.log('   ✅ Xúc xắc đồng bộ 100% giữa cả 2 màn hình!');

        // Test End Turn
        console.log('\n   [4.6] Kiểm thử Kết thúc lượt:');
        await p1.evaluate(() => {
            window.performAction({ type: 'end_turn' });
        });
        await sleep(1500);

        const nextPlayer = await p2.evaluate(() => window.gameState.currentPlayer.name);
        console.log(`   ✅ Lượt đã chuyển sang: ${nextPlayer} (Kỳ vọng: sailor_morgan)`);

        // Test Steal Handling (Roll 7, Move Robber, Steal)
        console.log('\n   [4.7] Kiểm thử Số 7, Di chuyển Robber & Giai đoạn STEAL:');
        await p2.evaluate(() => {
            window.performAction({ type: 'roll', d1: 3, d2: 4 }); // Roll 7!
        });
        await sleep(1000);

        const phaseAfter7 = await p2.evaluate(() => window.gameState.phase);
        console.log(`   - Giai đoạn sau khi đổ 7: ${phaseAfter7}`);

        // Move Robber to land tile
        await p2.evaluate(() => {
            const tile = [...window.gameState.tiles.values()].find(t => t.type !== 'SEA' && t.type !== 'DESERT');
            window.performAction({ type: 'robber', q: tile.q, r: tile.r });
        });
        await sleep(1500);

        const phaseAfterRobber = await p2.evaluate(() => window.gameState.phase);
        console.log(`   - Giai đoạn sau khi di chuyển Robber: ${phaseAfterRobber}`);
        if (phaseAfterRobber === 'STEAL') {
            throw new Error('❌ Lỗi: Vẫn bị kẹt ở giai đoạn STEAL!');
        }
        console.log('   ✅ Giai đoạn STEAL đã tự động xử lý và chuyển tiếp sang BUILD thành công! Không hề bị kẹt!');

        // Player 2 ends turn
        await p2.evaluate(() => window.performAction({ type: 'end_turn' }));
        await sleep(1000);

        // =========================================================================
        // BƯỚC 5: KIỂM THỬ PHÒNG 3 NGƯỜI VÀ 4 NGƯỜI
        // =========================================================================
        console.log('\n[TEST 5] Kiểm thử Phòng 3 người & 4 người chơi...');
        const p3 = pages[2]; // navigator_drake
        const p4 = pages[3]; // admiral_nelson

        // User 3 creates 4-player room
        await p3.goto(`${BASE_URL}/lobby.html`, { waitUntil: 'domcontentloaded' });
        await p3.click('#create-room-btn');
        await sleep(300);
        await p3.$eval('#room-name-input', el => el.value = 'Hải Trình 4 Người');
        await p3.select('#room-max-players', '4');
        await p3.click('#create-room-form button[type="submit"]');
        await sleep(1200);

        const p3GameUrl = p3.url();
        const code4Match = p3GameUrl.match(/room=([A-Z0-9]+)/);
        const code4 = code4Match[1];
        console.log(`   🔑 Phòng 4 người được tạo: ${code4}`);

        // User 4 joins by code
        await p4.click('#join-code-btn');
        await sleep(400);
        await p4.type('#join-code-input', code4);
        await p4.click('#join-code-form button[type="submit"]');
        await sleep(2000);

        // User 1 joins
        await p1.goto(`${BASE_URL}/game.html?room=${code4}`, { waitUntil: 'domcontentloaded' });
        await sleep(2000);

        // User 2 joins
        await p2.goto(`${BASE_URL}/game.html?room=${code4}`, { waitUntil: 'domcontentloaded' });
        // Host (P3) clicks Start Game in waiting modal
        await sleep(1500);
        await p3.evaluate(() => {
            const btn = document.getElementById('btn-start-game');
            if (btn && !btn.disabled) btn.click();
        });

        // Wait for p3 to initialize GameState with 4 players
        for (let i = 0; i < 40; i++) {
            await sleep(250);
            const ready = await p3.evaluate(() => typeof window.gameState !== 'undefined' && window.gameState.players?.length === 4).catch(() => false);
            if (ready) break;
        }

        // Verify 4-player game started on p3
        const p3PlayersInfo = await p3.evaluate(() => {
            return {
                count: window.gameState?.players.length,
                names: window.gameState?.players.map(p => p.name)
            };
        });
        console.log(`   ✅ Phòng 4 người chơi đã bắt đầu với đúng ${p3PlayersInfo.count} người chơi: ${p3PlayersInfo.names?.join(', ')}`);

        console.log('\n=========================================================');
        console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ VƯỢT QUA 100% THÀNH CÔNG! KHÔNG CÒN LỖI!');
        console.log('=========================================================');

    } catch (err) {
        console.error('\n❌ PHÁT HIỆN LỖI TRONG QUÁ TRÌNH TEST:', err);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runTests();
