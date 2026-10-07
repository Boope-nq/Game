import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';
import { InvariantChecker } from '../helpers/InvariantChecker.js';

test.describe('PHASE H: Progress Cards & Expansion Abilities', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('H.1: Thi triển các thẻ tiến bộ Khoa học (Alchemist, Engineer), Thương mại (Merchant, Resource Monopoly), và Chính trị (Warlord)', async () => {
    test.setTimeout(180000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('h_ck');

    const host = players[0];
    const roomName = `CK_Progress_${Date.now()}`;

    // 1. Tạo phòng C&K & vào phòng 4 người
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

    // 2. Setup 2 vòng (Snake draft)
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

    // Vào Turn 1 của Host
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    // 3. THẺ KHOA HỌC: ALCHEMIST (Nhà giả kim)
    // Cấp thẻ Alchemist cho P0 trên tất cả các trình duyệt
    for (const p of players) {
      await p.page.evaluate(() => {
        window.gameState.players[0].progressCards.push({ id: 'alchemist', isVP: false });
      });
    }

    // Host thi triển Alchemist chọn xúc xắc 4 và 5
    await host.page.evaluate(() => {
      window.performAction({
        type: 'ck_play_progress',
        cardId: 'alchemist',
        options: { d1: 4, d2: 5 }
      });
    });

    // Chờ tất cả trình duyệt nhận trạng thái ép xúc xắc
    for (const p of players) {
      await p.page.waitForFunction(() => {
        return window.gameState && window.gameState.alchemistForcedDice &&
          window.gameState.alchemistForcedDice.d1 === 4 && window.gameState.alchemistForcedDice.d2 === 5;
      }, { timeout: 10000 });
    }

    // Host gieo xúc xắc
    await host.page.click('#btn-roll', { force: true });

    // Kiểm tra xúc xắc ra đúng 4 + 5 = 9 và chuyển sang BUILD
    await host.page.waitForFunction(() => {
      const gs = window.gameState;
      return gs && gs.phase === 'BUILD' && gs.lastRoll && (gs.lastRoll.d1 + gs.lastRoll.d2 === 9);
    }, { timeout: 15000 });

    // 4. THẺ KHOA HỌC: ENGINEER (Kỹ sư)
    // Xây 1 Tường thành miễn phí (không tốn 2 Gạch)
    for (const p of players) {
      await p.page.evaluate(() => {
        const p0 = window.gameState.players[0];
        p0.resources.BRICK = 0;
        p0.progressCards.push({ id: 'engineer', isVP: false });
      });
    }

    const cityVertex = await host.page.evaluate(() => {
      return window.gameState.players[0].placed.cities[0];
    });

    await host.page.evaluate((vKey) => {
      window.performAction({
        type: 'ck_play_progress',
        cardId: 'engineer',
        options: { vertexKey: vKey }
      });
    }, cityVertex);

    // Kiểm tra kết quả Engineer trên tất cả trình duyệt
    for (const p of players) {
      await p.page.waitForFunction(() => {
        const p0 = window.gameState.players[0];
        return p0.cityWalls.length === 1 && p0.resources.BRICK === 0 && p0.getHandLimit() === 9;
      }, { timeout: 10000 });
    }

    // 5. THẺ THƯƠNG MẠI: MERCHANT (Thương nhân)
    // Tìm 1 ô đất kề công trình của P0 để đặt Thương nhân
    const merchantHex = await host.page.evaluate(() => {
      const gs = window.gameState;
      const p0 = gs.players[0];
      const allBuildings = [...p0.placed.settlements, ...p0.placed.cities];
      for (const vKey of allBuildings) {
        const v = gs.vertices.get(vKey);
        if (!v) continue;
        for (const h of v.hexes) {
          const tile = gs.getTile(h.q, h.r);
          if (tile && tile.resource) {
            return { q: h.q, r: h.r };
          }
        }
      }
      return null;
    });

    expect(merchantHex).not.toBeNull();

    for (const p of players) {
      await p.page.evaluate(() => {
        window.gameState.players[0].progressCards.push({ id: 'merchant', isVP: false });
      });
    }

    await host.page.evaluate((mHex) => {
      window.performAction({
        type: 'ck_play_progress',
        cardId: 'merchant',
        options: { hex: mHex }
      });
    }, merchantHex);

    // Kiểm tra Thương nhân và +1 VP trên tất cả trình duyệt
    for (const p of players) {
      await p.page.waitForFunction(() => {
        const gs = window.gameState;
        return gs.merchantOwner === 0 && gs.players[0].hasMerchant === true;
      }, { timeout: 10000 });
    }

    // 6. THẺ THƯƠNG MẠI: RESOURCE MONOPOLY (Độc quyền tài nguyên)
    // Cấp 2 Quặng cho mỗi đối thủ (P1, P2, P3), P0 có 0 Quặng
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        gs.players[0].resources.ORE = 0;
        gs.players[1].resources.ORE = 2;
        gs.players[2].resources.ORE = 2;
        gs.players[3].resources.ORE = 2;
        gs.players[0].progressCards.push({ id: 'resource_monopoly', isVP: false });
      });
    }

    await host.page.evaluate(() => {
      window.performAction({
        type: 'ck_play_progress',
        cardId: 'resource_monopoly',
        options: { resource: 'ORE' }
      });
    });

    // P0 phải thu gom đủ 6 Quặng (2 từ mỗi đối thủ), đối thủ về 0
    for (const p of players) {
      await p.page.waitForFunction(() => {
        const gs = window.gameState;
        return gs.players[0].resources.ORE === 6 &&
               gs.players[1].resources.ORE === 0 &&
               gs.players[2].resources.ORE === 0 &&
               gs.players[3].resources.ORE === 0;
      }, { timeout: 10000 });
    }

    // 7. THẺ CHÍNH TRỊ: WARLORD (Thống soái)
    // Cấp 2 Hiệp sĩ chưa kích hoạt cho P0, 0 Lúa
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        const p0 = gs.players[0];
        p0.resources.GRAIN = 0;
        p0.knights = [
          { id: 'k_war_1', playerId: 0, vertexKey: p0.placed.settlements[0], level: 'basic', active: false },
          { id: 'k_war_2', playerId: 0, vertexKey: p0.placed.cities[0], level: 'strong', active: false }
        ];
        p0.progressCards.push({ id: 'warlord', isVP: false });
      });
    }

    await host.page.evaluate(() => {
      window.performAction({
        type: 'ck_play_progress',
        cardId: 'warlord'
      });
    });

    // Toàn bộ hiệp sĩ phải active mà không tốn Lúa
    for (const p of players) {
      await p.page.waitForFunction(() => {
        const p0 = window.gameState.players[0];
        return p0.knights.length === 2 &&
               p0.knights[0].active === true &&
               p0.knights[1].active === true &&
               p0.resources.GRAIN === 0;
      }, { timeout: 10000 });
    }

    // 8. Invariant verification trên cả 4 trình duyệt
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        for (const pl of gs.players) {
          for (const val of Object.values(pl.resources)) {
            if (val < 0) throw new Error('Resource cannot be negative');
          }
          for (const val of Object.values(pl.commodities)) {
            if (val < 0) throw new Error('Commodity cannot be negative');
          }
        }
      });
    }
  });
});
