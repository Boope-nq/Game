/**
 * MultiPlayerOrchestrator.js — Bộ điều khiển 4 trình duyệt thực độc lập
 * Quản lý 4 BrowserContext riêng biệt, tự động đăng ký/đăng nhập, tạo phòng, vào phòng,
 * và cung cấp các helper tiện ích như `waitForMyTurn()`, `getVisibleState()`, `clickAction()`.
 */

export class PlayerSession {
  constructor(index, name, context, page) {
    this.index = index;
    this.name = name;
    this.context = context;
    this.page = page;
  }

  async goto(path = '/') {
    await this.page.goto(path);
  }

  async register(username, email, password) {
    await this.goto('/');
    await this.page.click('#tab-register');
    await this.page.fill('#reg-user', username);
    await this.page.fill('#reg-email', email);
    await this.page.fill('#reg-pass', password);
    await this.page.fill('#reg-confirm', password);
    await this.page.click('#form-register button[type="submit"]');
    await this.page.waitForURL(/lobby\.html/, { timeout: 15000 });
  }

  async login(username, password) {
    await this.goto('/');
    await this.page.click('#tab-login');
    await this.page.fill('#login-user', username);
    await this.page.fill('#login-pass', password);
    await this.page.click('#form-login button[type="submit"]');
    await this.page.waitForURL(/lobby\.html/, { timeout: 15000 });
  }

  async createRoom(roomName, maxPlayers = 4, scenario = 'cities_knights') {
    // Mở modal tạo phòng
    await this.page.click('#create-room-btn');
    await this.page.waitForSelector('#create-modal:not(.hidden)');
    await this.page.fill('#room-name-input', roomName);
    await this.page.selectOption('#room-max-players', String(maxPlayers));
    if (scenario) {
      await this.page.selectOption('#room-scenario', scenario);
    }
    await this.page.click('#create-room-form button[type="submit"]');
    // Chờ điều hướng vào game.html và hiển thị waiting-modal
    await this.page.waitForURL(/game\.html\?room=/, { timeout: 20000 });
    await this.page.waitForSelector('#waiting-modal:not(.hidden)', { timeout: 20000 });
  }

  async getRoomCode() {
    const codeEl = await this.page.waitForSelector('#waiting-room-code');
    return (await codeEl.textContent()).trim();
  }

  async joinRoomByCode(code) {
    await this.page.click('#join-code-btn');
    await this.page.waitForSelector('#join-code-modal:not(.hidden)');
    await this.page.fill('#join-code-input', code);
    await this.page.click('#join-code-form button[type="submit"]');
    // Chờ điều hướng vào game.html và hiển thị waiting-modal
    await this.page.waitForURL(/game\.html\?room=/, { timeout: 20000 });
    await this.page.waitForSelector('#waiting-modal:not(.hidden)', { timeout: 20000 });
  }

  async setReady(ready = true) {
    // Trong game.html, khách chờ chủ phòng bắt đầu
    await this.page.waitForTimeout(500);
  }

  async startGame() {
    const startBtn = await this.page.waitForSelector('#btn-start-game');
    await startBtn.click();
    await this.page.waitForSelector('#waiting-modal', { state: 'hidden', timeout: 25000 });
  }

  async waitForGameLoaded() {
    await this.page.waitForURL(/game\.html/, { timeout: 20000 });
    await this.page.waitForSelector('#waiting-modal', { state: 'hidden', timeout: 25000 });
    await this.page.waitForSelector('#hud', { state: 'visible', timeout: 25000 });
  }

  async waitForMyTurn(timeout = 30000) {
    await this.page.waitForFunction((myIndex) => {
      return window.gameState && window.gameState.currentPlayerIndex === myIndex;
    }, this.index, { timeout });
  }

  async waitForPhase(expectedPhase, timeout = 30000) {
    await this.page.waitForFunction((phase) => {
      return window.gameState && window.gameState.phase === phase;
    }, expectedPhase, { timeout });
  }

  async getVisibleState() {
    return await this.page.evaluate(() => {
      if (!window.gameState) return null;
      return {
        phase: window.gameState.phase,
        currentPlayerIndex: window.gameState.currentPlayerIndex,
        turn: window.gameState.turn,
        ruleset: window.gameState.ruleset,
        barbarianPosition: window.gameState.barbarianPosition,
        robberOnBoard: window.gameState.robberOnBoard,
        myVP: window.gameState.currentPlayer?.victoryPoints,
        myResources: { ...window.gameState.currentPlayer?.resources },
        myCommodities: { ...window.gameState.currentPlayer?.commodities },
        myKnightsCount: window.gameState.currentPlayer?.knights?.length,
        myWallsCount: window.gameState.currentPlayer?.cityWalls?.length,
      };
    });
  }

  async rollDice() {
    await this.page.click('#btn-roll', { force: true });
    await this.page.waitForTimeout(1000);
  }

  async endTurn() {
    await this.page.click('#btn-end-turn', { force: true });
    await this.page.waitForTimeout(1000);
  }

  async executeSetupPlacement() {
    return await this.page.evaluate(() => {
      const gs = window.gameState;
      if (!gs) return { ok: false, reason: 'No gameState' };
      const myIdx = window.myPlayerIndex;
      if (gs.currentPlayerIndex !== myIdx) return { ok: false, reason: 'Not my turn' };

      if (gs.phase === 'SETUP_SETTLEMENT') {
        const valid = gs.getValidSetupVertices ? gs.getValidSetupVertices() : [];
        if (!valid.length) return { ok: false, reason: 'No valid vertices' };
        const vKey = valid[0];
        window.performAction({ type: 'setup_settlement', vKey });
        return { ok: true, action: 'settlement', vKey };
      }

      if (gs.phase === 'SETUP_ROAD') {
        const roadEdges = gs.getValidRoadEdges ? gs.getValidRoadEdges(true, gs.setupSettlementVertex) : [];
        const shipEdges = gs.getValidShipEdges ? gs.getValidShipEdges(true, gs.setupSettlementVertex) : [];
        if (roadEdges.length > 0) {
          window.performAction({ type: 'setup_road', eKey: roadEdges[0], roadType: 'road' });
          return { ok: true, action: 'road', eKey: roadEdges[0] };
        } else if (shipEdges.length > 0) {
          window.performAction({ type: 'setup_road', eKey: shipEdges[0], roadType: 'ship' });
          return { ok: true, action: 'ship', eKey: shipEdges[0] };
        }
        return { ok: false, reason: 'No valid edges' };
      }

      return { ok: false, reason: `Unknown phase ${gs.phase}` };
    });
  }
}

export class MultiPlayerOrchestrator {
  constructor(browser) {
    this.browser = browser;
    this.players = [];
  }

  async init(playerCount = 4, contextOptions = null) {
    const names = ['Host_Alpha', 'Player_Beta', 'Player_Gamma', 'Player_Delta'];
    for (let i = 0; i < playerCount; i++) {
      const opts = contextOptions || {
        viewport: { width: 1280, height: 720 },
        storageState: undefined,
      };
      const context = await this.browser.newContext(opts);
      const page = await context.newPage();
      this.players.push(new PlayerSession(i, names[i], context, page));
    }
    return this.players;
  }

  async registerAndLoginAll(prefix = 'c') {
    const ts = Date.now().toString().slice(-6);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const uname = `${prefix}${i}_${ts}`;
      const email = `${uname}@test.com`;
      await p.register(uname, email, 'password123');
    }
  }

  async cleanup() {
    for (const p of this.players) {
      await p.context.close().catch(() => {});
    }
    this.players = [];
  }
}

