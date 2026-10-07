import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';
import { InvariantChecker } from '../helpers/InvariantChecker.js';

test.describe('PHASE I: Metropolis Race & 13 VP Endgame Victory', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('I.1: Cạnh tranh & cướp Đại đô thị (Metropolis theft) khi đối thủ đạt cấp 5', async () => {
    test.setTimeout(180000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('i_metro');

    const host = players[0];
    const roomName = `CK_MetroRace_${Date.now()}`;

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

    // Host vào Turn 1 (ROLL -> BUILD)
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });

    // 3. P0 nâng cấp Khoa học (Science) lên Cấp 4 -> NHẬN ĐẠI ĐÔ THỊ (+2 VP)
    // Cấp đúng 10 PAPER (1+2+3+4 = 10) để sau khi mua hết thì P0 không bị thừa bài lúc bị đổ ra 7
    for (const p of players) {
      await p.page.evaluate(() => {
        const p0 = window.gameState.players[0];
        p0.commodities.PAPER = 10;
      });
    }

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

    const p0VPBefore = await host.page.evaluate(() => window.gameState.players[0].totalVP());

    // P0 kết thúc lượt
    await host.page.click('#btn-end-turn', { force: true });
    await host.page.waitForTimeout(500);

    // 4. Đến lượt P1 (Người chơi 2)
    const p1 = players[1];
    await p1.waitForMyTurn(20000);
    await p1.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    await p1.page.click('#btn-roll', { force: true });
    
    // Chờ xử lý sau khi đổ xúc xắc (nếu ra 7 xử lý discard/robber)
    await p1.page.waitForFunction(() => {
      const gs = window.gameState;
      return gs && (gs.phase === 'BUILD' || gs.phase === 'DISCARD' || gs.phase === 'ROBBER');
    }, { timeout: 15000 });

    const isDiscard = await p1.page.evaluate(() => window.gameState.phase === 'DISCARD');
    if (isDiscard) {
      for (const p of players) {
        const hasDiscard = await p.page.evaluate(() => {
          const m = document.getElementById('discard-modal');
          return m && !m.classList.contains('hidden');
        });
        if (hasDiscard) {
          await p.page.click('#btn-auto-discard', { force: true });
          await p.page.waitForTimeout(400);
        }
      }
    }

    const isRobber = await p1.page.evaluate(() => window.gameState.phase === 'ROBBER');
    if (isRobber) {
      await p1.page.evaluate(() => {
        const gs = window.gameState;
        const current = gs.robberPos || { q: 0, r: 0 };
        const tiles = Array.from(gs.tiles.values()).filter(t => t.q !== current.q || t.r !== current.r);
        if (tiles.length > 0) {
          window.performAction({ type: 'robber', q: tiles[0].q, r: tiles[0].r });
        }
      });
      await p1.page.waitForTimeout(400);
    }

    await p1.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });

    // Cấp tài nguyên nâng cấp cho P1 trên tất cả trình duyệt (1+2+3+4+5 = 15 PAPER)
    for (const p of players) {
      await p.page.evaluate(() => {
        const p1 = window.gameState.players[1];
        p1.commodities.PAPER = 15;
      });
    }

    // P1 nâng cấp Science lên Cấp 5 -> CƯỚP ĐẠI ĐÔ THỊ TỪ P0!
    await p1.page.evaluate(() => {
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
    });

    // Kiểm tra P1 giờ là chủ sở hữu Science Metropolis và P0 mất 2 VP
    for (const p of players) {
      await p.page.waitForFunction((vpBefore) => {
        const gs = window.gameState;
        const ownerIsP1 = gs.metropolisOwner.science === 1;
        const p1HasIt = gs.players[1].metropolises.some(m => m.track === 'science');
        const p0LostIt = !gs.players[0].metropolises.some(m => m.track === 'science');
        const p0VPDropped = gs.players[0].totalVP() === vpBefore - 2;
        return ownerIsP1 && p1HasIt && p0LostIt && p0VPDropped;
      }, p0VPBefore, { timeout: 10000 });
    }

    // 5. Invariant check: Tổng số Metropolis không bao giờ vượt quá 3
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        let totalMetros = 0;
        for (const pl of gs.players) {
          totalMetros += (pl.metropolises || []).length;
        }
        if (totalMetros > 3) throw new Error(`Quá 3 Metropolis: ${totalMetros}`);
      });
    }
  });

  test('I.2: Chạm mốc 13 VP, kích hoạt GAME_OVER và hiển thị modal chiến thắng', async () => {
    test.setTimeout(180000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('i_win');

    const host = players[0];
    const roomName = `CK_Win13_${Date.now()}`;

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

    // Vào Turn 1
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });

    // 3. Chuẩn bị điểm số cho P0 (Host) đạt 11 VP trước khi nâng cấp
    // - 1 City (2 VP) + 1 Settlement (1 VP) = 3 VP
    // - Cần thêm 8 VP để đạt 11 VP:
    //   + 2 Defender tokens = 2 VP
    //   + 1 Merchant = 1 VP
    //   + 1 Metropolis (Trade) = 2 VP (chuyển settlement 1 thành city thứ 2 để gắn metro)
    //   + 3 VP cards = 3 VP
    // - Đang có 11 VP. Nâng cấp Science lên cấp 4 sẽ nhận Science Metropolis (+2 VP) -> 13 VP!
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        const p0 = gs.players[0];

        // Biến 1 settlement thành city thứ 2 để đủ chỗ gắn 2 metropolis
        const vKeySettlement = p0.placed.settlements[0];
        p0.placed.settlements = [];
        p0.placed.cities.push(vKeySettlement);
        const v = gs.vertices.get(vKeySettlement);
        if (v) v.building = { playerId: 0, type: 'city' };

        // 2 Defender tokens
        p0.defenderTokens = 2;

        // Merchant
        p0.hasMerchant = true;
        gs.merchantOwner = 0;

        // 1 Trade Metropolis
        p0.metropolises = [
          { track: 'trade', vertexKey: p0.placed.cities[0] }
        ];
        gs.metropolisOwner.trade = 0;

        // 2 VP Cards
        p0.progressCards.push({ id: 'printer', isVP: true, revealed: true });
        p0.progressCards.push({ id: 'constitution', isVP: true, revealed: true });

        // Cấp hàng hóa nâng cấp Science lên cấp 4
        p0.commodities.PAPER = 50;

        p0.recalcPublicVP();
      });
    }

    // Xác nhận P0 hiện có 11 VP trước đòn quyết định
    const p0VpCurrent = await host.page.evaluate(() => window.gameState.players[0].totalVP());
    expect(p0VpCurrent).toBe(11);

    // Host nâng cấp Science lên cấp 4 -> NHẬN METROPOLIS THỨ 2 (+2 VP) -> ĐẠT 13 VP VÀ THẮNG TRẬN!
    await host.page.evaluate(() => {
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
    });

    // 4. Kiểm tra trạng thái GAME_OVER trên TẤT CẢ 4 trình duyệt
    for (const p of players) {
      await p.page.waitForFunction(() => {
        const gs = window.gameState;
        return gs && gs.phase === 'GAME_OVER' && gs.winner && gs.winner.id === 0;
      }, { timeout: 15000 });

      // Kiểm tra modal chiến thắng xuất hiện trên giao diện
      await p.page.waitForSelector('#win-modal:not(.hidden)', { timeout: 15000 });
      const winTitle = await p.page.textContent('#win-title');
      expect(winTitle).toContain('CHIẾN THẮNG');
    }

    // 5. Kiểm tra Invariants cuối trận
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        if (!gs.winner) throw new Error('Phải có người chiến thắng');
        if (gs.winner.totalVP() < 13) throw new Error(`Người chiến thắng phải có >= 13 VP (hiện có ${gs.winner.totalVP()})`);
      });
    }
  });
});
