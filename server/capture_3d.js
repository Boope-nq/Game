const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function captureBoard() {
    console.log('📸 Đang khởi chạy Chrome để kiểm thử & chụp ảnh đồ họa 3D, xúc xắc 3D & hồ sơ người chơi...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('[Browser Error]', msg.text());
        }
    });

    // Login via API to get token
    await page.goto('http://localhost:3000/index.html');
    const authData = await page.evaluate(async () => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernameOrEmail: 'captain_jack', password: '123456' })
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            localStorage.setItem('user', JSON.stringify(data.user));
            return data;
        }
        return null;
    });

    console.log('Auth status:', authData ? 'OK' : 'FAIL');

    // Create room via API
    const roomCode = 'VIEW3D';
    await page.evaluate(async (code) => {
        const token = localStorage.getItem('token');
        await fetch('/api/rooms/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: '3D Preview Room', maxPlayers: 2, scenario: 'voyages' })
        });
    }, roomCode);

    // Open game page directly
    await page.goto(`http://localhost:3000/game.html?room=${roomCode}`, { waitUntil: 'networkidle0' });

    // Click "🤖 Chơi ngay (Lấp đầy slot bằng Bot AI)"
    await page.waitForSelector('#btn-start-with-bots', { visible: true });
    await page.click('#btn-start-with-bots');
    await page.waitForFunction(() => document.getElementById('waiting-modal').classList.contains('hidden'));

    // Wait for 3D board to initialize and render
    await new Promise(r => setTimeout(r, 2000));

    // Finish Setup Round 1 & 2 to enter ROLL phase
    await page.evaluate(() => {
        if (window.gameState && window.performAction) {
            // Player 0 Setup 1
            const vKeys1 = window.gameState.getValidSetupVertices();
            if (vKeys1.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: vKeys1[0] });
                const rKeys1 = window.gameState.getValidRoadEdges(true, vKeys1[0]);
                if (rKeys1.length > 0) window.performAction({ type: 'setup_road', eKey: rKeys1[0], roadType: 'road' });
            }
            // Player 1 (Bot) Setup 1
            const vKeys2 = window.gameState.getValidSetupVertices();
            if (vKeys2.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: vKeys2[0] });
                const rKeys2 = window.gameState.getValidRoadEdges(true, vKeys2[0]);
                if (rKeys2.length > 0) window.performAction({ type: 'setup_road', eKey: rKeys2[0], roadType: 'road' });
            }
            // Player 1 (Bot) Setup 2
            const vKeys3 = window.gameState.getValidSetupVertices();
            if (vKeys3.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: vKeys3[0] });
                const rKeys3 = window.gameState.getValidRoadEdges(true, vKeys3[0]);
                if (rKeys3.length > 0) window.performAction({ type: 'setup_road', eKey: rKeys3[0], roadType: 'road' });
            }
            // Player 0 Setup 2
            const vKeys4 = window.gameState.getValidSetupVertices();
            if (vKeys4.length > 0) {
                window.performAction({ type: 'setup_settlement', vKey: vKeys4[0] });
                const rKeys4 = window.gameState.getValidRoadEdges(true, vKeys4[0]);
                if (rKeys4.length > 0) window.performAction({ type: 'setup_road', eKey: rKeys4[0], roadType: 'road' });
            }
        }
    });

    await new Promise(r => setTimeout(r, 1500));

    const outDir = 'C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\4c603f1d-8994-491a-8ba5-63a024450b76';
    const shotPath1 = path.join(outDir, 'board_3d_render.png');
    await page.screenshot({ path: shotPath1 });
    console.log(`✅ [1/3] Đã chụp ảnh render 3D chi tiết: ${shotPath1}`);

    // Trigger 3D Dice Roll Animation!
    console.log('🎲 Đang kích hoạt animation đổ xúc xắc 3D (Vàng 5 + Đỏ 3)...');
    await page.evaluate(() => {
        window.performAction({ type: 'roll', d1: 5, d2: 3 });
    });

    // Wait for dice to land and settle
    await new Promise(r => setTimeout(r, 1400));
    const shotPathDice = path.join(outDir, 'board_3d_dice.png');
    await page.screenshot({ path: shotPathDice });
    console.log(`✅ [2/3] Đã chụp ảnh animation xúc xắc 3D hoàn tất: ${shotPathDice}`);

    // Open Player Info Modal (Click on opponent)
    console.log('👤 Đang mở bảng hồ sơ thông tin người chơi khác chuẩn luật Catan...');
    await page.evaluate(() => {
        window.__showPlayerStats(1); // Inspect Opponent (Thuyền Trưởng AI)
    });
    await new Promise(r => setTimeout(r, 600));
    const shotPathPInfo = path.join(outDir, 'board_3d_player_stats.png');
    await page.screenshot({ path: shotPathPInfo });
    console.log(`✅ [3/3] Đã chụp ảnh bảng hồ sơ thông tin người chơi: ${shotPathPInfo}`);

    await browser.close();
    console.log('🎉 Toàn bộ kiểm thử & chụp ảnh hoàn tất 100%!');
}

captureBoard().catch(err => {
    console.error('Lỗi kiểm thử:', err);
    process.exit(1);
});
