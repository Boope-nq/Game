import { chromium } from 'playwright';
import { MultiPlayerOrchestrator } from './helpers/MultiPlayerOrchestrator.js';

async function runMobileTest() {
  console.log('🚀 Bắt đầu kiểm tra giao diện Mobile...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  
  // Custom context options for mobile
  const contextOptions = {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  };

  const orchestrator = new MultiPlayerOrchestrator(browser);

  try {
    const players = await orchestrator.init(4, contextOptions);
    await orchestrator.registerAndLoginAll('mob_test');

    const host = players[0];
    const roomName = `MOB_CK_${Date.now()}`;
    await host.createRoom(roomName, 4, 'cities_knights');
    const roomCode = await host.getRoomCode();
    console.log('Phòng C&K tạo thành công:', roomCode);

    for (let i = 1; i < 4; i++) {
      await players[i].joinRoomByCode(roomCode);
    }

    await host.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 4;
    }, { timeout: 15000 });

    await host.startGame();

    for (const player of players) {
      await player.page.waitForSelector('#hud', { timeout: 25000 });
    }

    const page = host.page;
    await page.waitForTimeout(2000); // Đợi 3D render ổn định

    // Chụp toàn màn hình Mobile
    await page.screenshot({ path: 'QA/artifacts/mobile_optimized_setup.png' });
    console.log('📸 Đã lưu: QA/artifacts/mobile_optimized_setup.png');

    // Chụp cận cảnh Bottom Bar
    const bottomBar = page.locator('.bottom-bar');
    if (await bottomBar.isVisible()) {
      await bottomBar.screenshot({ path: 'QA/artifacts/mobile_bottom_bar.png' });
      console.log('📸 Đã lưu: QA/artifacts/mobile_bottom_bar.png');
    }

    // Chụp cận cảnh Top Bar & Barbarian HUD
    const barbHud = page.locator('#barbarian-hud');
    if (await barbHud.isVisible()) {
      await barbHud.screenshot({ path: 'QA/artifacts/mobile_barbarian_hud.png' });
      console.log('📸 Đã lưu: QA/artifacts/mobile_barbarian_hud.png');
    }

    // Đánh giá các thành phần
    const barbBox = await barbHud.boundingBox();
    const phaseBox = await page.locator('.phase-indicator').boundingBox();
    console.log('Barbarian HUD bbox:', barbBox);
    console.log('Phase Indicator bbox:', phaseBox);

    console.log('✅ Hoàn thành kiểm tra giao diện mobile!');
  } catch (err) {
    console.error('❌ Lỗi kiểm tra:', err);
  } finally {
    await orchestrator.cleanup();
    await browser.close();
  }
}

runMobileTest();
