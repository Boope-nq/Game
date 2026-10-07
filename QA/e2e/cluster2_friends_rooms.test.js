import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = path.resolve('QA/artifacts');

test.describe('CỤM 2.2: BẠN BÈ & PHÒNG CHƠI (FRIENDS & ROOMS)', () => {
  let contextA, pageA;
  let contextB, pageB;
  let contextC, pageC;

  const helperRegister = async (page, username, password) => {
    await page.goto('http://localhost:3000/');
    await page.click('#tab-register');
    await page.fill('#reg-user', username);
    await page.fill('#reg-email', `${username}@test.com`);
    await page.fill('#reg-pass', password);
    await page.fill('#reg-confirm', password);
    await page.click('#form-register button[type="submit"]');
    await page.waitForURL(/lobby\.html/);
    await expect(page.locator('#user-name')).toContainText(username);
  };

  test('ROOM-01: Kết bạn, chấp nhận kết bạn và xóa bạn bè', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const userA = `pA_room_${ts}`;
    const userB = `pB_room_${ts}`;

    contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageA = await contextA.newPage();
    contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageB = await contextB.newPage();

    // 1. Đăng ký Player A & Player B
    await helperRegister(pageA, userA, 'pass123456');
    await helperRegister(pageB, userB, 'pass123456');

    // 2. Player A tìm kiếm Player B
    await pageA.fill('#search-input', userB);
    await pageA.click('#search-btn');
    await expect(pageA.locator('#search-results')).toBeVisible();
    await expect(pageA.locator('#search-results')).toContainText(userB);

    // Player A bấm + Kết bạn
    let alertMsgA = '';
    pageA.once('dialog', async d => {
      alertMsgA = d.message();
      await d.accept();
    });
    await pageA.click('#search-results button:has-text("+ Kết bạn")');
    await pageA.waitForTimeout(500);
    expect(alertMsgA).toContain('lời mời kết bạn');
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-01-PlayerA-SentRequest.png') });

    // 3. Player B nhận lời mời kết bạn và bấm Đồng ý
    // Chờ lời mời xuất hiện ở Player B
    const requestItem = pageB.locator('#requests-list .friend-item', { hasText: userA });
    await expect(requestItem).toBeVisible({ timeout: 5000 });
    await pageB.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-01-PlayerB-RequestReceived.png') });

    await requestItem.locator('button:has-text("Đồng ý")').click();
    await pageB.waitForTimeout(500);

    // 4. Kiểm tra danh sách bạn bè cả 2 bên
    await expect(pageB.locator('#friends-list')).toContainText(userA);
    await pageB.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-01-PlayerB-FriendList.png') });

    // Player A reload/wait để thấy Player B trong friends-list
    await expect(pageA.locator('#friends-list')).toContainText(userB);
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-01-PlayerA-FriendList.png') });

    // 5. Player A xóa bạn với Player B
    pageA.once('dialog', async d => {
      await d.accept(); // confirm xóa bạn
    });
    const removeBtn = pageA.locator(`#friends-list .friend-item:has-text("${userB}") .btn-remove-friend`);
    await removeBtn.click();
    await pageA.waitForTimeout(600);

    // Kiểm tra Player B đã không còn trong danh sách bạn của A
    await expect(pageA.locator('#friends-list')).not.toContainText(userB);
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-01-PlayerA-AfterUnfriend.png') });

    await contextA.close();
    await contextB.close();
  });

  test('ROOM-02: Từ chối lời mời kết bạn', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const userA = `pA_rej_${ts}`;
    const userC = `pC_rej_${ts}`;

    contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageA = await contextA.newPage();
    contextC = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageC = await contextC.newPage();

    await helperRegister(pageA, userA, 'pass123456');
    await helperRegister(pageC, userC, 'pass123456');

    // Player A tìm và gửi lời mời đến Player C
    await pageA.fill('#search-input', userC);
    await pageA.click('#search-btn');
    pageA.once('dialog', async d => await d.accept());
    await pageA.click('#search-results button:has-text("+ Kết bạn")');

    // Player C thấy lời mời và bấm Từ chối
    const requestItem = pageC.locator('#requests-list .friend-item', { hasText: userA });
    await expect(requestItem).toBeVisible({ timeout: 5000 });
    await pageC.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-02-PlayerC-BeforeReject.png') });

    await requestItem.locator('button:has-text("Từ chối")').click();
    await pageC.waitForTimeout(500);

    // Lời mời biến mất và không có trong danh sách bạn bè
    await expect(pageC.locator('#requests-list')).not.toContainText(userA);
    await expect(pageC.locator('#friends-list')).not.toContainText(userA);
    await pageC.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-02-PlayerC-AfterReject.png') });

    await contextA.close();
    await contextC.close();
  });

  test('ROOM-03: Tạo phòng hợp lệ & Thử vào bằng mã sai', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const userA = `pA_room03_${ts}`;
    const userB = `pB_room03_${ts}`;

    contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageA = await contextA.newPage();
    contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageB = await contextB.newPage();

    await helperRegister(pageA, userA, 'pass123456');
    await helperRegister(pageB, userB, 'pass123456');

    // Player A tạo phòng với kịch bản Thành phố & Hiệp sĩ
    await pageA.click('#create-room-btn');
    await expect(pageA.locator('#create-modal')).toBeVisible();
    await pageA.fill('#room-name-input', 'Phòng Thử Nghiệm CK');
    await pageA.selectOption('#room-scenario', 'cities_knights');
    await pageA.selectOption('#room-max-players', '4');
    await pageA.click('#create-room-form button[type="submit"]');

    // Chuyển sang game.html?room=CODE
    await pageA.waitForURL(/game\.html\?room=/);
    const roomUrl = pageA.url();
    const roomCode = new URL(roomUrl).searchParams.get('room');
    expect(roomCode).toMatch(/^[A-Z0-9]{4,6}$/);

    // Player A đang ở trong phòng chờ
    await expect(pageA.locator('#waiting-modal')).toBeVisible();
    await pageA.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-03-PlayerA-RoomCreated.png') });

    // Player B thử vào phòng bằng mã sai: "WRONG9"
    let alertMsgB = '';
    pageB.once('dialog', async d => {
      alertMsgB = d.message();
      await d.accept();
    });
    await pageB.click('#join-code-btn');
    await expect(pageB.locator('#join-code-modal')).toBeVisible();
    await pageB.fill('#join-code-input', 'WRONG9');
    await pageB.click('#join-code-form button[type="submit"]');
    await pageB.waitForTimeout(500);

    expect(alertMsgB).toContain('Không tìm thấy phòng');
    await pageB.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-03-PlayerB-InvalidCodeError.png') });

    await contextA.close();
    await contextB.close();
  });

  test('ROOM-04: Phòng đã đủ người (người tiếp theo bị từ chối)', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const userA = `pA_room04_${ts}`;
    const userB = `pB_room04_${ts}`;
    const userC = `pC_room04_${ts}`;

    contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageA = await contextA.newPage();
    contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageB = await contextB.newPage();
    contextC = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageC = await contextC.newPage();

    await helperRegister(pageA, userA, 'pass123456');
    await helperRegister(pageB, userB, 'pass123456');
    await helperRegister(pageC, userC, 'pass123456');

    // Player A tạo phòng max 2 người
    await pageA.click('#create-room-btn');
    await pageA.fill('#room-name-input', 'Phòng 2 Người Max');
    await pageA.selectOption('#room-max-players', '2');
    await pageA.click('#create-room-form button[type="submit"]');
    await pageA.waitForURL(/game\.html\?room=/);
    const roomCode = new URL(pageA.url()).searchParams.get('room');

    // Player B vào phòng (2/2 người)
    await pageB.click('#join-code-btn');
    await pageB.fill('#join-code-input', roomCode);
    await pageB.click('#join-code-form button[type="submit"]');
    await pageB.waitForURL(/game\.html\?room=/);
    await expect(pageB.locator('#waiting-modal')).toBeVisible();

    // Player C thử vào phòng đã đủ 2 người
    let alertMsgC = '';
    pageC.once('dialog', async d => {
      alertMsgC = d.message();
      await d.accept();
    });
    await pageC.click('#join-code-btn');
    await pageC.fill('#join-code-input', roomCode);
    await pageC.click('#join-code-form button[type="submit"]');
    await pageC.waitForTimeout(500);

    expect(alertMsgC).toContain('Phòng đã đủ người chơi');
    await pageC.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-04-PlayerC-RoomFullRejected.png') });

    await contextA.close();
    await contextB.close();
    await contextC.close();
  });

  test('ROOM-05: Trận đấu đang diễn ra chặn người ngoài tham gia', async ({ browser }) => {
    const ts = Date.now().toString().slice(-5);
    const userA = `pA_room05_${ts}`;
    const userB = `pB_room05_${ts}`;
    const userOutside = `pOut_room05_${ts}`;

    contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageA = await contextA.newPage();
    contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    pageB = await contextB.newPage();
    const contextOut = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pageOut = await contextOut.newPage();

    await helperRegister(pageA, userA, 'pass123456');
    await helperRegister(pageB, userB, 'pass123456');
    await helperRegister(pageOut, userOutside, 'pass123456');

    // Player A tạo phòng 2 người
    await pageA.click('#create-room-btn');
    await pageA.fill('#room-name-input', 'Phòng Bắt Đầu');
    await pageA.selectOption('#room-max-players', '2');
    await pageA.click('#create-room-form button[type="submit"]');
    await pageA.waitForURL(/game\.html\?room=/);
    const roomCode = new URL(pageA.url()).searchParams.get('room');

    // Player B vào phòng
    await pageB.click('#join-code-btn');
    await pageB.fill('#join-code-input', roomCode);
    await pageB.click('#join-code-form button[type="submit"]');
    await pageB.waitForURL(/game\.html\?room=/);
    await expect(pageB.locator('#waiting-modal')).toBeVisible();

    // Chờ Player A thấy 2 người trong danh sách chờ
    await pageA.waitForFunction(() => {
      const list = document.getElementById('waiting-player-list');
      return list && list.children.length >= 2;
    }, { timeout: 10000 });

    // Host Player A bấm Bắt đầu
    await pageA.click('#btn-start-game');

    // Cả 2 vào game canvas và ẩn waiting modal
    await expect(pageA.locator('#game-canvas')).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    // Người ngoài (pageOut) thử join phòng đang chơi
    let alertMsgOut = '';
    pageOut.once('dialog', async d => {
      alertMsgOut = d.message();
      await d.accept();
    });
    await pageOut.click('#join-code-btn');
    await pageOut.fill('#join-code-input', roomCode);
    await pageOut.click('#join-code-form button[type="submit"]');
    await pageOut.waitForTimeout(600);

    expect(alertMsgOut).toContain('Trận đấu đang diễn ra');
    await pageOut.screenshot({ path: path.join(ARTIFACTS_DIR, 'ROOM-05-PlayerOut-GameInProgressBlocked.png') });

    await contextA.close();
    await contextB.close();
    await contextOut.close();
  });
});
