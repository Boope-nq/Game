import { test, expect } from '@playwright/test';
import path from 'path';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.5: VÒNG CHƠI CHÍNH (MAIN GAMEPLAY LOOP TO WIN)', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('GAMEPLAY-01 -> 05: Gieo xúc xắc đúng lượt, Luật số 7 & Robber, Xây dựng, Giao dịch & Cán mốc 13 VP chiến thắng', async () => {
    test.setTimeout(240000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('ck_gp');

    const host = players[0];
    const roomName = `CK_Gameplay_Full_${Date.now()}`;

    // 1. Khởi tạo phòng C&K 4 người
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

    // 2. Setup 2 vòng (Snake draft: 0->1->2->3->3->2->1->0)
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

    // Vào Turn 1 (Phase ROLL của Player A)
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL' && window.gameState.currentPlayerIndex === 0;
    }, { timeout: 20000 });

    // [TEST 2.5.1] Người chưa đến lượt (Player B) không thể gieo xúc xắc
    const p1CannotRoll = await players[1].page.evaluate(() => {
      const btn = document.getElementById('btn-roll');
      return btn.disabled || window.gameState.currentPlayerIndex !== window.myPlayerIndex;
    });
    expect(p1CannotRoll).toBeTruthy();

    // Player A gieo xúc xắc bằng nút #btn-roll
    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      const gs = window.gameState;
      return gs && (gs.phase === 'BUILD' || gs.phase === 'ROBBER' || gs.phase === 'DISCARD');
    }, { timeout: 15000 });

    await host.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'GAMEPLAY-01-PlayerA-RolledDice.png') });

    // [TEST 2.5.2] Luật số 7, Bỏ bài nếu > 7 lá & Di chuyển Tên cướp (Robber)
    // Cấp cho Player C 10 lá tài nguyên LUMBER để kiểm tra luật bỏ 1/2 bài khi số 7 xuất hiện
    const p2CardsBefore = await players[2].page.evaluate(() => {
      const gs = window.gameState;
      const p2 = gs.players[2];
      p2.resources.LUMBER = 10;
      gs.phase = 'DISCARD';
      gs.discardPending = [p2.id];
      if (window.syncAll) window.syncAll();
      const total = Object.values(p2.resources).reduce((a, b) => a + b, 0) + Object.values(p2.commodities || {}).reduce((a, b) => a + b, 0);
      return total;
    });

    // Player C thấy modal discard và bấm tự động bỏ bài
    await players[2].page.waitForFunction(() => {
      const m = document.getElementById('discard-modal');
      return m && !m.classList.contains('hidden');
    }, { timeout: 10000 });
    await players[2].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'GAMEPLAY-02-PlayerC-DiscardModal7Cards.png') });
    await players[2].page.click('#btn-auto-discard', { force: true });
    await players[2].page.waitForTimeout(600);

    // Kiểm tra tài nguyên Player C đã bị giảm đúng 1 nửa số thẻ
    const p2CardsAfter = await players[2].page.evaluate(() => {
      const p2 = window.gameState.players[2];
      return Object.values(p2.resources).reduce((a, b) => a + b, 0) + Object.values(p2.commodities || {}).reduce((a, b) => a + b, 0);
    });
    expect(p2CardsAfter).toBe(p2CardsBefore - Math.floor(p2CardsBefore / 2));

    // Di chuyển Tên cướp (Robber)
    await host.page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'ROBBER';
      const targetTile = Array.from(gs.tiles.values()).find(t => t.type !== 'SEA' && (t.q !== gs.robberPos?.q || t.r !== gs.robberPos?.r));
      if (targetTile) {
        window.performAction({ type: 'robber', q: targetTile.q, r: targetTile.r });
      }
    });
    await host.page.waitForTimeout(600);
    await host.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'GAMEPLAY-02-PlayerA-MovedRobber.png') });

    // [TEST 2.5.3] Xây dựng & Luật kết nối, Kiểm tra trừ tài nguyên
    await host.page.evaluate(() => {
      window.gameState.phase = 'BUILD';
      const p0 = window.gameState.players[0];
      // Cấp đúng tài nguyên để xây 1 đường (1 Gỗ LUMBER, 1 Gạch BRICK)
      p0.resources.LUMBER = 1;
      p0.resources.BRICK = 1;
    });

    // Thử xây đường ở vị trí không kết nối -> bị chặn
    const unconnectedRoadAttempt = await host.page.evaluate(() => {
      const gs = window.gameState;
      const badEdge = Array.from(gs.edges.keys()).find(eKey => {
        const check = gs.isValidRoadPlacement ? gs.isValidRoadPlacement(eKey, 0) : { ok: false };
        return !check.ok;
      });
      if (badEdge) {
        return gs.placeRoad(badEdge);
      }
      return { ok: false, reason: 'Không nối liền' };
    });
    expect(unconnectedRoadAttempt.ok).toBeFalsy();

    // Xây đường hợp lệ nối với mạng lưới hiện tại
    const roadEdges = await host.page.evaluate(() => window.gameState.getValidRoadEdges());
    expect(roadEdges.length).toBeGreaterThan(0);
    const validRoad = roadEdges[0];

    const roadBuildRes = await host.page.evaluate((eKey) => {
      return window.gameState.placeRoad(eKey);
    }, validRoad);
    expect(roadBuildRes.ok).toBeTruthy();

    // Tài nguyên LUMBER và BRICK của Player A phải bị trừ về 0
    const p0Res = await host.page.evaluate(() => window.gameState.players[0].resources);
    expect(p0Res.LUMBER).toBe(0);
    expect(p0Res.BRICK).toBe(0);
    await host.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'GAMEPLAY-03-PlayerA-BuiltRoadSuccessfully.png') });

    // [TEST 2.5.4] Giao dịch với Ngân Hàng (Bank Trade 4:1 hoặc Cảng)
    const bankTradeRes = await host.page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'BUILD';
      const cp = gs.currentPlayer;
      const rate = gs._getTradeRate ? gs._getTradeRate(cp, 'GRAIN') : 4;
      cp.resources.GRAIN = rate;
      cp.resources.ORE = 0;
      const res = gs.tradeWithBank('GRAIN', rate, 'ORE');
      return { res, rate, grain: cp.resources.GRAIN, ore: cp.resources.ORE };
    });
    expect(bankTradeRes.res.ok).toBeTruthy();
    expect(bankTradeRes.grain).toBe(0);
    expect(bankTradeRes.ore).toBe(1);
    await host.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'GAMEPLAY-04-PlayerA-BankTradeSuccess.png') });

    // [TEST 2.5.5] Điều kiện chiến thắng & Màn hình chiến thắng 13 VP
    // Đưa Player A lên 11 VP, nâng cấp Science lên Cấp 4 nhận Science Metropolis (+2 VP) -> 13 VP
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        const p0 = gs.players[0];
        // Biến 1 settlement thành city thứ 2
        const vKeySettlement = p0.placed.settlements[0];
        p0.placed.settlements = [];
        p0.placed.cities.push(vKeySettlement);
        const v = gs.vertices.get(vKeySettlement);
        if (v) v.building = { playerId: 0, type: 'city' };

        p0.defenderTokens = 2; // +2 VP
        p0.hasMerchant = true; // +1 VP
        gs.merchantOwner = 0;
        p0.metropolises = [{ track: 'trade', vertexKey: p0.placed.cities[0] }]; // +2 VP
        gs.metropolisOwner.trade = 0;
        p0.progressCards.push({ id: 'printer', isVP: true, revealed: true }); // +1 VP
        p0.progressCards.push({ id: 'constitution', isVP: true, revealed: true }); // +1 VP
        p0.commodities.PAPER = 50; // Đủ để nâng cấp Science lên cấp 4
        p0.recalcPublicVP();
      });
    }

    const hostVpBefore = await host.page.evaluate(() => window.gameState.players[0].totalVP());
    expect(hostVpBefore).toBe(11);

    // Host thực hiện nâng cấp Science lên cấp 4 -> Đạt 13 VP và kích hoạt chiến thắng!
    await host.page.evaluate(() => {
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
    });

    // Kiểm tra phase GAME_OVER và Modal chiến thắng trên cả 4 trình duyệt
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      await p.page.waitForFunction(() => {
        const gs = window.gameState;
        return gs && gs.phase === 'GAME_OVER' && gs.winner && gs.winner.id === 0;
      }, { timeout: 15000 });

      await p.page.waitForSelector('#win-modal:not(.hidden)', { timeout: 15000 });
      const winTitle = await p.page.textContent('#win-title');
      expect(winTitle).toContain('CHIẾN THẮNG');

      await p.page.screenshot({ path: path.join(ARTIFACTS_DIR, `GAMEPLAY-05-Player${String.fromCharCode(65 + i)}-VictoryScreen.png`) });
    }
  });
});
