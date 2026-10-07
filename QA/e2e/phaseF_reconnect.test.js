import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';
import { InvariantChecker } from '../helpers/InvariantChecker.js';

test.describe('PHASE F: 4-Player Reconnection & State Restoration', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('F.1: Người chơi F5 reload trình duyệt giữa trận đấu, khôi phục bàn cờ 3D và tiếp tục chơi mượt mà không desync', async () => {
    test.setTimeout(180000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('f_ck');

    const host = players[0];
    const roomName = `CK_Reconnect_${Date.now()}`;

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

    // 2. Chạy xong 2 vòng Setup
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
      await player.page.waitForTimeout(400);
    }

    // Chờ vào Turn 1 (ROLL phase)
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    // 3. Player 0 gieo xúc xắc và kết thúc lượt
    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });
    await host.page.click('#btn-end-turn', { force: true });
    await host.page.waitForTimeout(600);

    // Bây giờ là lượt của Player 1
    const p1 = players[1];
    await p1.waitForMyTurn(20000);

    // 4. KIỂM THỬ TÁI KẾT NỐI: Player 1 thực hiện F5 Reload trình duyệt
    await p1.page.reload();
    await p1.page.waitForURL(/game\.html/, { timeout: 20000 });
    await p1.page.waitForSelector('#hud', { state: 'visible', timeout: 25000 });

    // Chờ Player 1 khôi phục xong bàn cờ và gameState
    await p1.page.waitForFunction(() => {
      return window.gameState && window.gameState.ruleset === 'cities_knights';
    }, { timeout: 20000 });

    // 5. Kiểm tra tính toàn vẹn trạng thái của Player 1 sau khi reload
    const p1State = await p1.page.evaluate(() => {
      const gs = window.gameState;
      return {
        ruleset: gs.ruleset,
        turn: gs.turn,
        currentPlayerIndex: gs.currentPlayerIndex,
        myIndex: window.myPlayerIndex,
        phase: gs.phase,
        playersCount: gs.players.length
      };
    });

    expect(p1State.ruleset).toBe('cities_knights');
    expect(p1State.playersCount).toBe(4);
    expect(p1State.myIndex).toBe(1);
    expect(p1State.currentPlayerIndex).toBe(1);
    expect(p1State.phase).toBe('ROLL');

    // 6. Player 1 tiếp tục chơi lượt của mình sau khi reload (Gieo xúc xắc + Kết thúc lượt)
    await p1.page.click('#btn-roll', { force: true });
    await p1.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });
    await p1.page.click('#btn-end-turn', { force: true });
    await p1.page.waitForTimeout(600);

    // 7. Lượt chuyển sang Player 2 thành công mà không có xung đột
    const p2 = players[2];
    await p2.waitForMyTurn(20000);
    expect(await p2.page.evaluate(() => window.gameState.currentPlayerIndex)).toBe(2);

    // 8. Invariant check trên cả 4 trình duyệt
    for (const p of players) {
      const invCheck = await p.page.evaluate(() => {
        const gs = window.gameState;
        for (const pl of gs.players) {
          if (pl.victoryPoints < 3) return false;
          for (const v of Object.values(pl.resources)) if (v < 0) return false;
          for (const v of Object.values(pl.commodities)) if (v < 0) return false;
        }
        return true;
      });
      expect(invCheck).toBeTruthy();
    }
  });
});
