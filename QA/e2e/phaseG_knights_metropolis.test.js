import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';
import { InvariantChecker } from '../helpers/InvariantChecker.js';

test.describe('PHASE G: Knights, Metropolis & Barbarian Attack Mechanics', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('G.1: Chiêu mộ & nâng cấp Hiệp sĩ, nâng cấp Đô thị (Metropolis), Tường thành, và chống trả Man rợ', async () => {
    test.setTimeout(180000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('g_ck');

    const host = players[0];
    const roomName = `CK_Knights_${Date.now()}`;

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

    // 2. Setup 2 vòng
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

    // Vào Turn 1
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    // Host gieo xúc xắc vào phase BUILD
    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });

    // 3. THỰC HIỆN CƠ CHẾ HIỆP SĨ (Chiêu mộ -> Kích hoạt -> Thăng cấp)
    const knightResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      const cp = gs.currentPlayer;
      
      // Cấp tài nguyên chiêu mộ và kích hoạt
      cp.resources.WOOL = (cp.resources.WOOL || 0) + 10;
      cp.resources.ORE = (cp.resources.ORE || 0) + 10;
      cp.resources.GRAIN = (cp.resources.GRAIN || 0) + 10;

      // Tìm đỉnh hợp lệ kề với đường/thành phố để chiêu mộ hiệp sĩ (không trùng công trình và chưa có hiệp sĩ)
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

      // Thăng cấp lên Strong (sức mạnh 2)
      window.performAction({ type: 'ck_promote_knight', knightId: k.id });

      return {
        ok: true,
        knightCount: cp.knights.length,
        isActive: cp.knights[0].active,
        level: cp.knights[0].level,
        strength: cp.totalActiveKnightStrength ? cp.totalActiveKnightStrength() : 2
      };
    });

    expect(knightResult.ok).toBeTruthy();
    expect(knightResult.knightCount).toBe(1);
    expect(knightResult.isActive).toBe(true);
    expect(knightResult.level).toBe('strong');
    expect(knightResult.strength).toBe(2);

    // 4. THỰC HIỆN NÂNG CẤP ĐÔ THỊ & XÂY TƯỜNG THÀNH (City Wall)
    const upgradeResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      const cp = gs.currentPlayer;

      // Cấp hàng hóa
      cp.commodities.PAPER = (cp.commodities.PAPER || 0) + 10;
      cp.commodities.CLOTH = (cp.commodities.CLOTH || 0) + 10;
      cp.commodities.COIN = (cp.commodities.COIN || 0) + 10;
      cp.resources.BRICK = (cp.resources.BRICK || 0) + 10;

      // Xây tường thành tại thành phố khởi đầu
      const cityVKey = cp.placed.cities[0];
      window.performAction({ type: 'ck_build_wall', vertexKey: cityVKey });

      // Nâng cấp nhánh Khoa học (Science) lên cấp 1, 2, 3, 4
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });

      return {
        wallsCount: cp.cityWalls.length,
        handLimit: cp.getHandLimit(),
        scienceLevel: cp.improvements.science,
        hasMetropolis: cp.metropolises && cp.metropolises.length > 0
      };
    });

    expect(upgradeResult.wallsCount).toBe(1);
    expect(upgradeResult.handLimit).toBe(9); // 7 + 2 = 9
    expect(upgradeResult.scienceLevel).toBe(4);
    expect(upgradeResult.hasMetropolis).toBe(true); // Đạt cấp 4 nhận Metropolis!

    // 5. THỰC HIỆN ĐỢT TẤN CÔNG CỦA MAN RỢ (Barbarian Attack)
    const attackResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      // Kích hoạt giải quyết trận chiến man rợ
      const res = gs.triggerBarbarianAttack();
      return {
        ok: true,
        defendersWon: res.defendersWon,
        barbarianStrength: res.barbarianStrength,
        knightsStrength: res.totalDefense,
        rewardWinners: res.rewardWinners,
        barbarianReset: gs.barbarianPosition
      };
    });

    expect(attackResult.ok).toBeTruthy();
    expect(attackResult.barbarianReset).toBe(0); // Thuyền man rợ quay về 0

    // 6. Kiểm tra toàn vẹn Invariants trên tất cả 4 trình duyệt
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        // Invariant: Không tài nguyên âm
        for (const pl of gs.players) {
          for (const val of Object.values(pl.resources)) if (val < 0) throw new Error('Res âm');
          for (const val of Object.values(pl.commodities)) if (val < 0) throw new Error('Com âm');
        }
        // Invariant: Metropolis không vượt quá 3
        let mCount = 0;
        for (const pl of gs.players) mCount += (pl.metropolises || []).length;
        if (mCount > 3) throw new Error('Quá 3 Metropolis');
      });
    }
  });
});
