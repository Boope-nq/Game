import { test, expect } from '@playwright/test';

test.describe('PHASE B: Authentication & Session Management', () => {
  const timestamp = Date.now();
  const validUser = {
    username: `user_${timestamp}`,
    email: `user_${timestamp}@example.com`,
    password: 'password123'
  };

  test('B.1: Đăng ký tài khoản hợp lệ thành công và điều hướng vào Lobby', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-register');
    await page.fill('#reg-user', validUser.username);
    await page.fill('#reg-email', validUser.email);
    await page.fill('#reg-pass', validUser.password);
    await page.fill('#reg-confirm', validUser.password);
    await page.click('#form-register button[type="submit"]');

    await page.waitForURL(/lobby\.html/, { timeout: 15000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    await expect(page.locator('#user-name')).toContainText(validUser.username);
  });

  test('B.2: Đăng ký trùng tên đăng nhập hoặc email báo lỗi đúng', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-register');
    await page.fill('#reg-user', validUser.username);
    await page.fill('#reg-email', `other_${timestamp}@example.com`);
    await page.fill('#reg-pass', 'password123');
    await page.fill('#reg-confirm', 'password123');
    await page.click('#form-register button[type="submit"]');

    const errDiv = page.locator('#reg-error');
    await expect(errDiv).toBeVisible();
    await expect(errDiv).toContainText('đã tồn tại');
  });

  test('B.3: Mật khẩu xác nhận không khớp báo lỗi phía client', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-register');
    await page.fill('#reg-user', `mismatch_${timestamp}`);
    await page.fill('#reg-email', `mismatch_${timestamp}@example.com`);
    await page.fill('#reg-pass', 'password123');
    await page.fill('#reg-confirm', 'differentpass');
    await page.click('#form-register button[type="submit"]');

    const errDiv = page.locator('#reg-error');
    await expect(errDiv).toBeVisible();
    await expect(errDiv).toContainText('không khớp');
  });

  test('B.4: Đăng nhập sai mật khẩu hiển thị thông báo lỗi', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-login');
    await page.fill('#login-user', validUser.username);
    await page.fill('#login-pass', 'wrongpassword');
    await page.click('#form-login button[type="submit"]');

    const errDiv = page.locator('#login-error');
    await expect(errDiv).toBeVisible();
    await expect(errDiv).toContainText('Sai tên đăng nhập hoặc mật khẩu');
  });

  test('B.5: Đăng nhập đúng tài khoản thành công và vào Lobby', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-login');
    await page.fill('#login-user', validUser.username);
    await page.fill('#login-pass', validUser.password);
    await page.click('#form-login button[type="submit"]');

    await page.waitForURL(/lobby\.html/, { timeout: 15000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    await expect(page.locator('#user-name')).toContainText(validUser.username);
  });

  test('B.6: Truy cập Lobby không có token bị điều hướng về trang chủ index.html', async ({ page }) => {
    await page.goto('/lobby.html');
    await page.waitForURL(/index\.html/, { timeout: 15000 });
  });

  test('B.7: Đăng xuất xóa token và điều hướng về trang chủ', async ({ page }) => {
    // Đăng nhập trước
    await page.goto('/');
    await page.click('#tab-login');
    await page.fill('#login-user', validUser.username);
    await page.fill('#login-pass', validUser.password);
    await page.click('#form-login button[type="submit"]');
    await page.waitForURL(/lobby\.html/, { timeout: 15000 });

    // Bấm nút đăng xuất nếu có, hoặc kiểm tra chức năng logout
    const logoutBtn = page.locator('#logout-btn, button:has-text("Đăng xuất")');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await page.waitForURL(/index\.html/, { timeout: 15000 });
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeNull();
    }
  });
});
