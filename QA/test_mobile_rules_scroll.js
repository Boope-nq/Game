import { chromium } from 'playwright';

async function testMobileRulesScroll() {
  console.log('📱 Bắt đầu kiểm tra Modal Luật Chơi trên Mobile Viewport (390 x 844)...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14 size
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  try {
    // 1. Vào trang đăng nhập và tạo user để vào Lobby
    await page.goto('/');
    const ts = Date.now().toString().slice(-5);
    const user = `mob_${ts}`;
    await page.click('#tab-register');
    await page.fill('#reg-user', user);
    await page.fill('#reg-email', `${user}@test.com`);
    await page.fill('#reg-pass', 'password123');
    await page.fill('#reg-confirm', 'password123');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/lobby\.html/, { timeout: 15000 });

    // 2. Mở Modal Luật Chơi từ nút Luật Chơi ở Mobile Bottom Nav
    console.log('Mở modal luật chơi trên mobile...');
    await page.click('#tab-rules');
    await page.waitForSelector('#rules-modal:not(.hidden)', { timeout: 5000 });

    // Kiểm tra vị trí của modal & header trước khi cuộn
    const modalBoxBefore = await page.locator('#rules-modal .rules-dialog').boundingBox();
    console.log('Kích thước/Vị trí Modal ban đầu:', modalBoxBefore);

    // 3. Cuộn dọc xuống tận cùng (Section 13: 54 thẻ tiến bộ)
    console.log('Cuộn nội dung rules-body xuống cuối cùng...');
    await page.evaluate(() => {
      const rulesBody = document.getElementById('rules-body');
      if (rulesBody) {
        rulesBody.scrollTop = rulesBody.scrollHeight;
        rulesBody.dispatchEvent(new Event('scroll'));
      }
    });
    await page.waitForTimeout(1000);

    // Kiểm tra vị trí của modal & header sau khi cuộn xuống cuối
    const modalBoxAfter = await page.locator('#rules-modal .rules-dialog').boundingBox();
    const headerBoxAfter = await page.locator('#rules-modal .rules-header').boundingBox();
    console.log('Kích thước/Vị trí Modal sau khi cuộn xuống cuối:', modalBoxAfter);
    console.log('Kích thước/Vị trí Rules Header sau khi cuộn:', headerBoxAfter);

    // 4. Click trực tiếp vào Tab 13 (54 Thẻ Tiến Bộ) ở cuối cùng bên phải thanh nav
    const ckCardsBtn = page.locator('.rules-nav-btn[data-target="sec-ck-progress-cards"]');
    await ckCardsBtn.click();
    await page.waitForTimeout(1000);

    const modalBoxAfterClick = await page.locator('#rules-modal .rules-dialog').boundingBox();
    console.log('Kích thước/Vị trí Modal sau khi click tab cuối:', modalBoxAfterClick);

    // Chụp screenshot màn hình mobile để kiểm tra trực quan
    await page.screenshot({ path: 'QA/artifacts/mobile_rules_bottom_fixed.png' });
    console.log('📸 Đã lưu ảnh chụp: QA/artifacts/mobile_rules_bottom_fixed.png');

    // Kiểm tra tính cân đối: modal.x phải xấp xỉ 0 (không bị lệch sang trái -80px)
    if (modalBoxAfterClick.x < -2) {
      console.error(`❌ Modal vẫn bị lệch sang trái: x = ${modalBoxAfterClick.x}`);
    } else {
      console.log(`✅ Tuyệt vời! Modal x = ${modalBoxAfterClick.x}, hoàn toàn thẳng thớm và khớp màn hình!`);
    }

  } catch (err) {
    console.error('❌ Lỗi kiểm tra:', err);
  } finally {
    await browser.close();
  }
}

testMobileRulesScroll();
