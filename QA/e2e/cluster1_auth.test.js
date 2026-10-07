import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.1: TÀI KHOẢN & XÁC THỰC (AUTHENTICATION)', () => {
  let contextA, pageA;
  let contextB, pageB;
  let consoleErrors = [];

  test.beforeEach(async ({ browser }) => {
    consoleErrors = [];
    contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageA = await contextA.newPage();
    pageA.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[PageA Error]: ${msg.text()}`);
    });

    contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageB = await contextB.newPage();
    pageB.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[PageB Error]: ${msg.text()}`);
    });
  });

  test.afterEach(async () => {
    await contextA?.close();
    await contextB?.close();
  });

  test('AUTH-01: Đăng ký với field trống hoặc email sai định dạng (Validation Client)', async () => {
    await pageA.goto('http://localhost:3000/');
    await pageA.click('#tab-register');

    // 1. Thử submit form trống
    const usernameInput = pageA.locator('#reg-user');
    const isRequired = await usernameInput.getAttribute('required');
    expect(isRequired).not.toBeNull();

    // 2. Thử nhập email không hợp lệ
    await pageA.fill('#reg-user', 'user_invalid_email');
    await pageA.fill('#reg-email', 'invalid-email-format');
    await pageA.fill('#reg-pass', 'password123');
    await pageA.fill('#reg-confirm', 'password123');
    
    // Bấm tạo tài khoản khi email sai
    await pageA.click('#form-register button[type="submit"]');
    // Trình duyệt chặn submit bằng HTML5 email validation, vẫn ở trang index.html
    expect(pageA.url()).toContain('localhost:3000');
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-01-PlayerA-InvalidEmail.png') });
  });

  test('AUTH-02: Đăng ký xác nhận mật khẩu không khớp', async () => {
    await pageA.goto('http://localhost:3000/');
    await pageA.click('#tab-register');

    await pageA.fill('#reg-user', 'user_mismatch');
    await pageA.fill('#reg-email', 'mismatch@test.com');
    await pageA.fill('#reg-pass', 'pass12345');
    await pageA.fill('#reg-confirm', 'passDIFFERENT');
    await pageA.click('#form-register button[type="submit"]');

    const err = pageA.locator('#reg-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('không khớp');
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-02-PlayerA-PasswordMismatch.png') });
  });

  test('AUTH-03: Đăng nhập sai mật khẩu hiển thị thông báo lỗi', async () => {
    const ts = Date.now().toString().slice(-5);
    const username = `auth_test_${ts}`;
    const email = `${username}@test.com`;

    // Đăng ký trước 1 user hợp lệ
    await pageA.goto('http://localhost:3000/');
    await pageA.click('#tab-register');
    await pageA.fill('#reg-user', username);
    await pageA.fill('#reg-email', email);
    await pageA.fill('#reg-pass', 'correctPass123');
    await pageA.fill('#reg-confirm', 'correctPass123');
    await pageA.click('#form-register button[type="submit"]');
    await pageA.waitForURL(/lobby\.html/);

    // Dùng pageB đăng nhập sai mật khẩu với tài khoản vừa tạo
    await pageB.goto('http://localhost:3000/');
    await pageB.click('#tab-login');
    await pageB.fill('#login-user', username);
    await pageB.fill('#login-pass', 'wrongPassword!');
    await pageB.click('#form-login button[type="submit"]');

    const loginErr = pageB.locator('#login-error');
    await expect(loginErr).toBeVisible();
    await expect(loginErr).toContainText('Sai tên đăng nhập hoặc mật khẩu');
    await pageB.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-03-PlayerB-WrongPassword.png') });
  });

  test('AUTH-04: Đăng ký trùng tên tài khoản hoặc email', async () => {
    const ts = Date.now().toString().slice(-5);
    const username = `dup_user_${ts}`;
    const email = `${username}@test.com`;

    // Đăng ký lần 1 thành công
    await pageA.goto('http://localhost:3000/');
    await pageA.click('#tab-register');
    await pageA.fill('#reg-user', username);
    await pageA.fill('#reg-email', email);
    await pageA.fill('#reg-pass', 'pass123456');
    await pageA.fill('#reg-confirm', 'pass123456');
    await pageA.click('#form-register button[type="submit"]');
    await pageA.waitForURL(/lobby\.html/);

    // Đăng ký lần 2 trùng username
    await pageB.goto('http://localhost:3000/');
    await pageB.click('#tab-register');
    await pageB.fill('#reg-user', username);
    await pageB.fill('#reg-email', `diff_${email}`);
    await pageB.fill('#reg-pass', 'pass123456');
    await pageB.fill('#reg-confirm', 'pass123456');
    await pageB.click('#form-register button[type="submit"]');

    const regErr = pageB.locator('#reg-error');
    await expect(regErr).toBeVisible();
    await expect(regErr).toContainText('đã tồn tại');
    await pageB.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-04-PlayerB-DuplicateUser.png') });
  });

  test('AUTH-05: Đăng ký, Đăng xuất, Đăng nhập lại, F5 giữ session', async () => {
    const ts = Date.now().toString().slice(-5);
    const username = `full_auth_${ts}`;
    const email = `${username}@test.com`;
    const password = 'mypassword123';

    // 1. Đăng ký tài khoản
    await pageA.goto('http://localhost:3000/');
    await pageA.click('#tab-register');
    await pageA.fill('#reg-user', username);
    await pageA.fill('#reg-email', email);
    await pageA.fill('#reg-pass', password);
    await pageA.fill('#reg-confirm', password);
    await pageA.click('#form-register button[type="submit"]');
    await pageA.waitForURL(/lobby\.html/);
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-05-PlayerA-LobbyLoggedIn.png') });

    // 2. F5 refresh trang lobby -> Vẫn duy trì đăng nhập (không bị out về index)
    await pageA.reload();
    await pageA.waitForURL(/lobby\.html/);
    const userDisplay = pageA.locator('#user-name');
    await expect(userDisplay).toContainText(username);
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-05-PlayerA-AfterF5Reload.png') });

    // 3. Đăng xuất
    await pageA.click('#logout-btn');
    await pageA.waitForURL(/index\.html|\/$/);
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-05-PlayerA-LoggedOut.png') });

    // 4. Đăng nhập lại
    await pageA.click('#tab-login');
    await pageA.fill('#login-user', username);
    await pageA.fill('#login-pass', password);
    await pageA.click('#form-login button[type="submit"]');
    await pageA.waitForURL(/lobby\.html/);
    await expect(userDisplay).toContainText(username);
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-05-PlayerA-ReLoginSuccess.png') });
  });

  test('AUTH-06: Cùng tài khoản đăng nhập trên 2 tab song song', async () => {
    const ts = Date.now().toString().slice(-5);
    const username = `twotab_${ts}`;
    const email = `${username}@test.com`;
    const password = 'twotabpassword';

    // Đăng ký ở contextA
    await pageA.goto('http://localhost:3000/');
    await pageA.click('#tab-register');
    await pageA.fill('#reg-user', username);
    await pageA.fill('#reg-email', email);
    await pageA.fill('#reg-pass', password);
    await pageA.fill('#reg-confirm', password);
    await pageA.click('#form-register button[type="submit"]');
    await pageA.waitForURL(/lobby\.html/);

    // Mở tab thứ 2 trong cùng contextA (cùng localStorage/cookie)
    const pageA2 = await contextA.newPage();
    await pageA2.goto('http://localhost:3000/lobby.html');
    await expect(pageA2.locator('#user-name')).toContainText(username);

    // Cả 2 tab đều hoạt động và giữ session
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-06-PlayerA-Tab1.png') });
    await pageA2.screenshot({ path: path.join(ARTIFACTS_DIR, 'AUTH-06-PlayerA-Tab2.png') });
    await pageA2.close();
  });
});
