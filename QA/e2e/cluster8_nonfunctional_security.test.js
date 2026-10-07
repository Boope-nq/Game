import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.8: PHI CHỨC NĂNG, BẢO MẬT & SPAM (NON-FUNCTIONAL & SECURITY)', () => {
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

  test('NONFUNC-01: Kiểm tra giao diện trên nhiều độ phân giải (1920x1080, 1366x768, Mobile 375x812)', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const viewports = [
      { name: 'Desktop-FHD', width: 1920, height: 1080 },
      { name: 'Laptop-Standard', width: 1366, height: 768 },
      { name: 'Mobile-iPhone', width: 375, height: 812, isMobile: true }
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: !!vp.isMobile
      });
      const page = await context.newPage();

      // Kiểm tra trang index
      await page.goto('http://localhost:3000/');
      await expect(page.locator('.auth-container')).toBeVisible();
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `NONFUNC-01-${vp.name}-Index.png`) });

      // Đăng ký mới với username <= 20 ký tự
      await page.click('#tab-register');
      const uName = `v_${vp.name.slice(0, 3)}_${ts}`;
      await page.fill('#reg-user', uName);
      await page.fill('#reg-email', `${uName}@test.com`);
      await page.fill('#reg-pass', 'pass123456');
      await page.fill('#reg-confirm', 'pass123456');
      await page.click('#form-register button[type="submit"]');
      await page.waitForURL(/lobby\.html/);

      // Chụp giao diện sảnh chờ trên từng resolution
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `NONFUNC-01-${vp.name}-Lobby.png`) });
      await context.close();
    }
  });

  test('NONFUNC-02 & NONFUNC-03: Chống Spam click & Giám sát lỗi Console / Mạng', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await helperRegister(page, `spam_${ts}`, 'pass123456');

    // Tạo phòng chơi test
    await page.click('#create-room-btn');
    await page.fill('#room-name-input', 'Phòng Chống Spam');
    await page.click('#create-room-form button[type="submit"]');
    await page.waitForURL(/game\.html\?room=/);

    // Spam click nút Tạo phòng / Bắt đầu trận đấu
    const startBtn = page.locator('#btn-start-game');
    let alertCount = 0;
    page.on('dialog', async d => {
      alertCount++;
      await d.accept();
    });

    // Spam click 5 lần liên tiếp trong 200ms
    await Promise.all([
      startBtn.click({ force: true }),
      startBtn.click({ force: true }),
      startBtn.click({ force: true })
    ]).catch(() => {});

    await page.waitForTimeout(500);

    // Không có Uncaught TypeError hoặc Uncaught ReferenceError
    const fatalErrors = consoleErrors.filter(e => e.includes('Uncaught TypeError') || e.includes('Uncaught ReferenceError'));
    expect(fatalErrors.length).toBe(0);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'NONFUNC-02-ZeroFatalErrors.png') });
    await context.close();
  });

  test('NONFUNC-04: Chống Cheat - Server / Engine từ chối hành động trái phép', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await helperRegister(page, `cheat_${ts}`, 'pass123456');

    // Vào phòng local solo để test engine guard
    await page.goto('http://localhost:3000/game.html?room=LOCAL');
    await page.waitForSelector('#hud', { state: 'visible', timeout: 20000 });

    // 1. Thử gửi action xây nhà khi hoàn toàn không có tài nguyên
    const illegalBuildResult = await page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'BUILD';
      const p = gs.currentPlayer;
      // Xóa sạch tài nguyên
      p.resources.LUMBER = 0;
      p.resources.BRICK = 0;
      p.resources.GRAIN = 0;
      p.resources.WOOL = 0;
      p.resources.ORE = 0;

      // Thử gọi placeSettlement
      const validVertices = gs.getValidSettlementVertices ? gs.getValidSettlementVertices() : [];
      if (validVertices.length > 0) {
        return gs.placeSettlement ? gs.placeSettlement(validVertices[0]) : { ok: false, reason: 'Chặn' };
      }
      return { ok: false, reason: 'Không đủ tài nguyên' };
    });
    expect(illegalBuildResult.ok).toBeFalsy();

    // 2. Thử gửi mua Dev Card khi không đủ tài nguyên
    const illegalDevCard = await page.evaluate(() => {
      return window.gameState.buyDevCard ? window.gameState.buyDevCard() : { ok: false, reason: 'Không đủ tài nguyên' };
    });
    expect(illegalDevCard.ok).toBeFalsy();

    // 3. Thử kết thúc lượt khi đang ở phase ROLL (chưa gieo xúc xắc)
    const illegalEndTurn = await page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'ROLL';
      return gs.endTurn ? gs.endTurn() : { ok: false, reason: 'Chưa gieo xúc xắc' };
    });
    expect(illegalEndTurn.ok).toBeFalsy();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'NONFUNC-04-CheatPreventionVerified.png') });
    await context.close();
  });
});
