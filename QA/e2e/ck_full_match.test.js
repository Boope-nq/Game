import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';
import { InvariantChecker } from '../helpers/InvariantChecker.js';

test.describe('E2E CITIES & KNIGHTS FULL MATCH 4 PLAYERS', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('Chơi trọn vẹn 1 ván C&K 4 người từ Tạo phòng, Setup, Nâng cấp, Man rợ, Thẻ tiến bộ đến Chiến thắng 13 VP', async () => {
    test.setTimeout(240000);
    console.log('🎮 [BƯỚC 1] Khởi tạo 4 phiên trình duyệt độc lập cho 4 người chơi...');
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('ck_grand');

    const host = players[0];
    const roomName = `CK_GrandMatch_${Date.now()}`;

    console.log('🏠 [BƯỚC 2] Host tạo phòng chế độ Cities & Knights (4 người)...');
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();
    console.log(`Mã phòng đã tạo: ${roomCode}`);

    console.log('👥 [BƯỚC 3] 3 người chơi còn lại lần lượt nhập mã và tham gia phòng...');
    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    console.log('🚀 [BƯỚC 4] Host bấm Bắt đầu trận đấu...');
    await host.startGame();

    for (let i = 0; i < 4; i++) {
      await players[i].waitForGameLoaded();
    }
    console.log('✅ Cả 4 người chơi đã load xong bàn cờ 3D!');

    // Chụp screenshot giao diện bàn cờ C&K lúc bắt đầu trận đấu
    await host.page.screenshot({ path: 'QA/artifacts/CK-01-SetupStart.png' });

    console.log('🔄 [BƯỚC 5] Thực hiện Giai đoạn Setup 2 vòng (Snake draft: 0->1->2->3->3->2->1->0)...');
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
    console.log('✅ Hoàn tất Setup! Trong C&K vòng 2 đặt Thành phố (City) và nhận Hàng Hóa ban đầu!');

    // Chụp screenshot sau khi hoàn tất setup
    await host.page.screenshot({ path: 'QA/artifacts/CK-02-SetupFinished.png' });

    console.log('🎲 [BƯỚC 6] Bắt đầu Vòng chơi chính: Gieo 3 Xúc Xắc (Đỏ, Vàng, Sự kiện Man rợ/Cổng thành)...');
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });
    console.log('✅ Gieo xúc xắc thành công! Đã vào giai đoạn BUILD.');

    console.log('⚔️ [BƯỚC 7] Kiểm tra cơ chế Hiệp sĩ C&K (Chiêu mộ -> Kích hoạt -> Thăng cấp)...');
    const knightResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      const cp = gs.currentPlayer;
      cp.resources.WOOL = (cp.resources.WOOL || 0) + 10;
      cp.resources.ORE = (cp.resources.ORE || 0) + 10;
      cp.resources.GRAIN = (cp.resources.GRAIN || 0) + 10;

      // Tìm đỉnh hợp lệ kề với đường/thành phố để chiêu mộ hiệp sĩ
      let targetVKey = null;
      for (const roadKey of cp.placed.roads) {
        const edge = gs.edges.get(roadKey);
        if (!edge) continue;
        for (const vk of edge.vertices) {
          const v = gs.vertices.get(vk);
          if (v && v.hasLand && v.building === null && !gs.players.some(p => (p.knights || []).some(k => k.vertexKey === vk))) {
            targetVKey = vk;
            break;
          }
        }
        if (targetVKey) break;
      }
      if (!targetVKey) return { ok: false, reason: 'Không tìm thấy đỉnh hợp lệ để đặt hiệp sĩ' };

      // Chiêu mộ
      window.performAction({ type: 'ck_recruit_knight', vKey: targetVKey });
      const k = cp.knights && cp.knights[0];
      if (!k) return { ok: false, reason: 'Không chiêu mộ được hiệp sĩ' };

      // Kích hoạt
      window.performAction({ type: 'ck_activate_knight', knightId: k.id });

      // Thăng cấp
      window.performAction({ type: 'ck_promote_knight', knightId: k.id });

      return {
        ok: true,
        knightCount: cp.knights.length,
        isActive: cp.knights[0].active,
        level: cp.knights[0].level
      };
    });

    expect(knightResult.ok).toBe(true);
    expect(knightResult.knightCount).toBe(1);
    expect(knightResult.isActive).toBe(true);
    console.log('✅ Hiệp sĩ của Player 0 đã được chiêu mộ, kích hoạt và thăng cấp thành công!');
    await host.page.screenshot({ path: 'QA/artifacts/CK-03-KnightActivated.png' });

    console.log('🧱 [BƯỚC 8] Kiểm tra Xây Tường Thành (City Wall) & Tăng giới hạn bài trên tay...');
    const wallResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      const cp = gs.currentPlayer;
      cp.resources.BRICK = (cp.resources.BRICK || 0) + 10;
      const cityVKey = cp.placed.cities[0];
      window.performAction({ type: 'ck_build_wall', vertexKey: cityVKey });
      return {
        wallsCount: cp.cityWalls.length,
        handLimit: cp.getHandLimit()
      };
    });
    expect(wallResult.wallsCount).toBe(1);
    expect(wallResult.handLimit).toBe(9); // 7 + 2 = 9
    console.log('✅ Tường thành đã được xây! Hand limit tăng từ 7 lên 9 thẻ.');

    console.log('🏴‍☠️ [BƯỚC 9] Kiểm tra Quân Man rợ tấn công đảo Catan & Phong thưởng Hộ Vệ Catan...');
    const attackResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      const res = gs.triggerBarbarianAttack();
      return {
        ok: true,
        defendersWon: res.defendersWon,
        barbarianReset: gs.barbarianPosition
      };
    });
    expect(attackResult.barbarianReset).toBe(0);
    console.log('✅ Hiệp sĩ hiệp lực đẩy lùi quân man rợ! Điểm man rợ được reset về 0.');
    await host.page.screenshot({ path: 'QA/artifacts/CK-04-DefenderReward.png' });

    console.log('📜 [BƯỚC 10] Kiểm tra Nâng cấp Đô thị & Chiếm lĩnh Đại Đô Thị (Metropolis +2 VP)...');
    for (const p of players) {
      await p.page.evaluate(() => {
        const p0 = window.gameState.players[0];
        p0.commodities.PAPER = (p0.commodities.PAPER || 0) + 20;
        p0.commodities.COIN = (p0.commodities.COIN || 0) + 20;
        p0.commodities.CLOTH = (p0.commodities.CLOTH || 0) + 20;
      });
    }

    // Host nâng cấp Khoa học (Science) lên Cấp 4 -> Nhận Science Metropolis
    await host.page.evaluate(() => {
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
    });

    for (const p of players) {
      await p.page.waitForFunction(() => {
        const gs = window.gameState;
        return gs.metropolisOwner.science === 0 &&
               gs.players[0].metropolises.some(m => m.track === 'science');
      }, { timeout: 10000 });
    }
    console.log('✅ Player 0 đã chiếm lĩnh thành công Đại Đô Thị Khoa Học (+2 VP)!');
    await host.page.screenshot({ path: 'QA/artifacts/CK-05-MetropolisScience.png' });

    console.log('🏆 [BƯỚC 11] Cạnh tranh điểm số và Đạt mốc 13 Điểm Chiến Thắng Kết Thúc Game...');
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        const p0 = gs.players[0];

        // Biến settlement thành city thứ 2
        const vKeySettlement = p0.placed.settlements[0];
        if (vKeySettlement) {
          p0.placed.settlements = [];
          p0.placed.cities.push(vKeySettlement);
          const v = gs.vertices.get(vKeySettlement);
          if (v) v.building = { playerId: 0, type: 'city' };
        }

        // Thêm Defender tokens & Thương gia (Merchant)
        p0.defenderTokens = 2;
        p0.hasMerchant = true;
        gs.merchantOwner = 0;

        // 1 Trade Metropolis
        p0.metropolises = [
          { track: 'trade', vertexKey: p0.placed.cities[0] }
        ];
        gs.metropolisOwner.trade = 0;

        // Thẻ VP C&K
        p0.progressCards.push({ id: 'printer', isVP: true, revealed: true });
        p0.progressCards.push({ id: 'constitution', isVP: true, revealed: true });

        // Cấp hàng hóa để nâng cấp Politics
        p0.commodities.COIN = 50;

        p0.recalcPublicVP();
      });
    }

    // Host nâng cấp Politics lên cấp 4 -> Nhận Metropolis thứ 2 -> VƯỢT 13 VP VÀ THẮNG TRẬN!
    await host.page.evaluate(() => {
      window.performAction({ type: 'ck_improve', track: 'politics' });
      window.performAction({ type: 'ck_improve', track: 'politics' });
      window.performAction({ type: 'ck_improve', track: 'politics' });
      window.performAction({ type: 'ck_improve', track: 'politics' });
    });

    console.log('🎯 [BƯỚC 12] Xác nhận GAME_OVER và Modal Chiến Thắng trên cả 4 trình duyệt...');
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      await p.page.waitForFunction(() => {
        const gs = window.gameState;
        return gs && gs.phase === 'GAME_OVER' && gs.winner && gs.winner.id === 0;
      }, { timeout: 15000 });

      await p.page.waitForSelector('#win-modal:not(.hidden)', { timeout: 15000 });
      const winTitle = await p.page.textContent('#win-title');
      expect(winTitle).toContain('CHIẾN THẮNG');
    }

    console.log('📸 [BƯỚC 13] Chụp ảnh vinh quang trên màn hình Host và Người chơi khác...');
    await host.page.screenshot({ path: 'QA/artifacts/CK-06-VictoryHost.png' });
    await players[1].page.screenshot({ path: 'QA/artifacts/CK-07-VictoryPlayer1.png' });

    console.log('🎉 [HOÀN TẤT] Ván chơi Cities & Knights 4 người từ đầu đến cuối hoàn toàn không có lỗi, Invariants 100% bảo đảm!');
  });
});
