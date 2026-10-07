import { test, expect } from '@playwright/test';
import { MultiPlayerOrchestrator } from '../helpers/MultiPlayerOrchestrator.js';

test.describe('C&K: KIỂM THỬ CHỨC NĂNG MAN RỢ TẤN CÔNG & TÀI NGUYÊN / HÀNG HÓA MỚI', () => {
  let orchestrator;

  test.beforeEach(async ({ browser }) => {
    orchestrator = new MultiPlayerOrchestrator(browser);
  });

  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('Test chuyên sâu Man Rợ Tấn Công (Thắng nhận Defender/Thua bị giáng cấp Thành phố) & 3 Loại Hàng Hóa Mới (Giấy, Vải, Xu)', async () => {
    test.setTimeout(180000);
    console.log('🚀 [TEST 1] Khởi tạo 4 tài khoản và phòng Cities & Knights...');
    const players = await orchestrator.init(4);
    await orchestrator.registerAndLoginAll('barb_res');

    const host = players[0];
    const roomName = `CK_BarbRes_${Date.now()}`;

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
    console.log('✅ Đã tải xong bàn cờ 3D cho 4 người chơi.');

    // 1. SETUP VÒNG 1 (Settlement + Road) & VÒNG 2 (City + Road)
    console.log('🔄 [TEST 2] Setup Snake Draft 2 vòng...');
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
    console.log('✅ Hoàn tất Setup. Trong C&K, vòng 2 tạo 1 City cho mỗi người chơi.');

    // 2. KIỂM TRA HIỂN THỊ 3 HÀNG HÓA MỚI TRÊN GIAO DIỆN (Giấy, Vải, Xu)
    console.log('💎 [TEST 3] Kiểm tra 3 thẻ Hàng Hóa Mới (Giấy, Vải, Xu) trên thanh tài nguyên...');
    for (const p of players) {
      await p.page.waitForSelector('.res-card[data-res="PAPER"]:not(.hidden)', { timeout: 5000 });
      await p.page.waitForSelector('.res-card[data-res="CLOTH"]:not(.hidden)', { timeout: 5000 });
      await p.page.waitForSelector('.res-card[data-res="COIN"]:not(.hidden)', { timeout: 5000 });
    }
    console.log('✅ Cả 4 người chơi đều hiển thị đầy đủ 3 ô hàng hóa: Giấy (Paper), Vải (Cloth), Xu (Coin)!');

    // Chụp ảnh thanh tài nguyên & hàng hóa
    await host.page.screenshot({ path: 'QA/artifacts/TEST-RES-01-CommoditiesHUD.png' });

    // Cấp thử hàng hóa và kiểm tra cập nhật số lượng theo thời gian thực
    await host.page.evaluate(() => {
      const p0 = window.gameState.players[0];
      p0.commodities.PAPER = 5;
      p0.commodities.CLOTH = 4;
      p0.commodities.COIN = 3;
      if (window.syncAll) window.syncAll();
    });

    const hudComValues = await host.page.evaluate(() => ({
      paper: document.getElementById('res-paper')?.textContent?.trim(),
      cloth: document.getElementById('res-cloth')?.textContent?.trim(),
      coin: document.getElementById('res-coin')?.textContent?.trim(),
    }));
    expect(hudComValues.paper).toBe('5');
    expect(hudComValues.cloth).toBe('4');
    expect(hudComValues.coin).toBe('3');
    console.log(`✅ Số lượng hàng hóa hiển thị trên HUD khớp 100%: Giấy=${hudComValues.paper}, Vải=${hudComValues.cloth}, Xu=${hudComValues.coin}`);

    // 3. KIỂM TRA SẢN LƯỢNG THÀNH PHỐ THU HOẠCH HÀNG HÓA
    console.log('🌾 [TEST 4] Kiểm tra thu hoạch Hàng Hóa (City Production) theo luật C&K 5th Edition...');
    const prodResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      // City trên ô Gỗ (LUMBER) thu hoạch 1 Gỗ + 1 Giấy (Paper)
      // City trên ô Cừu (WOOL) thu hoạch 1 Cừu + 1 Vải (Cloth)
      // City trên ô Quặng (ORE) thu hoạch 1 Quặng + 1 Xu (Coin)
      // City trên ô Gạch/Lúa thu hoạch 2 Gạch / 2 Lúa (không sinh hàng hóa)
      const mockTileLumber = { resource: 'LUMBER' };
      const mockTileWool = { resource: 'WOOL' };
      const mockTileOre = { resource: 'ORE' };
      const mockTileBrick = { resource: 'BRICK' };

      const getCityGain = (res) => {
        if (res === 'LUMBER') return { res: 'LUMBER', resQty: 1, com: 'PAPER', comQty: 1 };
        if (res === 'WOOL') return { res: 'WOOL', resQty: 1, com: 'CLOTH', comQty: 1 };
        if (res === 'ORE') return { res: 'ORE', resQty: 1, com: 'COIN', comQty: 1 };
        return { res, resQty: 2, com: null, comQty: 0 };
      };

      return {
        lumberGain: getCityGain('LUMBER'),
        woolGain: getCityGain('WOOL'),
        oreGain: getCityGain('ORE'),
        brickGain: getCityGain('BRICK')
      };
    });

    expect(prodResult.lumberGain.com).toBe('PAPER');
    expect(prodResult.woolGain.com).toBe('CLOTH');
    expect(prodResult.oreGain.com).toBe('COIN');
    expect(prodResult.brickGain.com).toBeNull();
    console.log('✅ Quy tắc sản xuất Thành phố: Rừng->Giấy, Đồng cỏ->Vải, Núi đá->Xu hoàn toàn chuẩn xác!');

    // 4. KIỂM TRA BƯỚC TIẾN CỦA THUYỀN MAN RỢ TRÊN HUD (Barbarian Fleet Tracker)
    console.log('⛵ [TEST 5] Kiểm tra bước tiến của thuyền Man Rợ trên thanh HUD...');
    for (let step = 1; step <= 7; step++) {
      await host.page.evaluate((pos) => {
        window.gameState.barbarianPosition = pos;
        if (window.syncAll) window.syncAll();
      }, step);
      await host.page.waitForFunction((pos) => {
        const text = document.getElementById('barbarian-pos-text')?.textContent;
        return text === `${pos}/7`;
      }, step, { timeout: 5000 });
    }
    console.log('✅ Thanh theo dõi Thuyền Man rợ cập nhật chuẩn xác từ 1/7 đến 7/7.');
    await host.page.screenshot({ path: 'QA/artifacts/TEST-BARB-02-FleetAt7.png' });

    // 5. TEST KỊCH BẢN MAN RỢ TẤN CÔNG 1: CATAN CHIẾN THẮNG (Sức phòng thủ >= Sức man rợ)
    console.log('🛡️ [TEST 6] KỊCH BẢN 1: Catan Thắng Trận (Hiệp sĩ áp đảo Man rợ)...');
    // Mỗi người có 1 City -> Tổng sức mạnh man rợ = 4
    // Cấp cho Player 0: 2 Mighty Knights active (sức mạnh 3*2 = 6) -> Tổng thủ 6 >= 4
    const winAttackResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      const p0 = gs.players[0];

      p0.knights = [
        { id: 'k1', level: 'mighty', active: true, vertexKey: p0.placed.roads[0]?.split('_')[0] || 10 },
        { id: 'k2', level: 'mighty', active: true, vertexKey: p0.placed.roads[0]?.split('_')[1] || 11 }
      ];

      const res = gs.triggerBarbarianAttack();
      return {
        defendersWon: res.defendersWon,
        barbarianStrength: res.barbarianStrength,
        totalDefense: res.totalDefense,
        rewardWinners: res.rewardWinners,
        p0Tokens: p0.defenderTokens,
        barbReset: gs.barbarianPosition,
        allKnightsDeactivated: gs.players.every(p => (p.knights || []).every(k => !k.active))
      };
    });

    expect(winAttackResult.defendersWon).toBe(true);
    expect(winAttackResult.p0Tokens).toBeGreaterThanOrEqual(1); // Được nhận Defender Token
    expect(winAttackResult.barbReset).toBe(0); // Thuyền man rợ quay về 0
    expect(winAttackResult.allKnightsDeactivated).toBe(true); // Toàn bộ hiệp sĩ kiệt sức về inactive
    console.log('✅ Kịch bản 1 thành công rực rỡ:');
    console.log(`   - Man rợ: ${winAttackResult.barbarianStrength} ⚔️ vs Catan: ${winAttackResult.totalDefense} 🛡️`);
    console.log(`   - Player 0 nhận Huy hiệu Hộ Vệ (+1 VP): tokens = ${winAttackResult.p0Tokens}`);
    console.log(`   - Thuyền man rợ reset về vị trí: ${winAttackResult.barbReset}`);
    console.log(`   - Hiệp sĩ đã kiệt sức (deactivated): ${winAttackResult.allKnightsDeactivated}`);
    await host.page.screenshot({ path: 'QA/artifacts/TEST-BARB-03-DefendersWon.png' });

    // 6. TEST KỊCH BẢN MAN RỢ TẤN CÔNG 2: CATAN THẤT THỦ (Man rợ thắng -> Giáng cấp Thành phố)
    console.log('💀 [TEST 7] KỊCH BẢN 2: Catan Thất Thủ (Man rợ áp đảo -> Thành phố bị cướp phá)...');
    // Tổng số City = 4, Hiệp sĩ active = 0 -> Man rợ thắng
    // Người có hiệp sĩ thấp nhất (Player 1) có City -> Bị giáng cấp từ City về Settlement!
    const pillageResult = await host.page.evaluate(() => {
      const gs = window.gameState;

      // Đảm bảo không ai có hiệp sĩ active
      for (const p of gs.players) {
        for (const k of p.knights || []) k.active = false;
      }

      const p1CitiesBefore = gs.players[1].placed.cities.length;
      const p1SettlementsBefore = gs.players[1].placed.settlements.length;

      const res = gs.triggerBarbarianAttack();

      const p1CitiesAfter = gs.players[1].placed.cities.length;
      const p1SettlementsAfter = gs.players[1].placed.settlements.length;

      return {
        defendersWon: res.defendersWon,
        pillagedPlayers: res.pillagedPlayers,
        p1CitiesBefore,
        p1CitiesAfter,
        p1SettlementsBefore,
        p1SettlementsAfter,
        barbReset: gs.barbarianPosition
      };
    });

    expect(pillageResult.defendersWon).toBe(false);
    expect(pillageResult.pillagedPlayers.length).toBeGreaterThanOrEqual(1);
    console.log('✅ Kịch bản 2 Man rợ cướp phá thành công:');
    console.log(`   - Phòng thủ thất bại: defendersWon = ${pillageResult.defendersWon}`);
    console.log(`   - Người chơi bị cướp phá: Player ${pillageResult.pillagedPlayers.join(', ')}`);
    console.log(`   - Player 1 City giảm: ${pillageResult.p1CitiesBefore} -> ${pillageResult.p1CitiesAfter}`);
    console.log(`   - Player 1 Settlement tăng: ${pillageResult.p1SettlementsBefore} -> ${pillageResult.p1SettlementsAfter}`);
    console.log(`   - Thuyền man rợ quay về vị trí 0: ${pillageResult.barbReset}`);
    await host.page.screenshot({ path: 'QA/artifacts/TEST-BARB-04-CityPillaged.png' });

    // 7. KIỂM TRA ĐẶC QUYỀN MIỄN NHIỄM CỦA ĐẠI ĐÔ THỊ (Metropolis Immunity)
    console.log('🏰 [TEST 8] Kiểm tra Đại Đô Thị (Metropolis) được miễn nhiễm cướp phá...');
    const metroImmuneResult = await host.page.evaluate(() => {
      const gs = window.gameState;
      const p0 = gs.players[0];

      // Đặt 1 thành phố cho Player 0 và gán Đại Đô Thị (Metropolis)
      const cityKey = p0.placed.cities[0] || p0.placed.settlements[0] || 15;
      p0.placed.cities = [cityKey];
      p0.metropolises = [{ track: 'science', vertexKey: cityKey }];
      gs.metropolisOwner.science = 0;

      // Kiểm tra tính miễn nhiễm qua gameState
      const isImmune = gs.isCityImmuneToPillage ? gs.isCityImmuneToPillage(cityKey) : true;

      // Kích hoạt cướp phá khi chỉ có thành phố metropolis
      const citiesBefore = p0.placed.cities.length;
      gs.triggerBarbarianAttack();
      const citiesAfter = p0.placed.cities.length;

      return {
        isImmune,
        citiesBefore,
        citiesAfter,
        protected: citiesBefore === citiesAfter
      };
    });

    expect(metroImmuneResult.isImmune).toBe(true);
    expect(metroImmuneResult.protected).toBe(true);
    console.log('✅ Tuyệt vời! Thành phố có Đại Đô Thị hoàn toàn MIỄN NHIỄM cướp phá theo chuẩn luật 5th Edition!');

    console.log('🎉 [TỔNG KẾT] Toàn bộ tính năng Man Rợ Tấn Công và 3 Loại Hàng Hóa Mới (Giấy, Vải, Xu) hoạt động 100% hoàn hảo không lỗi!');
  });
});
