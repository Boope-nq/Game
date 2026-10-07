import { chromium } from 'playwright';
import { MultiPlayerOrchestrator } from './helpers/MultiPlayerOrchestrator.js';

async function test3DEventDice() {
  console.log('🎲 Bắt đầu kiểm tra và chụp bằng chứng 3 Hạt Xúc Xắc 3D (Cities & Knights)...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });

  try {
    // 1. Test trên Desktop Viewport (1280x800)
    console.log('--- 1. Kiểm tra trên Desktop (1280x800) ---');
    const orchestratorDesk = new MultiPlayerOrchestrator(browser);
    const playersDesk = await orchestratorDesk.init(2, {
      baseURL: 'http://localhost:3000',
      viewport: { width: 1280, height: 800 }
    });
    await orchestratorDesk.registerAndLoginAll('d3d_desk');
    const hostDesk = playersDesk[0];
    const roomNameDesk = `D3D_DESK_${Date.now()}`;
    await hostDesk.createRoom(roomNameDesk, 2, 'cities_knights');
    const codeDesk = await hostDesk.getRoomCode();
    await playersDesk[1].joinRoomByCode(codeDesk);

    await hostDesk.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 2;
    }, { timeout: 15000 });

    await hostDesk.startGame();
    await hostDesk.page.waitForSelector('#hud', { timeout: 25000 });
    await hostDesk.page.waitForTimeout(2000);

    const deskPage = hostDesk.page;

    // Test từng mặt xúc xắc sự kiện trên 3D
    const eventScenarios = [
      { d1: 5, d2: 3, event: 'science', name: 'DICE3D_DESK_SCIENCE' },
      { d1: 2, d2: 4, event: 'trade', name: 'DICE3D_DESK_TRADE' },
      { d1: 6, d2: 1, event: 'politics', name: 'DICE3D_DESK_POLITICS' },
      { d1: 4, d2: 3, event: 'ship', name: 'DICE3D_DESK_SHIP' }
    ];

    for (const sc of eventScenarios) {
      console.log(`Đang đổ 3D: D1=${sc.d1}, D2=${sc.d2}, Event=${sc.event}...`);
      await deskPage.evaluate(({ d1, d2, event }) => {
        if (window.dice3D) {
          window.dice3D.roll(d1, d2, event);
        }
      }, { d1: sc.d1, d2: sc.d2, event: sc.event });

      // Đợi xúc xắc rơi và dừng lại ở Hold Phase (1.4s)
      await deskPage.waitForTimeout(1450);

      // Chụp ảnh lại
      const shotPath = `QA/artifacts/${sc.name}.png`;
      await deskPage.screenshot({ path: shotPath });
      console.log(`📸 Đã chụp: ${shotPath}`);
      await deskPage.waitForTimeout(2500); // Chờ hết chu kỳ fade
    }

    await orchestratorDesk.cleanup();

    // 2. Test trên Mobile Viewport (iPhone 14: 390x844)
    console.log('--- 2. Kiểm tra trên Mobile (390x844) ---');
    const orchestratorMobile = new MultiPlayerOrchestrator(browser);
    const playersMobile = await orchestratorMobile.init(2, {
      baseURL: 'http://localhost:3000',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    await orchestratorMobile.registerAndLoginAll('d3d_mob');
    const hostMob = playersMobile[0];
    const roomNameMob = `D3D_MOB_${Date.now()}`;
    await hostMob.createRoom(roomNameMob, 2, 'cities_knights');
    const codeMob = await hostMob.getRoomCode();
    await playersMobile[1].joinRoomByCode(codeMob);

    await hostMob.page.waitForFunction(() => {
      const list = document.querySelector('#waiting-player-list');
      return list && list.children.length >= 2;
    }, { timeout: 15000 });

    await hostMob.startGame();
    await hostMob.page.waitForSelector('#hud', { timeout: 25000 });
    await hostMob.page.waitForTimeout(2000);

    const mobPage = hostMob.page;

    console.log('Đang đổ 3D trên Mobile: D1=3, D2=2, Event=ship (Thuyền Hải Tặc)...');
    await mobPage.evaluate(() => {
      if (window.dice3D) {
        window.dice3D.roll(3, 2, 'ship');
      }
    });
    await mobPage.waitForTimeout(1450);
    await mobPage.screenshot({ path: 'QA/artifacts/DICE3D_MOBILE_SHIP.png' });
    console.log('📸 Đã chụp: QA/artifacts/DICE3D_MOBILE_SHIP.png');

    await mobPage.waitForTimeout(2500);

    console.log('Đang đổ 3D trên Mobile: D1=6, D2=5, Event=science (Cổng Khoa Học)...');
    await mobPage.evaluate(() => {
      if (window.dice3D) {
        window.dice3D.roll(6, 5, 'science');
      }
    });
    await mobPage.waitForTimeout(1450);
    await mobPage.screenshot({ path: 'QA/artifacts/DICE3D_MOBILE_SCIENCE.png' });
    console.log('📸 Đã chụp: QA/artifacts/DICE3D_MOBILE_SCIENCE.png');

    await orchestratorMobile.cleanup();

    console.log('🎉 Hoàn thành xuất sắc kiểm tra 3 Hạt Xúc Xắc 3D!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await browser.close();
  }
}

test3DEventDice();
