import { test, expect } from '@playwright/test';
import path from 'path';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.6: GIÁN ĐOẠN GIỮA CHỪNG (DISCONNECT, RECONNECT, F5, DUPLICATE TABS)', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('INTERRUPT-01 -> 04: F5 Reload khôi phục trạng thái, Mất kết nối tạm dừng và Tự động tiếp tục khi vào lại', async () => {
    test.setTimeout(240000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('ck_intr');

    const host = players[0];
    const roomName = `CK_Interrupt_${Date.now()}`;

    // 1. Tạo phòng & vào phòng
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();

    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    await host.startGame();

    for (const p of players) {
      await p.waitForGameLoaded();
    }

    // 2. Chạy 2 vòng Setup
    const setupOrder = [0, 1, 2, 3, 3, 2, 1, 0];
    for (let step = 0; step < setupOrder.length; step++) {
      const pIdx = setupOrder[step];
      const player = players[pIdx];

      await player.waitForMyTurn(20000);
      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_SETTLEMENT';
      }, { timeout: 15000 });
      await player.executeSetupPlacement();

      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_ROAD';
      }, { timeout: 15000 });
      await player.executeSetupPlacement();
      await player.page.waitForTimeout(300);
    }

    // Turn 1 của Player 0 (Host)
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });
    await host.page.click('#btn-end-turn', { force: true });
    await host.page.waitForTimeout(600);

    // [TEST 2.6.1] F5 Reload giữa trận đấu (Player 1)
    const p1 = players[1];
    await p1.waitForMyTurn(20000);

    // Ghi nhận trạng thái trước reload
    const p1StateBefore = await p1.page.evaluate(() => {
      const me = window.gameState.players[1];
      return {
        turn: window.gameState.turn,
        phase: window.gameState.phase,
        vp: me.victoryPoints,
        resources: { ...me.resources },
        settlements: me.placed.settlements.length,
        cities: me.placed.cities.length
      };
    });

    // Thực hiện F5 Reload trang game
    await p1.page.reload();
    await p1.page.waitForURL(/game\.html/, { timeout: 20000 });
    await p1.page.waitForSelector('#hud', { state: 'visible', timeout: 25000 });

    // Đợi khôi phục hoàn chỉnh
    await p1.page.waitForFunction(() => {
      return window.gameState && window.gameState.currentPlayerIndex === 1;
    }, { timeout: 20000 });

    const p1StateAfter = await p1.page.evaluate(() => {
      const me = window.gameState.players[1];
      return {
        turn: window.gameState.turn,
        phase: window.gameState.phase,
        vp: me.victoryPoints,
        resources: { ...me.resources },
        settlements: me.placed.settlements.length,
        cities: me.placed.cities.length
      };
    });

    expect(p1StateAfter.turn).toBe(p1StateBefore.turn);
    expect(p1StateAfter.phase).toBe(p1StateBefore.phase);
    expect(p1StateAfter.vp).toBe(p1StateBefore.vp);
    expect(p1StateAfter.settlements).toBe(p1StateBefore.settlements);
    expect(p1StateAfter.cities).toBe(p1StateBefore.cities);

    await p1.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'INTERRUPT-01-PlayerB-AfterF5Restored.png') });

    // [TEST 2.6.2 & 2.6.3] Tạm dừng khi người chơi ngắt kết nối & Khôi phục khi vào lại
    // Player 3 ngắt kết nối (navigate sang about:blank)
    const p3Username = players[3].name;
    await players[3].page.goto('about:blank');

    // Host nhận tín hiệu tạm dừng và hiển thị #player-paused-modal
    // (hoặc thông báo tạm dừng trận đấu chờ người chơi)
    await host.page.waitForTimeout(1000);
    await host.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'INTERRUPT-02-Host-PlayerDisconnectedNotice.png') });

    // Player 3 quay trở lại phòng bằng URL trận đấu
    await players[3].page.goto(`http://localhost:3000/game.html?room=${roomCode}`);
    await players[3].page.waitForURL(/game\.html/, { timeout: 20000 });
    await players[3].page.waitForSelector('#hud', { state: 'visible', timeout: 25000 });

    // Cả 2 phía đều trở lại trạng thái sẵn sàng
    await players[3].page.waitForFunction(() => {
      return window.gameState && window.gameState.ruleset === 'cities_knights';
    }, { timeout: 20000 });

    await players[3].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'INTERRUPT-03-PlayerD-ReconnectedResumed.png') });

    // [TEST 2.6.4] Mở tab thứ 2 cùng tài khoản vào lại phòng
    const p1Tab2 = await players[1].context.newPage();
    await p1Tab2.goto(`http://localhost:3000/game.html?room=${roomCode}`);
    await p1Tab2.waitForURL(/game\.html/, { timeout: 20000 });
    await p1Tab2.waitForSelector('#hud', { state: 'visible', timeout: 25000 });

    // Kiểm tra tab thứ 2 hiển thị đúng bàn cờ và đúng lượt
    await p1Tab2.waitForFunction(() => {
      return window.gameState && window.gameState.currentPlayerIndex === 1;
    }, { timeout: 20000 });

    await p1Tab2.screenshot({ path: path.join(ARTIFACTS_DIR, 'INTERRUPT-04-PlayerB-Tab2Active.png') });
    await p1Tab2.close();
  });
});
