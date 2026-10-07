import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';
import { InvariantChecker } from '../helpers/InvariantChecker.js';

test.describe('PHASE E: 4-Player Cities & Knights Turn Gameplay Loop', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('E.1: Chơi liên tục nhiều lượt đầy đủ với 4 tài khoản (Gieo xúc xắc 3D, sự kiện C&K, kết thúc lượt, đồng bộ Invariants)', async () => {
    test.setTimeout(180000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('e_ck');

    const host = players[0];
    const roomName = `CK_Gameplay_${Date.now()}`;

    // 1. Host tạo phòng C&K
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();

    // 2. 3 Người chơi vào phòng
    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    // 3. Chờ 4 người trong phòng chờ và bắt đầu trận
    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    await host.startGame();

    // 4. Chờ cả 4 người load xong 3D Board
    for (const p of players) {
      await p.waitForGameLoaded();
    }

    // 5. Thực hiện 2 vòng Setup tự động
    const setupOrder = [0, 1, 2, 3, 3, 2, 1, 0];
    for (let step = 0; step < setupOrder.length; step++) {
      const pIdx = setupOrder[step];
      const player = players[pIdx];

      await player.waitForMyTurn(20000);

      // Đặt Định cư (v1) hoặc Thành phố (v2)
      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_SETTLEMENT';
      }, { timeout: 15000 });
      const rSettlement = await player.executeSetupPlacement();
      expect(rSettlement.ok).toBeTruthy();

      // Đặt Đường
      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_ROAD';
      }, { timeout: 15000 });
      const rRoad = await player.executeSetupPlacement();
      expect(rRoad.ok).toBeTruthy();

      await player.page.waitForTimeout(500);
    }

    // Chờ vào Turn 1 (ROLL phase)
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    // 6. Chơi 8 lượt chính thức (mỗi người chơi tối thiểu 2 lượt)
    const TOTAL_TURNS = 8;
    for (let turnCount = 0; turnCount < TOTAL_TURNS; turnCount++) {
      // Xác định người chơi hiện tại qua gameState của host
      const currentIdx = await host.page.evaluate(() => window.gameState.currentPlayerIndex);
      const activePlayer = players[currentIdx];

      // Chờ người chơi hiện tại đến lượt
      await activePlayer.waitForMyTurn(20000);

      // Gieo 3 xúc xắc C&K qua nút DOM thực #btn-roll
      await activePlayer.page.click('#btn-roll', { force: true });

      // Chờ xúc xắc hoàn tất và chuyển sang phase BUILD hoặc xử lý 7 / discard
      await activePlayer.page.waitForFunction(() => {
        const gs = window.gameState;
        return gs && (gs.phase === 'BUILD' || gs.phase === 'ROBBER' || gs.phase === 'DISCARD');
      }, { timeout: 15000 });

      // Nếu rơi vào DISCARD, người chơi cần bỏ bài sẽ bấm nút thực tế #btn-auto-discard
      const isDiscard = await activePlayer.page.evaluate(() => window.gameState.phase === 'DISCARD');
      if (isDiscard) {
        for (const p of players) {
          const hasDiscardModal = await p.page.evaluate(() => {
            const m = document.getElementById('discard-modal');
            return m && !m.classList.contains('hidden');
          });
          if (hasDiscardModal) {
            await p.page.click('#btn-auto-discard', { force: true });
            await p.page.waitForTimeout(500);
          }
        }
      }

      // Nếu đang ở ROBBER, dời Tên cướp sang một ô khác
      const isRobber = await activePlayer.page.evaluate(() => window.gameState.phase === 'ROBBER');
      if (isRobber) {
        await activePlayer.page.evaluate(() => {
          const gs = window.gameState;
          const current = gs.robberPos || { q: 0, r: 0 };
          const tiles = Array.from(gs.tiles.values()).filter(t => t.q !== current.q || t.r !== current.r);
          if (tiles.length > 0) {
            window.performAction({ type: 'robber', q: tiles[0].q, r: tiles[0].r });
          }
        });
        await activePlayer.page.waitForTimeout(500);
      }

      // Chờ vào BUILD phase
      await activePlayer.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'BUILD';
      }, { timeout: 15000 });

      // Kết thúc lượt bằng nút DOM thực #btn-end-turn
      await activePlayer.page.click('#btn-end-turn', { force: true });
      await activePlayer.page.waitForTimeout(600);

      // 7. Sau mỗi lượt, kiểm tra toàn vẹn Invariants trên cả 4 trình duyệt
      for (const p of players) {
        const pState = await p.page.evaluate(() => {
          const gs = window.gameState;
          return {
            ruleset: gs.ruleset,
            barbarianPosition: gs.barbarianPosition,
            barbarianSteps: gs.barbarianSteps,
            players: gs.players.map(pl => ({
              id: pl.id,
              name: pl.name,
              resources: { ...pl.resources },
              commodities: { ...pl.commodities },
              placedSettlements: pl.placed.settlements.length,
              placedCities: pl.placed.cities.length,
              placedRoads: pl.placed.roads.length,
              cityWalls: pl.cityWalls ? pl.cityWalls.length : 0,
              victoryPoints: pl.victoryPoints,
              metropolises: pl.metropolises || [],
              hasLongestRoad: !!pl.hasLongestRoad,
              defenderTokens: pl.defenderTokens || 0,
              hasMerchant: !!pl.hasMerchant,
              progressCards: pl.progressCards || []
            }))
          };
        });

        // Áp dụng InvariantChecker
        expect(pState.ruleset).toBe('cities_knights');
        expect(pState.barbarianPosition).toBeGreaterThanOrEqual(0);
        expect(pState.barbarianPosition).toBeLessThanOrEqual(pState.barbarianSteps);

        for (const pl of pState.players) {
          for (const [r, val] of Object.entries(pl.resources)) {
            expect(val).toBeGreaterThanOrEqual(0);
          }
          for (const [c, val] of Object.entries(pl.commodities)) {
            expect(val).toBeGreaterThanOrEqual(0);
          }
          expect(pl.placedCities).toBeLessThanOrEqual(4);
          expect(pl.placedSettlements).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});
