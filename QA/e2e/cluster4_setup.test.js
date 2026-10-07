import { test, expect } from '@playwright/test';
import path from 'path';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.4: GIAI ĐOẠN ĐẶT BAN ĐẦU (SETUP PHASE)', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('SETUP-01: Snake order A->B->C->D->D->C->B->A, Luật 2 cạnh & Phân bổ tài nguyên đợt 2', async () => {
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('setup4p');

    const host = players[0];
    const roomName = `Setup_Test_${Date.now()}`;

    // 1. Host tạo phòng C&K 4 người
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();

    // 2. 3 Người chơi B, C, D join phòng
    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    // 3. Đợi đủ 4 người trong phòng chờ
    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    await host.startGame();

    // 4. Đợi cả 4 người load xong 3D Board
    for (const p of players) {
      await p.waitForGameLoaded();
    }

    // Chụp screenshot đầu game của 4 người
    await players[0].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'SETUP-01-PlayerA-GameStarted.png') });
    await players[1].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'SETUP-01-PlayerB-GameStarted.png') });
    await players[2].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'SETUP-01-PlayerC-GameStarted.png') });
    await players[3].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'SETUP-01-PlayerD-GameStarted.png') });

    // 5. Kiểm tra người chưa đến lượt không thể đặt công trình (Player B thử đặt khi lượt của A)
    const illegalAttempt = await players[1].executeSetupPlacement();
    expect(illegalAttempt.ok).toBeFalsy();
    expect(illegalAttempt.reason).toBe('Not my turn');

    // 6. Trình tự đặt Snake Draft: [A, B, C, D, D, C, B, A]
    const snakeOrder = [0, 1, 2, 3, 3, 2, 1, 0];

    let playerA_vKey = null;

    for (let step = 0; step < snakeOrder.length; step++) {
      const pIdx = snakeOrder[step];
      const player = players[pIdx];

      // Đợi lượt đúng người
      await player.waitForMyTurn(25000);

      // Xác nhận currentPlayerIndex đúng với pIdx
      const currentIdx = await player.page.evaluate(() => window.gameState.currentPlayerIndex);
      expect(currentIdx).toBe(pIdx);

      // Đặt Định cư / Thành phố
      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_SETTLEMENT';
      }, { timeout: 15000 });

      if (step === 0) {
        const rS = await player.executeSetupPlacement();
        expect(rS.ok).toBeTruthy();
        playerA_vKey = rS.vKey;
      } else if (step === 1) {
        // Player B thử đặt vi phạm khoảng cách kề sát Định cư của Player A (khoảng cách 1 cạnh)
        const adjKey = await player.page.evaluate((key) => {
          const v = window.gameState.vertices.get(key);
          return v ? [...v.adjacentVertices][0] : null;
        }, playerA_vKey);

        const violationAttempt = await player.page.evaluate((badKey) => {
          return window.gameState.setupPlaceSettlement(badKey);
        }, adjKey);
        expect(violationAttempt.ok).toBeFalsy();
        expect(violationAttempt.reason).toContain('khoảng cách');

        // Sau đó đặt vị trí hợp lệ
        const rS = await player.executeSetupPlacement();
        expect(rS.ok).toBeTruthy();
      } else {
        const rS = await player.executeSetupPlacement();
        expect(rS.ok).toBeTruthy();
      }

      // Đặt Đường / Tàu
      await player.page.waitForFunction(() => {
        return window.gameState && window.gameState.phase === 'SETUP_ROAD';
      }, { timeout: 15000 });
      const rR = await player.executeSetupPlacement();
      expect(rR.ok).toBeTruthy();

      await player.page.waitForTimeout(500);
    }

    // 7. Kết thúc Setup -> Chuyển sang Vòng 1 (Phase ROLL / TURN_DICE_ROLL)
    await host.page.waitForFunction(() => {
      return window.gameState && (window.gameState.phase === 'ROLL' || window.gameState.phase === 'TURN_DICE_ROLL');
    }, { timeout: 20000 });

    // 8. Kiểm tra kho tài nguyên của cả 4 người chơi sau khi hoàn thành 2 vòng đặt
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      const inventory = await p.page.evaluate(() => {
        const me = window.gameState.players[window.myPlayerIndex];
        const resCount = Object.values(me.resources || {}).reduce((a, b) => a + b, 0);
        const commCount = Object.values(me.commodities || {}).reduce((a, b) => a + b, 0);
        return {
          totalCards: resCount + commCount,
          settlements: me.placed.settlements.length,
          cities: me.placed.cities.length,
          roads: me.placed.roads.length + (me.placed.ships ? me.placed.ships.length : 0),
          resources: me.resources,
          commodities: me.commodities
        };
      });

      // Mỗi người chơi phải có ít nhất 1-3 tài nguyên/hàng hóa từ khu định cư/thành phố thứ 2 (đặt trên hex đất)
      expect(inventory.totalCards).toBeGreaterThanOrEqual(1);
      // Đã đặt đủ 1 settlement và 1 city (trong C&K) hoặc 2 settlements
      expect(inventory.settlements + inventory.cities).toBe(2);
      expect(inventory.roads).toBe(2);

      await p.page.screenshot({ path: path.join(ARTIFACTS_DIR, `SETUP-01-Player${String.fromCharCode(65 + i)}-InventoryVerified.png`) });
    }
  });
});
