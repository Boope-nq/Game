import { chromium } from 'playwright';

async function testRulesModal() {
  console.log('🚀 Bắt đầu kiểm tra Modal Luật Chơi (bao gồm phần Cities & Knights)...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    // 1. Vào trang đăng nhập và tạo user để vào Lobby
    await page.goto('/');
    const ts = Date.now().toString().slice(-5);
    const user = `rules_${ts}`;
    await page.click('#tab-register');
    await page.fill('#reg-user', user);
    await page.fill('#reg-email', `${user}@test.com`);
    await page.fill('#reg-pass', 'password123');
    await page.fill('#reg-confirm', 'password123');
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/lobby\.html/, { timeout: 15000 });

    // 2. Mở Modal Luật Chơi từ nút Luật Chơi ở Lobby
    console.log('Mở modal luật chơi...');
    await page.click('#rules-btn');
    await page.waitForSelector('#rules-modal:not(.hidden)', { timeout: 5000 });

    // 3. Kiểm tra các nút C&K đã xuất hiện trong Navigation
    const ckOverviewBtn = page.locator('.rules-nav-btn[data-target="sec-ck-overview"]');
    const ckCommoditiesBtn = page.locator('.rules-nav-btn[data-target="sec-ck-commodities"]');
    const ckKnightsBtn = page.locator('.rules-nav-btn[data-target="sec-ck-knights-barbarians"]');
    const ckCardsBtn = page.locator('.rules-nav-btn[data-target="sec-ck-progress-cards"]');

    if (!(await ckOverviewBtn.isVisible())) throw new Error('Không thấy nút tab sec-ck-overview');
    if (!(await ckCommoditiesBtn.isVisible())) throw new Error('Không thấy nút tab sec-ck-commodities');
    if (!(await ckKnightsBtn.isVisible())) throw new Error('Không thấy nút tab sec-ck-knights-barbarians');
    if (!(await ckCardsBtn.isVisible())) throw new Error('Không thấy nút tab sec-ck-progress-cards');
    console.log('✅ Đã tìm thấy đầy đủ 4 tab C&K trong Navigation!');

    // 4. Click tab 10: C&K Tổng Quan
    await ckOverviewBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'QA/artifacts/rules_ck_overview.png' });
    console.log('📸 Đã lưu: QA/artifacts/rules_ck_overview.png');

    // 5. Click tab 11: Hàng Hóa & Đô Thị
    await ckCommoditiesBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'QA/artifacts/rules_ck_commodities.png' });
    console.log('📸 Đã lưu: QA/artifacts/rules_ck_commodities.png');

    // 6. Click tab 12: Hiệp Sĩ & Thủ Thành Man Rợ
    await ckKnightsBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'QA/artifacts/rules_ck_knights.png' });
    console.log('📸 Đã lưu: QA/artifacts/rules_ck_knights.png');

    // 7. Click tab 13: 54 Thẻ Tiến Bộ
    await ckCardsBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'QA/artifacts/rules_ck_cards.png' });
    console.log('📸 Đã lưu: QA/artifacts/rules_ck_cards.png');

    console.log('🎉 Toàn bộ bài test kiểm tra Modal Luật Chơi C&K thành công 100%!');
  } catch (err) {
    console.error('❌ Lỗi kiểm tra:', err);
  } finally {
    await browser.close();
  }
}

testRulesModal();
