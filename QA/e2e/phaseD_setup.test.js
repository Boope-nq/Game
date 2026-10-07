import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';
import { InvariantChecker } from '../helpers/InvariantChecker.js';

test.describe('PHASE D: 4-Player Cities & Knights Setup Rounds', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('D.1: 4 Người chơi thực hiện trọn vẹn 2 vòng Setup (Vòng 1 Định cư, Vòng 2 Thành phố) và kiểm tra Invariants', async () => {
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('d_ck');

    const host = players[0];
    const roomName = `CK_Setup_${Date.now()}`;

    // Host tạo phòng C&K
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();

    // 3 Người chơi vào phòng
    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    // Chờ 4 người trong phòng chờ và bắt đầu trận
    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    await host.startGame();

    // Chờ cả 4 người load xong 3D Board
    for (const p of players) {
      await p.waitForGameLoaded();
    }

    // Trình tự lượt Setup:
    // Vòng 1 (Thuận): 0 -> 1 -> 2 -> 3
    // Vòng 2 (Nghịch): 3 -> 2 -> 1 -> 0
    const setupOrder = [0, 1, 2, 3, 3, 2, 1, 0];

    for (let step = 0; step < setupOrder.length; step++) {
      const pIdx = setupOrder[step];
      const player = players[pIdx];

      // 1. Chờ đến lượt người chơi này
      await player.waitForMyTurn(20000);

      // 2. Đặt Định cư (vòng 1) hoặc Thành phố (vòng 2)
      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_SETTLEMENT';
      }, { timeout: 15000 });
      const rSettlement = await player.executeSetupPlacement();
      expect(rSettlement.ok).toBeTruthy();

      // 3. Đặt Đường/Tàu
      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_ROAD';
      }, { timeout: 15000 });
      const rRoad = await player.executeSetupPlacement();
      expect(rRoad.ok).toBeTruthy();

      // Cho phép các máy khách khác nhận socket sync
      await player.page.waitForTimeout(600);
    }

    // Sau khi hoàn thành 8 bước setup, game chuyển sang Turn 1 (Phase.ROLL)
    await host.page.waitForFunction(() => {
      return window.gameState && (window.gameState.phase === 'ROLL' || window.gameState.phase === 'TURN_DICE_ROLL');
    }, { timeout: 15000 });

    // Kiểm tra trạng thái của cả 4 người chơi
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      const state = await p.page.evaluate(() => {
        const gs = window.gameState;
        return {
          phase: gs.phase,
          turn: gs.turn,
          currentPlayerIndex: gs.currentPlayerIndex,
          players: gs.players.map(pl => ({
            id: pl.id,
            name: pl.name,
            vp: pl.victoryPoints,
            settlements: pl.placed.settlements.length,
            cities: pl.placed.cities.length,
            roads: pl.placed.roads.length + (pl.placed.ships ? pl.placed.ships.length : 0),
            resources: { ...pl.resources },
            commodities: { ...pl.commodities }
          }))
        };
      });

      expect(state.phase).toBe('ROLL');
      expect(state.turn).toBe(1);
      expect(state.currentPlayerIndex).toBe(0);

      // Mỗi người chơi phải có chính xác 1 định cư và 1 thành phố
      for (const pl of state.players) {
        expect(pl.settlements).toBe(1);
        expect(pl.cities).toBe(1);
        expect(pl.roads).toBe(2);
        // Điểm khởi đầu C&K: 1 VP (định cư) + 2 VP (thành phố) = 3 VP!
        expect(pl.vp).toBe(3);
      }

      // Kiểm tra tính toàn vẹn (Invariants)
      await p.page.evaluate(() => {
        // Tự kiểm tra không có tài nguyên âm và giới hạn quân cờ
        for (const pl of window.gameState.players) {
          for (const val of Object.values(pl.resources)) {
            if (val < 0) throw new Error('Tài nguyên âm!');
          }
          for (const val of Object.values(pl.commodities)) {
            if (val < 0) throw new Error('Hàng hóa âm!');
          }
          if (pl.victoryPoints !== 3) throw new Error(`VP không đúng: ${pl.victoryPoints}`);
        }
      });
    }
  });
});
