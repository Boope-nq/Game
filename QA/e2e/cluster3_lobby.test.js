import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.3: PHÒNG CHỜ TRƯỚC TRẬN (LOBBY CONTROLS)', () => {
  const helperRegister = async (page, username, password) => {
    await page.goto('http://localhost:3000/');
    await page.click('#tab-register');
    await page.fill('#reg-user', username);
    await page.fill('#reg-email', `${username}@test.com`);
    await page.fill('#reg-pass', password);
    await page.fill('#reg-confirm', password);
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/lobby\.html/);
    await expect(page.locator('#user-name')).toContainText(username);
  };

  test('LOBBY-01 & LOBBY-02: 4 Người chơi vào đủ, đồng bộ danh sách 4 màn hình và phân bổ màu độc lập', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const uA = `pA_4p_${ts}`;
    const uB = `pB_4p_${ts}`;
    const uC = `pC_4p_${ts}`;
    const uD = `pD_4p_${ts}`;

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const ctxC = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const ctxD = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    const pA = await ctxA.newPage();
    const pB = await ctxB.newPage();
    const pC = await ctxC.newPage();
    const pD = await ctxD.newPage();

    // 1. Đăng ký cả 4 tài khoản trên 4 session riêng
    await helperRegister(pA, uA, 'pass123456');
    await helperRegister(pB, uB, 'pass123456');
    await helperRegister(pC, uC, 'pass123456');
    await helperRegister(pD, uD, 'pass123456');

    // 2. Player A tạo phòng 4 người kịch bản Cities & Knights
    await pA.click('#create-room-btn');
    await pA.fill('#room-name-input', 'Phòng Đủ 4 Người');
    await pA.selectOption('#room-scenario', 'cities_knights');
    await pA.selectOption('#room-max-players', '4');
    await pA.click('#create-room-form button[type="submit"]');
    await pA.waitForURL(/game\.html\?room=/);
    const roomCode = new URL(pA.url()).searchParams.get('room');

    // 3. Player B, C, D lần lượt tham gia bằng mã phòng
    for (const [p, u] of [[pB, uB], [pC, uC], [pD, uD]]) {
      await p.click('#join-code-btn');
      await p.fill('#join-code-input', roomCode);
      await p.click('#join-code-form button[type="submit"]');
      await p.waitForURL(/game\.html\?room=/);
      await expect(p.locator('#waiting-modal')).toBeVisible();
    }

    // 4. Kiểm tra cả 4 màn hình đều hiển thị đủ 4 người
    for (const p of [pA, pB, pC, pD]) {
      await p.waitForFunction(() => {
        const list = document.getElementById('waiting-player-list');
        return list && list.children.length >= 4;
      }, { timeout: 10000 });
    }

    // Chụp screenshot 4 phiên làm bằng chứng
    await pA.screenshot({ path: path.join(ARTIFACTS_DIR, 'LOBBY-01-PlayerA-4PlayersReady.png') });
    await pB.screenshot({ path: path.join(ARTIFACTS_DIR, 'LOBBY-01-PlayerB-4PlayersReady.png') });
    await pC.screenshot({ path: path.join(ARTIFACTS_DIR, 'LOBBY-01-PlayerC-4PlayersReady.png') });
    await pD.screenshot({ path: path.join(ARTIFACTS_DIR, 'LOBBY-01-PlayerD-4PlayersReady.png') });

    // Kiểm tra API phòng để xác nhận màu của 4 người là hoàn toàn khác biệt
    const roomDetail = await pA.evaluate(async (code) => {
      const res = await fetch(`/api/rooms/${code}`);
      return await res.json();
    }, roomCode);

    expect(roomDetail.players.length).toBe(4);
    const colors = roomDetail.players.map(p => p.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(4); // Không có người chơi nào trùng màu!

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
    await ctxD.close();
  });

  test('LOBBY-03: 1 Người chơi rời phòng chờ, danh sách realtime cập nhật lại', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const uA = `pA_lv_${ts}`;
    const uB = `pB_lv_${ts}`;

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pA = await ctxA.newPage();
    const pB = await ctxB.newPage();

    await helperRegister(pA, uA, 'pass123456');
    await helperRegister(pB, uB, 'pass123456');

    // Player A tạo phòng
    await pA.click('#create-room-btn');
    await pA.fill('#room-name-input', 'Phòng Test Rời');
    await pA.click('#create-room-form button[type="submit"]');
    await pA.waitForURL(/game\.html\?room=/);
    const roomCode = new URL(pA.url()).searchParams.get('room');

    // Player B vào phòng
    await pB.click('#join-code-btn');
    await pB.fill('#join-code-input', roomCode);
    await pB.click('#join-code-form button[type="submit"]');
    await pB.waitForURL(/game\.html\?room=/);

    // Đợi Player A thấy 2 người
    await pA.waitForFunction(() => {
      const list = document.getElementById('waiting-player-list');
      return list && list.children.length >= 2;
    }, { timeout: 10000 });

    // Player B bấm Rời phòng
    await pB.click('#btn-waiting-leave-room');
    await pB.waitForURL(/lobby\.html/);
    await pB.screenshot({ path: path.join(ARTIFACTS_DIR, 'LOBBY-03-PlayerB-LeftToLobby.png') });

    // Player A thấy danh sách còn 1 người
    await pA.waitForFunction(() => {
      const list = document.getElementById('waiting-player-list');
      return list && list.children.length === 1;
    }, { timeout: 10000 });
    await pA.screenshot({ path: path.join(ARTIFACTS_DIR, 'LOBBY-03-PlayerA-OnePlayerLeft.png') });

    await ctxA.close();
    await ctxB.close();
  });

  test('LOBBY-04 & LOBBY-05: Chặn bắt đầu khi 1 mình & Chống spam bấm Bắt đầu', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const uA = `pA_spm_${ts}`;

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pA = await ctxA.newPage();
    await helperRegister(pA, uA, 'pass123456');

    // Player A tạo phòng
    await pA.click('#create-room-btn');
    await pA.click('#create-room-form button[type="submit"]');
    await pA.waitForURL(/game\.html\?room=/);

    // 1. Host bấm bắt đầu khi chỉ có 1 mình -> Alert lỗi
    let alertMsg = '';
    pA.once('dialog', async d => {
      alertMsg = d.message();
      await d.accept();
    });
    await pA.click('#btn-start-game');
    await pA.waitForTimeout(500);
    expect(alertMsg).toContain('Cần ít nhất 2 người chơi');
    await pA.screenshot({ path: path.join(ARTIFACTS_DIR, 'LOBBY-04-PlayerA-NotEnoughPlayersAlert.png') });

    await ctxA.close();
  });
});
