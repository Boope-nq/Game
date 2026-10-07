import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

test.describe('PHASE J: Cities & Knights UI & HUD Integration Verification', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) await orchestrator.cleanup();
  });

  test('J.1: Kiểm tra giao diện C&K hiển thị đầy đủ hàng hóa, thuyền man rợ và các nút chức năng C&K', async () => {
    const players = await orchestrator.init(4);
    expect(players.length).toBe(4);

    // 1. Đăng ký & Đăng nhập cho 4 tài khoản
    await orchestrator.registerAndLoginAll('ck_ui');

    const host = players[0];
    const roomName = `CK_UI_${Date.now()}`;

    // 2. Chủ phòng tạo phòng với kịch bản Thành phố & Hiệp sĩ (cities_knights)
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();
    expect(roomCode).toBeTruthy();

    // 3. 3 Người chơi còn lại tham gia phòng
    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    // 4. Chờ đủ 4 người và chủ phòng bắt đầu trận đấu
    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    await host.startGame();

    // 5. Chờ bàn cờ 3D load xong cho tất cả người chơi
    for (const player of players) {
      await player.page.waitForSelector('#hud', { timeout: 25000 });
    }

    const p1 = host.page;

    // 6. Kiểm tra 3 thẻ Hàng hóa (Commodities) hiển thị trên thanh tài nguyên
    await expect(p1.locator('.res-card[data-res="PAPER"]')).toBeVisible();
    await expect(p1.locator('.res-card[data-res="CLOTH"]')).toBeVisible();
    await expect(p1.locator('.res-card[data-res="COIN"]')).toBeVisible();

    // 7. Kiểm tra Thuyền Man Rợ Tracker (Barbarian HUD) hiển thị
    await expect(p1.locator('#barbarian-hud')).toBeVisible();
    await expect(p1.locator('#barbarian-pos-text')).toContainText('0/7');
    await expect(p1.locator('#barbarian-steps .barbarian-step-dot')).toHaveCount(7);

    // 8. Kiểm tra các nút hành động đặc thù C&K xuất hiện
    await expect(p1.locator('#btn-ck-improve')).toBeVisible();
    await expect(p1.locator('#btn-ck-progress')).toBeVisible();
    await expect(p1.locator('#btn-ck-wall')).toBeVisible();
    await expect(p1.locator('#btn-ck-knight')).toBeVisible();

    // Nút mua thẻ phát triển bản gốc phải được ẩn đi
    await expect(p1.locator('#btn-dev-buy')).toBeHidden();

    // 9. Mở modal Nâng cấp Đô thị và kiểm tra 3 nhánh
    await p1.locator('#btn-ck-improve').click();
    await expect(p1.locator('#ck-improve-modal:not(.hidden)')).toBeVisible();
    await expect(p1.locator('#ck-improve-tracks-container')).toContainText('Khoa Học');
    await expect(p1.locator('#ck-improve-tracks-container')).toContainText('Thương Mại');
    await expect(p1.locator('#ck-improve-tracks-container')).toContainText('Chính Trị');
    await p1.locator('#btn-close-ck-improve').click();
    await expect(p1.locator('#ck-improve-modal')).toHaveClass(/hidden/);

    // 10. Mở modal Hiệp sĩ và kiểm tra các hành động hiệp sĩ
    await p1.locator('#btn-ck-knight').click();
    await expect(p1.locator('#ck-knight-modal:not(.hidden)')).toBeVisible();
    await expect(p1.locator('#ck-knight-actions-container')).toContainText('Chiêu Mộ Hiệp Sĩ');
    await expect(p1.locator('#ck-knight-actions-container')).toContainText('Kích Hoạt Hiệp Sĩ');
    await p1.locator('#btn-close-ck-knight').click();
    await expect(p1.locator('#ck-knight-modal')).toHaveClass(/hidden/);

    // 11. Mở modal Thẻ tiến bộ
    await p1.locator('#btn-ck-progress').click();
    await expect(p1.locator('#ck-progress-modal:not(.hidden)')).toBeVisible();
    await p1.locator('#btn-close-ck-progress').click();
    await expect(p1.locator('#ck-progress-modal')).toHaveClass(/hidden/);
  });
});
