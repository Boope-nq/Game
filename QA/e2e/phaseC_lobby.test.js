import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

test.describe('PHASE C: 4-Player Real Session Lobby & Match Creation', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('C.1: 4 Trình duyệt thực độc lập đăng ký, tạo phòng C&K, vào phòng và bắt đầu trận đấu', async () => {
    const players = await orchestrator.init(4);
    expect(players.length).toBe(4);

    // 1. Đăng ký & Đăng nhập cho cả 4 tài khoản
    await orchestrator.registerAndLoginAll('ck');

    const host = players[0];
    const roomName = `CK_Room_${Date.now()}`;

    // 2. Chủ phòng tạo phòng với kịch bản Thành phố & Hiệp sĩ (cities_knights)
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();
    expect(roomCode).toBeTruthy();
    expect(roomCode.length).toBeGreaterThanOrEqual(4);

    // 3. 3 Người chơi còn lại tham gia phòng bằng mã phòng
    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    // 4. Kiểm tra danh sách người chơi trong phòng chờ đạt đủ 4 người
    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    // 5. Chủ phòng bấm Bắt đầu trận đấu
    await host.startGame();

    // 6. Cả 4 người chơi đều vào bàn cờ 3D và hiển thị HUD
    for (const player of players) {
      await player.page.waitForSelector('#hud', { timeout: 25000 });
      
      // Kiểm tra ruleset và trạng thái ban đầu của ván chơi Cities & Knights
      const state = await player.getVisibleState();
      expect(state).toBeTruthy();
      expect(state.ruleset).toBe('cities_knights');
    }
  });
});
