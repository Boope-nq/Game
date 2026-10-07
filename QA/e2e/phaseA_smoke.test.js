import { test, expect } from '@playwright/test';

test.describe('PHASE A: Smoke Test', () => {
  test('Kiểm tra tải trang chủ không có lỗi console hay 404 assets', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const failedRequests = [];
    page.on('requestfailed', req => {
      failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    const response = await page.goto('/');
    expect(response.status()).toBe(200);

    // Kiểm tra logo và các asset tĩnh
    await expect(page.locator('img.auth-logo-img')).toBeVisible();
    await expect(page.locator('#tab-login')).toBeVisible();
    await expect(page.locator('#tab-register')).toBeVisible();

    // Chờ 1 giây để load đủ tài nguyên
    await page.waitForTimeout(1000);

    expect(failedRequests).toEqual([]);
    // Bỏ qua lỗi kết nối socket tạm thời nếu có
    const severeErrors = consoleErrors.filter(e => !e.includes('ERR_CONNECTION_REFUSED'));
    expect(severeErrors).toEqual([]);
  });

  test('Kiểm tra trang Lobby hiển thị đúng tiếng Việt và dropdown kịch bản', async ({ page }) => {
    // Đăng ký user thực qua API để lấy JWT hợp lệ
    const timestamp = Date.now();
    const regRes = await page.request.post('/api/auth/register', {
      data: {
        username: `smoke_${timestamp}`,
        email: `smoke_${timestamp}@example.com`,
        password: 'password123'
      }
    });
    expect(regRes.ok()).toBeTruthy();
    const authData = await regRes.json();

    await page.addInitScript((data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('username', data.user.username);
    }, authData);

    await page.goto('/lobby.html');
    await expect(page.locator('#user-name')).toContainText(authData.user.username);
    await expect(page.locator('#create-room-btn')).toBeVisible();

    // Mở modal tạo phòng
    await page.click('#create-room-btn');
    await expect(page.locator('#create-modal')).toBeVisible();

    // Kiểm tra dropdown có kịch bản Thành phố & Hiệp sĩ
    const scenarioSelect = page.locator('#room-scenario');
    await expect(scenarioSelect).toBeVisible();
    const options = await scenarioSelect.locator('option').allTextContents();
    expect(options.some(opt => opt.includes('Thành phố & Hiệp sĩ'))).toBeTruthy();
  });
});
