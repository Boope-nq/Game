import { chromium } from 'playwright';
import { MultiPlayerOrchestrator } from './helpers/MultiPlayerOrchestrator.js';

async function testDicePosition() {
  console.log('🚀 Bắt đầu kiểm tra vị trí Xúc Xắc trên Mobile...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
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
    await orchestrator.registerAndLoginAll('dice_pos');

    const host = players[0];
    const roomName = `DICE_POS_${Date.now()}`;
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

    for (const player of players) {
      await player.page.waitForSelector('#hud', { timeout: 25000 });
    }

    const page = host.page;

    // Kích hoạt hiển thị nút xúc xắc và bảng xúc xắc để test UI chính xác
    await page.evaluate(() => {
      const rollBtn = document.getElementById('btn-roll');
      const diceDisplay = document.getElementById('dice-display');
      if (rollBtn) {
        rollBtn.style.display = 'inline-flex';
        rollBtn.classList.add('can-roll');
      }
      if (diceDisplay) {
        diceDisplay.style.display = 'inline-flex';
        const valText = document.getElementById('dice-val-text');
        if (valText) valText.textContent = '6 + 3 = 9 | 🧪 Cổng Khoa Học';
      }
    });

    await page.waitForTimeout(1000);

    // Chụp toàn màn hình
    await page.screenshot({ path: 'QA/artifacts/mobile_dice_raised.png' });
    console.log('📸 Đã lưu: QA/artifacts/mobile_dice_raised.png');

    // Kiểm tra bounding box
    const diceBox = await page.locator('.dice-area').boundingBox();
    const resBox = await page.locator('.resources').boundingBox();
    console.log('Dice Area Box:', diceBox);
    console.log('Resources Box:', resBox);

    // Đáy của diceBox phải nhỏ hơn hoặc bằng đỉnh của resBox (nghĩa là nằm hoàn toàn bên trên resBox)
    const diceBottom = diceBox.y + diceBox.height;
    const resTop = resBox.y;
    console.log(`Khoảng cách an toàn giữa Xúc xắc và Thẻ bài: ${resTop - diceBottom}px`);

    if (diceBottom > resTop) {
      console.warn('⚠️ Cảnh báo: Vẫn còn đè lên thẻ bài!');
    } else {
      console.log('✅ Hoàn hảo! Xúc xắc nằm hoàn toàn bên trên và không chèn lên thẻ tài nguyên!');
    }
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await orchestrator.cleanup();
    await browser.close();
  }
}

testDicePosition();
