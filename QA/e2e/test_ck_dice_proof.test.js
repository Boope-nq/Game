import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

test.describe('TEST BẰNG CHỨNG CẢ 3 XÚC XẮC & SỰ KIỆN C&K', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('Chụp bằng chứng hoạt động của 3 xúc xắc (Đỏ, Vàng, Sự kiện) và kích hoạt đầy đủ 4 sự kiện (Thuyền, Khoa học, Thương mại, Chính trị)', async () => {
    test.setTimeout(180000);
    console.log('🚀 Khởi tạo 4 tài khoản và vào phòng Cities & Knights...');
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('dice_ev');

    const host = players[0];
    const roomName = `CK_DiceEvent_${Date.now()}`;

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

    for (let i = 0; i < 4; i++) {
      await players[i].waitForGameLoaded();
    }
    console.log('✅ Đã load game.');

    // Setup 2 vòng nhanh
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
    console.log('✅ Setup xong. Vào lượt 1 (ROLL phase).');

    // Nâng cấp nhánh Khoa học, Thương mại, Chính trị của Player 0 lên Cấp 3 để đủ điều kiện nhận thẻ tiến bộ khi xúc xắc đỏ ra 1, 2 hoặc 3
    await host.page.evaluate(() => {
      const p0 = window.gameState.players[0];
      p0.improvements.science = 3;
      p0.improvements.trade = 3;
      p0.improvements.politics = 3;
      if (window.syncAll) window.syncAll();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SỰ KIỆN 1: TUNG RA MẶT THUYỀN (SHIP) -> THUYỀN MAN RỢ TIẾN 1 BƯỚC
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🎲 [SỰ KIỆN 1] Test xúc xắc ra Thuyền Man Rợ (Ship)...');
    await host.page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'ROLL';
      // Roll: Đỏ=3, Vàng=4 (Tổng=7), Sự kiện=Thuyền
      const res = gs.rollDice(3, 4, 'ship');
      if (window.syncAll) window.syncAll();
      return res;
    });

    await host.page.waitForTimeout(500);
    // Chụp bằng chứng xúc xắc sự kiện Thuyền
    await host.page.screenshot({ path: 'QA/artifacts/DICE-EVENT-01-Ship.png' });
    console.log('📸 Đã lưu: QA/artifacts/DICE-EVENT-01-Ship.png');

    // ─────────────────────────────────────────────────────────────────────────
    // SỰ KIỆN 2: TUNG RA CỔNG KHOA HỌC (SCIENCE GATE) + ĐỎ = 2
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🧪 [SỰ KIỆN 2] Test xúc xắc ra Cổng Khoa Học (Science Gate)...');
    const scienceResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'ROLL';
      const cardsBefore = gs.players[0].progressCards.length;
      // Đỏ=2, Vàng=3 (Tổng=5), Sự kiện=science (Cổng Khoa Học)
      const res = gs.rollDice(2, 3, 'science');
      if (window.syncAll) window.syncAll();
      const cardsAfter = gs.players[0].progressCards.length;
      return {
        res,
        cardsBefore,
        cardsAfter,
        gainedCard: cardsAfter > cardsBefore
      };
    });

    await host.page.waitForTimeout(500);
    expect(scienceResult.gainedCard).toBe(true);
    await host.page.screenshot({ path: 'QA/artifacts/DICE-EVENT-02-ScienceGate.png' });
    console.log(`📸 Đã lưu: QA/artifacts/DICE-EVENT-02-ScienceGate.png (Player 0 nhận thẻ Khoa học vì Đỏ=2 <= Cấp Khoa học=3)`);

    // ─────────────────────────────────────────────────────────────────────────
    // SỰ KIỆN 3: TUNG RA CỔNG THƯƠNG MẠI (TRADE GATE) + ĐỎ = 1
    // ─────────────────────────────────────────────────────────────────────────
    console.log('⚖️ [SỰ KIỆN 3] Test xúc xắc ra Cổng Thương Mại (Trade Gate)...');
    const tradeResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'ROLL';
      const cardsBefore = gs.players[0].progressCards.length;
      // Đỏ=1, Vàng=5 (Tổng=6), Sự kiện=trade (Cổng Thương Mại)
      const res = gs.rollDice(1, 5, 'trade');
      if (window.syncAll) window.syncAll();
      const cardsAfter = gs.players[0].progressCards.length;
      return {
        res,
        cardsBefore,
        cardsAfter,
        gainedCard: cardsAfter > cardsBefore
      };
    });

    await host.page.waitForTimeout(500);
    expect(tradeResult.gainedCard).toBe(true);
    await host.page.screenshot({ path: 'QA/artifacts/DICE-EVENT-03-TradeGate.png' });
    console.log(`📸 Đã lưu: QA/artifacts/DICE-EVENT-03-TradeGate.png (Player 0 nhận thẻ Thương mại vì Đỏ=1 <= Cấp Thương mại=3)`);

    // ─────────────────────────────────────────────────────────────────────────
    // SỰ KIỆN 4: TUNG RA CỔNG CHÍNH TRỊ (POLITICS GATE) + ĐỎ = 3
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🏛️ [SỰ KIỆN 4] Test xúc xắc ra Cổng Chính Trị (Politics Gate)...');
    const politicsResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      gs.phase = 'ROLL';
      const cardsBefore = gs.players[0].progressCards.length;
      // Đỏ=3, Vàng=5 (Tổng=8), Sự kiện=politics (Cổng Chính Trị)
      const res = gs.rollDice(3, 5, 'politics');
      if (window.syncAll) window.syncAll();
      const cardsAfter = gs.players[0].progressCards.length;
      return {
        res,
        cardsBefore,
        cardsAfter,
        gainedCard: cardsAfter > cardsBefore
      };
    });

    await host.page.waitForTimeout(500);
    expect(politicsResult.gainedCard).toBe(true);
    await host.page.screenshot({ path: 'QA/artifacts/DICE-EVENT-04-PoliticsGate.png' });
    console.log(`📸 Đã lưu: QA/artifacts/DICE-EVENT-04-PoliticsGate.png (Player 0 nhận thẻ Chính trị vì Đỏ=3 <= Cấp Chính trị=3)`);

    console.log('🎉 [HOÀN TẤT] Cả 4 loại sự kiện của xúc xắc sự kiện C&K đều được phân xử và lưu bằng chứng thành công!');
  });
});
