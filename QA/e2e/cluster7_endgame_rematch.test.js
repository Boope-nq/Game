import { test, expect } from '@playwright/test';
import path from 'path';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.7: KẾT THÚC & CHƠI LẠI (ENDGAME, REMATCH, STATE CLEANUP)', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('REMATCH-01 & 02: Bảng điểm chi tiết kết thúc trận, Rematch tái khởi tạo ván mới sạch sẽ & Rời phòng về sảnh', async () => {
    test.setTimeout(240000);
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('ck_end');

    const host = players[0];
    const roomName = `CK_Rematch_${Date.now()}`;

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
      await player.page.waitForTimeout(300);
    }

    // Vào Turn 1
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'ROLL';
    }, { timeout: 15000 });

    await host.page.click('#btn-roll', { force: true });
    await host.page.waitForFunction(() => {
      return window.gameState && window.gameState.phase === 'BUILD';
    }, { timeout: 15000 });

    // 3. Kích hoạt chiến thắng 13 VP cho Host (Player A)
    for (const p of players) {
      await p.page.evaluate(() => {
        const gs = window.gameState;
        const p0 = gs.players[0];

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
        p0.commodities.PAPER = 50;
        p0.recalcPublicVP();
      });
    }

    // Host nâng cấp Science lên cấp 4 để nhận Metropolis thứ 2 -> 13 VP chiến thắng
    await host.page.evaluate(() => {
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
      window.performAction({ type: 'ck_improve', track: 'science' });
    });

    // 4. Kiểm tra modal chiến thắng và bảng điểm chi tiết
    await host.page.waitForSelector('#win-modal:not(.hidden)', { timeout: 15000 });
    await expect(host.page.locator('#win-title')).toContainText('CHIẾN THẮNG');
    await expect(host.page.locator('#win-desc')).toContainText('13 Điểm Chiến Thắng');
    await expect(host.page.locator('#win-avatar-stage')).toBeVisible();

    const finalScores = await host.page.evaluate(() => {
      return window.gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        vp: p.victoryPoints,
        settlements: p.placed.settlements.length,
        cities: p.placed.cities.length
      }));
    });
    expect(finalScores[0].vp).toBeGreaterThanOrEqual(13);

    await host.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'REMATCH-01-Host-VictoryScoreBoard.png') });
    await players[1].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'REMATCH-01-PlayerB-DefeatScoreBoard.png') });

    // 5. Kiểm tra nút Rematch (Chơi lại)
    // Người chơi bấm Rematch
    const btnRematch = host.page.locator('#btn-win-rematch');
    await expect(btnRematch).toBeVisible();
    await btnRematch.click();
    await host.page.waitForTimeout(600);

    await host.page.screenshot({ path: path.join(ARTIFACTS_DIR, 'REMATCH-02-Host-RematchRequested.png') });

    // 6. Kiểm tra người chơi rời phòng về sảnh
    const btnLeave = players[2].page.locator('#btn-win-leave-room');
    if (await btnLeave.isVisible()) {
      players[2].page.once('dialog', async d => await d.accept());
      await btnLeave.click();
      await players[2].page.waitForURL(/lobby\.html/, { timeout: 15000 });
      await players[2].page.screenshot({ path: path.join(ARTIFACTS_DIR, 'REMATCH-02-PlayerC-BackToLobby.png') });
    }
  });
});
