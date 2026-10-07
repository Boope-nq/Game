/**
 * HUD.js — Giao diện người dùng Mobile-First chuẩn Thumb Zone & Responsive
 * Hỗ trợ Bottom Sheet Xây dựng, Drawer Bảng điểm & Nhật ký, Form 16px chống iOS auto-zoom
 */

import { ResourceType, ALL_RESOURCES } from '../entities/Player.js';
import { Phase, BUILD_COST }           from '../gameplay/GameState.js';
import { CKRulesPanel }               from './CKRulesPanel.js';

export const MONO_ICONS = {
  BRICK: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-9 2v3H5V6h5zm2 0h7v3h-7V6zm7 5v3h-7v-3h7zm-9 0v3H5v-3h5zm-5 5h7v3H5v-3zm9 3v-3h7v3h-7z"/></svg>`,
  LUMBER: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L4 14h3v6h4v-4h2v4h4v-6h3L12 2z"/></svg>`,
  GRAIN: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6 3c0 5 3 9 6 11-3-2-6-6-6-11zm12 0c0 5-3 9-6 11 3-2 6-6 6-11zm-5 13v6h-2v-6c-2-1.5-4-4-5-8 3 1 6 3 7 8zm0 0c1-5 4-7 7-8-1 4-3 6.5-5 8z"/></svg>`,
  WOOL: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`,
  ORE: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M21.71 6.29l-4-4a1 1 0 0 0-1.42 0l-3.3 3.3 5.42 5.42 3.3-3.3a1 1 0 0 0 0-1.42zm-9.7 5.7L4.59 19.41a1 1 0 0 0 0 1.42l-2.3 2.3 1.42 1.42 2.3-2.3a1 1 0 0 0 1.42 0l7.42-7.42-2.84-2.84z"/></svg>`,
  GOLD: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/></svg>`,
  DICE: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7 7.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm10 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-7.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM7 16.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm5-4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
  COMPASS: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
  PLAYERS: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  LOG: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
  BUILD: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>`,
  SHIP: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.33-.42-.6-.47L4.47 11.23c-.27-.05-.55.02-.76.19s-.32.43-.3.71L3.95 19zM6 6h11.26L12 2.5 6 6z"/></svg>`,
  CARD: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-8c-.83 0-1.5-.67-1.5-1.5S11.17 6 12 6s1.5.67 1.5 1.5S12.83 9 12 9z"/></svg>`,
  TRADE: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a3 3 0 0 0-3 3c0 1.31.84 2.41 2 2.83V11H7a5 5 0 0 0-5 5v1h2v-1a3 3 0 0 1 3-3h4v6.17c-1.16.42-2 1.52-2 2.83a3 3 0 0 0 6 0c0-1.31-.84-2.41-2-2.83V13h4a3 3 0 0 1 3 3v1h2v-1a5 5 0 0 0-5-5h-4V7.83c1.16-.42 2-1.52 2-2.83a3 3 0 0 0-3-3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>`,
  END_TURN: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`,
  SETTLEMENT: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
  CITY: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 7H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V8h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V8h2v2zm0-4h-2V4h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>`,
  ROAD: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M18.11 3h-2.22l-1.8 18h2.22l1.8-18zm-10 0H5.89l1.8 18h2.22L8.11 3zm3.39 12h1v3h-1v-3zm0-6h1v3h-1V9zm0-6h1v3h-1V3z"/></svg>`,
  TROPHY: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1c1.94-.36 3.48-1.78 3.91-3.66C19.18 11.83 21 9.85 21 7.33V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>`,
  ROBBER: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H9V7zm3 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>`,
  KNIGHT: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6.92 5h10.16L12 1.45 6.92 5zM21 9l-4-4H7L3 9l9 13 9-13z"/></svg>`,
  BANK: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm9.5-21L2 6v2h19V6l-9.5-5z"/></svg>`,
  STEAL: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>`,
  DISCARD: `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
};

const RES_EMOJI = {
  BRICK: MONO_ICONS.BRICK,
  LUMBER: MONO_ICONS.LUMBER,
  GRAIN: MONO_ICONS.GRAIN,
  WOOL: MONO_ICONS.WOOL,
  ORE: MONO_ICONS.ORE,
};

const RES_NAME = {
  BRICK: 'Gạch', LUMBER: 'Gỗ', GRAIN: 'Lúa', WOOL: 'Cừu', ORE: 'Quặng',
};

const PHASE_LABEL = {
  SETUP_SETTLEMENT: 'Đặt Định cư khởi đầu',
  SETUP_ROAD:       'Đặt Đường / Tàu khởi đầu',
  ROLL:             'Tung xúc xắc',
  ROBBER:           'Chọn ô đất (Robber) / biển (Pirate)',
  STEAL:            'Cướp tài nguyên',
  DISCARD:          'Bỏ nửa bài (Đổ số 7)',
  GOLD_PICK:        'Nhận thưởng Ô Vàng',
  BUILD:            'Lượt hành động chính',
  GAME_OVER:        'Kết thúc trò chơi!',
};

export class HUD {
  constructor(container, gameState, callbacks = {}) {
    this.container = container;
    this.gs        = gameState;
    this.cb        = callbacks;
    this._build();
    this.update();
  }

  _build() {
    this.container.innerHTML = `
      <!-- TOP BAR (Safe Area Compliant) -->
      <header id="hud-top">
        <div id="hud-turn-info">
          <div class="player-indicator">
            <span id="hud-player-dot" class="pdot"></span>
            <span id="hud-player-name">--</span>
          </div>
          <span id="hud-phase">--</span>
        </div>

        <div id="hud-dice-area">
          <div id="dice-display">
            <span id="die1" class="die">?</span>
            <span id="die2" class="die">?</span>
            <span id="die-result"></span>
          </div>
          <button id="btn-roll" class="btn btn-primary btn-touch" aria-label="Tung xúc xắc">${MONO_ICONS.DICE} Tung</button>
        </div>

        <div id="hud-top-actions">
          <button id="btn-toggle-rules" class="btn btn-touch" style="font-size:0.82rem; font-weight:bold; background:#0284c7; color:#fff; border-radius:6px; padding:4px 10px; margin-right:4px;" title="Tra cứu luật chơi C&K">📜 Luật chơi</button>
          <button id="btn-nav-center" class="btn btn-icon btn-touch" title="Căn giữa bản đồ">${MONO_ICONS.COMPASS}</button>
          <button id="btn-toggle-players" class="btn btn-icon btn-touch" title="Bảng điểm">
            ${MONO_ICONS.PLAYERS} <span id="hud-badge-vp" class="badge-pill">0</span>
          </button>
          <button id="btn-toggle-log" class="btn btn-icon btn-touch" title="Nhật ký trận đấu">${MONO_ICONS.LOG}</button>
        </div>
      </header>

      <!-- BOTTOM HUD CONTAINER (Thumb Zone) -->
      <footer id="hud-bottom-zone">
        <!-- COMPACT RESOURCE CHIPS -->
        <div id="hud-resources-bar">
          <div id="res-chips-list"></div>
          <div id="stock-chips-badge" title="Kho công trình & thẻ"></div>
        </div>

        <!-- ACTION BUTTONS -->
        <div id="hud-actions-bar">
          <button class="btn btn-action-build btn-touch" id="btn-open-build">
            <span class="btn-icon-sub">${MONO_ICONS.BUILD}</span>
            <span class="btn-lbl">Xây dựng</span>
          </button>

          <button class="btn btn-touch btn-secondary" id="btn-move-ship">
            <span class="btn-icon-sub">${MONO_ICONS.SHIP}</span>
            <span class="btn-lbl">Dời Tàu</span>
          </button>

          <button class="btn btn-touch btn-secondary" id="btn-play-dev">
            <span class="btn-icon-sub">${MONO_ICONS.CARD}</span>
            <span class="btn-lbl">Dùng Thẻ</span>
          </button>

          <button class="btn btn-touch btn-trade-btn" id="btn-open-trade">
            <span class="btn-icon-sub">${MONO_ICONS.TRADE}</span>
            <span class="btn-lbl">Đổi Bài</span>
          </button>

          <button class="btn btn-touch btn-end" id="btn-end-turn">
            <span class="btn-icon-sub">${MONO_ICONS.END_TURN}</span>
            <span class="btn-lbl">Hết Lượt</span>
          </button>
        </div>
      </footer>

      <!-- BUILD BOTTOM SHEET MODAL -->
      <div id="build-sheet" class="mobile-sheet hidden">
        <div class="sheet-backdrop" id="build-sheet-backdrop"></div>
        <div class="sheet-panel">
          <div class="sheet-header">
            <h3>${MONO_ICONS.BUILD} Chọn công trình xây dựng</h3>
            <button class="btn-close-sheet" id="btn-close-build">✕</button>
          </div>
          <div class="sheet-grid">
            <button class="btn btn-build btn-touch" id="btn-settlement" data-type="settlement">
              <span class="build-icon">${MONO_ICONS.SETTLEMENT}</span>
              <span class="build-title">Định cư</span>
              <span class="build-cost">${MONO_ICONS.BRICK}${MONO_ICONS.LUMBER}${MONO_ICONS.GRAIN}${MONO_ICONS.WOOL}</span>
              <span class="build-stock" id="stock-settlement-cnt"></span>
            </button>
            <button class="btn btn-build btn-touch" id="btn-city" data-type="city">
              <span class="build-icon">${MONO_ICONS.CITY}</span>
              <span class="build-title">Thành phố</span>
              <span class="build-cost">${MONO_ICONS.GRAIN}${MONO_ICONS.GRAIN}${MONO_ICONS.ORE}${MONO_ICONS.ORE}${MONO_ICONS.ORE}</span>
              <span class="build-stock" id="stock-city-cnt"></span>
            </button>
            <button class="btn btn-build btn-touch" id="btn-road" data-type="road">
              <span class="build-icon">${MONO_ICONS.ROAD}</span>
              <span class="build-title">Đường bộ</span>
              <span class="build-cost">${MONO_ICONS.BRICK}${MONO_ICONS.LUMBER}</span>
              <span class="build-stock" id="stock-road-cnt"></span>
            </button>
            <button class="btn btn-build btn-touch" id="btn-ship" data-type="ship">
              <span class="build-icon">${MONO_ICONS.SHIP}</span>
              <span class="build-title">Tàu viễn dương</span>
              <span class="build-cost">${MONO_ICONS.LUMBER}${MONO_ICONS.WOOL}</span>
              <span class="build-stock" id="stock-ship-cnt"></span>
            </button>
            <button class="btn btn-build btn-touch" id="btn-dev" data-type="devCard">
              <span class="build-icon">${MONO_ICONS.CARD}</span>
              <span class="build-title">Thẻ Phát Triển</span>
              <span class="build-cost">${MONO_ICONS.GRAIN}${MONO_ICONS.WOOL}${MONO_ICONS.ORE}</span>
              <span class="build-stock" id="stock-dev-cnt"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- PLAYERS DRAWER MODAL -->
      <div id="players-drawer" class="mobile-sheet hidden">
        <div class="sheet-backdrop" id="players-drawer-backdrop"></div>
        <div class="sheet-panel">
          <div class="sheet-header">
            <h3>${MONO_ICONS.PLAYERS} Bảng điểm người chơi</h3>
            <button class="btn-close-sheet" id="btn-close-players">✕</button>
          </div>
          <div id="hud-players-list" class="drawer-content"></div>
        </div>
      </div>

      <!-- EVENT LOG DRAWER MODAL -->
      <div id="log-drawer" class="mobile-sheet hidden">
        <div class="sheet-backdrop" id="log-drawer-backdrop"></div>
        <div class="sheet-panel">
          <div class="sheet-header">
            <h3>${MONO_ICONS.LOG} Nhật ký ván đấu</h3>
            <button class="btn-close-sheet" id="btn-close-log">✕</button>
          </div>
          <div id="hud-log-content" class="drawer-content log-content"></div>
        </div>
      </div>

      <!-- TRADE DIALOG -->
      <div id="trade-dialog" class="dialog hidden">
        <div class="dialog-box">
          <div class="dialog-header">
            <h3>${MONO_ICONS.BANK} Trao đổi Ngân hàng</h3>
            <button class="btn-close-sheet" id="btn-trade-x-header">✕</button>
          </div>
          <div class="trade-row">
            <div class="trade-col">
              <label>Đưa ra:</label>
              <select id="trade-give-res" class="mobile-select">
                ${ALL_RESOURCES.map(r => `<option value="${r}">${RES_NAME[r]}</option>`).join('')}
              </select>
              <div id="trade-rate-display">Tỷ lệ: <strong id="trade-rate">4</strong>:1</div>
            </div>
            <div class="trade-arrow">➔</div>
            <div class="trade-col">
              <label>Nhận về:</label>
              <select id="trade-recv-res" class="mobile-select">
                ${ALL_RESOURCES.map(r => `<option value="${r}">${RES_NAME[r]}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="dialog-btns">
            <button id="btn-trade-ok" class="btn btn-primary btn-touch">Xác nhận</button>
            <button id="btn-trade-x"  class="btn btn-touch">Đóng</button>
          </div>
        </div>
      </div>

      <!-- DEV CARD DIALOG -->
      <div id="dev-dialog" class="dialog hidden">
        <div class="dialog-box">
          <div class="dialog-header">
            <h3>${MONO_ICONS.CARD} Chơi Thẻ Phát Triển</h3>
            <button class="btn-close-sheet" id="btn-dev-x-header">✕</button>
          </div>
          <div id="dev-card-list"></div>
          <div id="monopoly-row" class="hidden form-group">
            <label>Chọn loại tài nguyên cần gom:</label>
            <select id="monopoly-res" class="mobile-select">
              ${ALL_RESOURCES.map(r => `<option value="${r}">${RES_NAME[r]}</option>`).join('')}
            </select>
          </div>
          <div id="yop-row" class="hidden form-group">
            <label>Chọn 2 tài nguyên:</label>
            <div id="yop-picks">
              ${ALL_RESOURCES.map(r => `
                <label class="yop-item">
                  <input type="number" min="0" max="2" value="0" data-res="${r}" class="yop-input mobile-input">
                  ${RES_EMOJI[r]} ${RES_NAME[r]}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="dialog-btns">
            <button id="btn-dev-play" class="btn btn-primary btn-touch">Kích hoạt thẻ</button>
            <button id="btn-dev-x" class="btn btn-touch">Đóng</button>
          </div>
        </div>
      </div>

      <!-- GOLD FIELD DIALOG -->
      <div id="gold-dialog" class="dialog hidden">
        <div class="dialog-box">
          <h3>${MONO_ICONS.GOLD} Ô Vàng — Chọn tài nguyên</h3>
          <p id="gold-amount-info"></p>
          <div id="gold-pick-list">
            ${ALL_RESOURCES.map(r => `
              <label class="yop-item">
                <input type="number" min="0" value="0" data-res="${r}" class="gold-input mobile-input">
                ${RES_EMOJI[r]} ${RES_NAME[r]}
              </label>
            `).join('')}
          </div>
          <button id="btn-gold-ok" class="btn btn-primary btn-touch">Xác nhận</button>
        </div>
      </div>

      <!-- DISCARD DIALOG -->
      <div id="discard-dialog" class="dialog hidden">
        <div class="dialog-box">
          <h3>${MONO_ICONS.DISCARD} Bỏ bài (Số 7)</h3>
          <p id="discard-info"></p>
          <div id="discard-list">
            ${ALL_RESOURCES.map(r => `
              <label class="yop-item">
                <input type="number" min="0" value="0" data-res="${r}" class="discard-input mobile-input">
                ${RES_EMOJI[r]} ${RES_NAME[r]}
                <span id="discard-have-${r}" class="discard-have-tag">(có: 0)</span>
              </label>
            `).join('')}
          </div>
          <div id="discard-total-info"></div>
          <button id="btn-discard-ok" class="btn btn-primary btn-touch">Xác nhận bỏ bài</button>
        </div>
      </div>

      <!-- STEAL DIALOG -->
      <div id="steal-dialog" class="dialog hidden">
        <div class="dialog-box">
          <h3>${MONO_ICONS.STEAL} Chọn đối thủ để cướp</h3>
          <div id="steal-targets"></div>
          <button id="btn-steal-skip" class="btn btn-touch">Bỏ qua</button>
        </div>
      </div>

      <!-- FLOATING BUILD HINT -->
      <div id="build-hint" class="hidden"></div>

      <!-- WIN SCREEN -->
      <div id="win-screen" class="dialog hidden">
        <div class="dialog-box win-box">
          <div class="win-trophy">${MONO_ICONS.TROPHY}</div>
          <h1 id="win-name"></h1>
          <p id="win-vp"></p>
          <div id="win-scoreboard"></div>
          <button id="btn-new-game" class="btn btn-primary btn-touch">${MONO_ICONS.TROPHY} Trận Mới</button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const gs = this.gs;

    // Roll Dice
    document.getElementById('btn-roll').onclick = () => {
      if (gs.phase !== Phase.ROLL) return;
      const r = gs.rollDice();
      if (r.ok) {
        this._animateDice(r.roll);
        setTimeout(() => {
          this.update();
          this._checkAutoDialogs();
        }, 750);
      }
    };

    // End turn
    document.getElementById('btn-end-turn').onclick = () => {
      const r = gs.endTurn();
      if (r.ok) {
        window._clearBuildMode?.();
        this.update();
      } else {
        window._showToast?.(r.reason ?? 'Chưa thể kết thúc lượt');
      }
    };

    // Rules Panel Toggle
    this.rulesPanel = new CKRulesPanel();
    const rulesBtn = document.getElementById('btn-toggle-rules');
    if (rulesBtn) {
      rulesBtn.onclick = () => this.rulesPanel.toggle();
    }

    // Navigation & Modals Toggle
    document.getElementById('btn-nav-center').onclick = () => {
      window._resetCamera?.();
      window._showToast?.('Đã căn giữa bản đồ');
    };

    const togglePlayers = (show) => {
      document.getElementById('players-drawer').classList.toggle('hidden', !show);
    };
    document.getElementById('btn-toggle-players').onclick = () => togglePlayers(true);
    document.getElementById('btn-close-players').onclick = () => togglePlayers(false);
    document.getElementById('players-drawer-backdrop').onclick = () => togglePlayers(false);

    const toggleLog = (show) => {
      document.getElementById('log-drawer').classList.toggle('hidden', !show);
    };
    document.getElementById('btn-toggle-log').onclick = () => toggleLog(true);
    document.getElementById('btn-close-log').onclick = () => toggleLog(false);
    document.getElementById('log-drawer-backdrop').onclick = () => toggleLog(false);

    // Build Sheet Toggle
    const toggleBuildSheet = (show) => {
      document.getElementById('build-sheet').classList.toggle('hidden', !show);
    };
    document.getElementById('btn-open-build').onclick = () => toggleBuildSheet(true);
    document.getElementById('btn-close-build').onclick = () => toggleBuildSheet(false);
    document.getElementById('build-sheet-backdrop').onclick = () => toggleBuildSheet(false);

    // Build buttons inside sheet
    document.querySelectorAll('.btn-build').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.type;
        toggleBuildSheet(false);
        if (type === 'devCard') {
          const r = gs.buyDevCard();
          r.ok ? this.update() : window._showToast?.(r.reason);
        } else {
          window._enterBuildMode?.(type);
          this.update();
        }
      };
    });

    // Move ship
    document.getElementById('btn-move-ship').onclick = () => {
      this.cb.onMoveShip?.();
    };

    // Trade Dialog
    const toggleTrade = (show) => {
      document.getElementById('trade-dialog').classList.toggle('hidden', !show);
      if (show) this._updateTradeRate();
    };
    document.getElementById('btn-open-trade').onclick = () => toggleTrade(true);
    document.getElementById('btn-trade-x').onclick = () => toggleTrade(false);
    document.getElementById('btn-trade-x-header').onclick = () => toggleTrade(false);
    document.getElementById('trade-give-res').onchange = () => this._updateTradeRate();
    document.getElementById('btn-trade-ok').onclick = () => {
      const give = document.getElementById('trade-give-res').value;
      const recv = document.getElementById('trade-recv-res').value;
      const rate = parseInt(document.getElementById('trade-rate').textContent);
      const r = gs.tradeWithBank(give, rate, recv);
      if (r.ok) {
        toggleTrade(false);
        this.update();
      } else {
        window._showToast?.(r.reason);
      }
    };

    // Dev card dialog
    document.getElementById('btn-play-dev').onclick = () => {
      this._openDevDialog();
    };
    document.getElementById('btn-dev-x').onclick = () => {
      document.getElementById('dev-dialog').classList.add('hidden');
    };
    document.getElementById('btn-dev-x-header').onclick = () => {
      document.getElementById('dev-dialog').classList.add('hidden');
    };
    document.getElementById('btn-dev-play').onclick = () => {
      this._submitDevCard();
    };

    // Gold dialog
    document.getElementById('btn-gold-ok').onclick = () => {
      const pending = gs.goldPending[0];
      if (!pending) return;
      const choices = {};
      document.querySelectorAll('.gold-input').forEach(inp => {
        const n = parseInt(inp.value) || 0;
        if (n > 0) choices[inp.dataset.res] = n;
      });
      const r = this.cb.onPickGold?.(pending.playerId, choices);
      if (r?.ok) {
        document.getElementById('gold-dialog').classList.add('hidden');
        this.update();
        this._checkAutoDialogs();
      } else {
        window._showToast?.(r?.reason ?? 'Chọn đúng số tài nguyên');
      }
    };

    // Discard dialog
    document.getElementById('btn-discard-ok').onclick = () => {
      const pending = gs.discardPending[0];
      if (pending === undefined) return;
      const toDiscard = {};
      document.querySelectorAll('.discard-input').forEach(inp => {
        const n = parseInt(inp.value) || 0;
        if (n > 0) toDiscard[inp.dataset.res] = n;
      });
      const r = this.cb.onDiscard?.(pending, toDiscard);
      if (r?.ok) {
        this.update();
        this._checkAutoDialogs();
      } else {
        window._showToast?.(r?.reason);
      }
    };

    // Steal dialog
    document.getElementById('btn-steal-skip').onclick = () => {
      document.getElementById('steal-dialog').classList.add('hidden');
      gs.phase = 'BUILD';
      this.update();
    };

    // New game
    document.getElementById('btn-new-game').onclick = () => {
      document.getElementById('win-screen').classList.add('hidden');
      this.cb.onNewGame?.();
    };
  }

  // ─── Update HUD ─────────────────────────────────────────────────────────────
  update() {
    const gs = this.gs;
    const cp = gs.currentPlayer;

    // Top Bar Info
    const dotEl  = document.getElementById('hud-player-dot');
    const nameEl = document.getElementById('hud-player-name');
    if (dotEl)  dotEl.style.backgroundColor = cp.color;
    if (nameEl) {
      nameEl.textContent = cp.name;
      nameEl.style.color = cp.color;
    }
    const phaseEl = document.getElementById('hud-phase');
    if (phaseEl) phaseEl.textContent = PHASE_LABEL[gs.phase] ?? gs.phase;

    // VP Badge in top bar
    const vpBadge = document.getElementById('hud-badge-vp');
    if (vpBadge) vpBadge.textContent = `${cp.totalVP()}⭐`;

    // Roll button state
    const rollBtn = document.getElementById('btn-roll');
    if (rollBtn) rollBtn.disabled = gs.phase !== Phase.ROLL;

    // End turn button state
    const endBtn = document.getElementById('btn-end-turn');
    if (endBtn) endBtn.disabled = gs.phase !== Phase.BUILD;

    // Build button states
    const canBuild = gs.phase === Phase.BUILD;
    const openBuildBtn = document.getElementById('btn-open-build');
    if (openBuildBtn) openBuildBtn.disabled = !canBuild;

    document.querySelectorAll('.btn-build').forEach(btn => {
      const type = btn.dataset.type;
      const cost = BUILD_COST[type];
      btn.disabled = !canBuild || !cp.canAfford(cost) ||
        (type === 'settlement' && cp.stock.settlements === 0) ||
        (type === 'city'       && cp.stock.cities === 0) ||
        (type === 'road'       && cp.stock.roads === 0) ||
        (type === 'ship'       && cp.stock.ships === 0);
    });

    // Stock counts in build sheet
    const elSettlement = document.getElementById('stock-settlement-cnt');
    if (elSettlement) elSettlement.textContent = `(còn ${cp.stock.settlements})`;
    const elCity = document.getElementById('stock-city-cnt');
    if (elCity) elCity.textContent = `(còn ${cp.stock.cities})`;
    const elRoad = document.getElementById('stock-road-cnt');
    if (elRoad) elRoad.textContent = `(còn ${cp.stock.roads})`;
    const elShip = document.getElementById('stock-ship-cnt');
    if (elShip) elShip.textContent = `(còn ${cp.stock.ships})`;
    const elDev = document.getElementById('stock-dev-cnt');
    if (elDev) elDev.textContent = `(${gs.devDeck?.length ?? 0} thẻ còn)`;

    // Action buttons
    const moveShipBtn = document.getElementById('btn-move-ship');
    if (moveShipBtn) {
      moveShipBtn.disabled = gs.phase !== Phase.BUILD || gs.getMovableShips().length === 0;
    }

    const playDevBtn = document.getElementById('btn-play-dev');
    if (playDevBtn) {
      playDevBtn.disabled = gs.phase !== Phase.BUILD || gs.devCardPlayedThisTurn ||
        !cp.devCards.some(c => !c.played && !c.newThisTurn && c.type !== 'VP');
    }

    const tradeBtn = document.getElementById('btn-open-trade');
    if (tradeBtn) tradeBtn.disabled = gs.phase !== Phase.BUILD;

    // Compact Resource Bar Chips (Hỗ trợ cả Hàng Hóa C&K)
    const chipsList = document.getElementById('res-chips-list');
    if (chipsList) {
      let html = ALL_RESOURCES.map(r => `
        <div class="res-chip ${cp.resources[r] > 0 ? 'has-res' : ''}">
          <span class="res-icon">${RES_EMOJI[r]}</span>
          <span class="res-num">${cp.resources[r]}</span>
        </div>
      `).join('');

      // Hiển thị 3 loại Hàng Hóa nếu đang chơi Cities & Knights
      if (cp.commodities) {
        const comLabels = { PAPER: 'Giấy', CLOTH: 'Vải', COIN: 'Xu' };
        const comColors = { PAPER: '#10b981', CLOTH: '#f59e0b', COIN: '#3b82f6' };
        for (const [cKey, cVal] of Object.entries(cp.commodities)) {
          html += `
            <div class="res-chip ${cVal > 0 ? 'has-res' : ''}" style="border: 1px solid ${comColors[cKey]};">
              <span class="res-icon" style="color:${comColors[cKey]}; font-size:11px; font-weight:bold;">${comLabels[cKey]}</span>
              <span class="res-num">${cVal}</span>
            </div>
          `;
        }
      }

      chipsList.innerHTML = html;
    }

    const stockBadge = document.getElementById('stock-chips-badge');
    if (stockBadge) {
      const activeDevs = cp.devCards?.filter(c => !c.played).length || 0;
      let badgeHtml = `
        <span class="stock-item">${MONO_ICONS.SETTLEMENT} ${cp.stock.settlements}</span>
        <span class="stock-item">${MONO_ICONS.CITY} ${cp.stock.cities}</span>
        <span class="stock-item">${MONO_ICONS.ROAD} ${cp.stock.roads}</span>
        <span class="stock-item">${MONO_ICONS.SHIP} ${cp.stock.ships}</span>
        ${activeDevs > 0 ? `<span class="stock-item-highlight">${MONO_ICONS.CARD} ${activeDevs}</span>` : ''}
      `;

      // C&K badges: Tường thành, Hiệp sĩ, Huy hiệu Người bảo vệ
      if (gs.ruleset === 'cities_knights') {
        badgeHtml += `
          <span class="stock-item" title="Tường thành">🧱 ${cp.cityWalls?.length || 0}/3</span>
          <span class="stock-item" title="Hiệp sĩ">🛡️ ${cp.knights?.length || 0}</span>
          ${cp.defenderTokens > 0 ? `<span class="stock-item-highlight" title="Huy hiệu Người bảo vệ Catan">🏆 ${cp.defenderTokens}</span>` : ''}
        `;
      }

      stockBadge.innerHTML = badgeHtml;
    }

    // Players List in Drawer
    const playersList = document.getElementById('hud-players-list');
    if (playersList) {
      playersList.innerHTML = gs.players.map(p => `
        <div class="player-card ${p.id === gs.currentPlayerIndex ? 'active-player' : ''}">
          <div class="pcard-left">
            <span class="pdot" style="background:${p.color}"></span>
            <strong class="pname">${p.name}</strong>
          </div>
          <div class="pcard-stats">
            <span class="pvp">${p.totalVP()} VP</span>
            <span class="pres">${MONO_ICONS.CARD} ${p.totalCards ? p.totalCards() : p.totalResources()}</span>
            ${p.hasLongestRoad  ? `<span class="badge-flag" title="Tuyến dài nhất">${MONO_ICONS.ROAD} Tuyến dài</span>` : ''}
            ${p.hasMerchant     ? `<span class="badge-flag" title="Thương nhân (+1 VP)">👑 Thương nhân</span>` : ''}
            ${p.defenderTokens > 0 ? `<span class="badge-flag" title="Huy hiệu Người bảo vệ">🏆 ${p.defenderTokens}</span>` : ''}
            ${p.hasLargestArmy  ? `<span class="badge-flag" title="Quân đội lớn nhất">${MONO_ICONS.KNIGHT} Đạo quân</span>` : ''}
            ${p.discoveredIslands?.size > 0 ? `<span class="badge-flag" title="Đảo đã khám phá">${MONO_ICONS.SHIP} ${p.discoveredIslands.size} đảo</span>` : ''}
          </div>
        </div>
      `).join('');
    }

    // Event Log in Drawer
    const logEl = document.getElementById('hud-log-content');
    if (logEl) {
      logEl.innerHTML = gs.eventLog.slice(0, 15).map(e =>
        `<div class="log-entry">${e.msg}</div>`
      ).join('');
    }

    // Check Dialogs
    this._checkAutoDialogs();

    // Win screen
    if (gs.phase === Phase.GAME_OVER && gs.winner) {
      const ws = document.getElementById('win-screen');
      ws.classList.remove('hidden');
      document.getElementById('win-name').textContent = `${gs.winner.name} Chiến Thắng!`;
      document.getElementById('win-name').style.color = gs.winner.color;
      document.getElementById('win-vp').textContent   = `${gs.winner.totalVP()} điểm vinh quang`;
      document.getElementById('win-scoreboard').innerHTML = gs.players
        .sort((a, b) => b.totalVP() - a.totalVP())
        .map(p => `<div style="color:${p.color};font-weight:bold;margin:4px 0;">• ${p.name}: ${p.totalVP()} VP</div>`)
        .join('');
    }
  }

  _checkAutoDialogs() {
    const gs = this.gs;

    // Discard
    if (gs.phase === Phase.DISCARD && gs.discardPending.length > 0) {
      const pid    = gs.discardPending[0];
      const player = gs.players[pid];
      const need   = Math.floor(player.totalResources() / 2);
      document.getElementById('discard-info').textContent =
        `${player.name} phải bỏ ${need} tài nguyên (đang có ${player.totalResources()})`;
      ALL_RESOURCES.forEach(r => {
        const el = document.getElementById(`discard-have-${r}`);
        if (el) el.textContent = `(có: ${player.resources[r]})`;
      });
      document.getElementById('discard-total-info').textContent = `Số lượng cần bỏ: ${need}`;
      document.getElementById('discard-dialog').classList.remove('hidden');
    } else {
      document.getElementById('discard-dialog').classList.add('hidden');
    }

    // Gold
    if (gs.phase === Phase.GOLD_PICK && gs.goldPending.length > 0) {
      const pending = gs.goldPending[0];
      document.getElementById('gold-amount-info').textContent =
        `${gs.players[pending.playerId].name} — Chọn ${pending.amount} tài nguyên tuỳ ý`;
      document.getElementById('gold-dialog').classList.remove('hidden');
    } else {
      document.getElementById('gold-dialog').classList.add('hidden');
    }
  }

  showStealDialog(victimIds) {
    const gs = this.gs;
    document.getElementById('steal-targets').innerHTML = victimIds.map(pid => {
      const p = gs.players[pid];
      return `<button class="btn btn-steal btn-touch" data-pid="${pid}" style="border-color:${p.color}">
        <span class="pdot" style="background:${p.color}"></span>
        ${p.name} (${p.totalResources()} tài nguyên)
      </button>`;
    }).join('');

    document.querySelectorAll('.btn-steal').forEach(btn => {
      btn.onclick = () => {
        const pid = parseInt(btn.dataset.pid);
        const r = this.cb.onSteal?.(pid);
        if (r?.ok) {
          document.getElementById('steal-dialog').classList.add('hidden');
          this.update();
        }
      };
    });

    document.getElementById('steal-dialog').classList.remove('hidden');
  }

  showBuildHint(type) {
    const hints = {
      settlement: 'Chạm vào điểm vàng để đặt Định cư',
      city:       'Chạm vào Định cư của bạn để nâng cấp Thành phố',
      road:       'Chạm vào cạnh vàng để đặt Đường',
      ship:       'Chạm vào cạnh vàng trên biển để đặt Tàu',
      moveShip_select: 'Chạm chọn Tàu muốn di chuyển (phát sáng)',
      moveShip_place:  'Chạm chọn vị trí biển mới cho Tàu',
      setupSettlement: 'Khởi đầu: Chạm điểm vàng đặt Định cư',
      setupRoad:       'Khởi đầu: Chạm cạnh vàng đặt Đường hoặc Tàu',
    };
    const hint = document.getElementById('build-hint');
    hint.textContent = hints[type] ?? '';
    hint.classList.remove('hidden');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => hint.classList.add('hidden'), 5500);
  }

  _updateTradeRate() {
    const give   = document.getElementById('trade-give-res').value;
    const player = this.gs.currentPlayer;
    let rate = 4;
    if (player.harborAccess?.has(give)) rate = 2;
    else if (player.harborAccess?.has('GENERIC')) rate = 3;
    document.getElementById('trade-rate').textContent = rate;
  }

  _openDevDialog() {
    const cp = this.gs.currentPlayer;
    const playable = cp.devCards.filter(c => !c.played && !c.newThisTurn && c.type !== 'VP');
    if (playable.length === 0) {
      window._showToast?.('Bạn không có thẻ Phát Triển khả dụng');
      return;
    }

    const cardLabels = {
      KNIGHT:         'Hiệp Sĩ (Knight) — Dời cướp & trộm bài',
      MONOPOLY:       'Độc Quyền (Monopoly) — Thu 1 loại tài nguyên',
      YEAR_OF_PLENTY: 'Bội Thu (Year of Plenty) — Lấy 2 tài nguyên',
      ROAD_BUILDING:  'Xây Đường (Road Building) — 2 đường/tàu miễn phí',
    };

    const counts = {};
    for (const c of playable) counts[c.type] = (counts[c.type] ?? 0) + 1;

    document.getElementById('dev-card-list').innerHTML = Object.entries(counts).map(([type, n]) => `
      <button class="btn btn-dev-choice btn-touch" data-type="${type}">
        ${cardLabels[type] ?? type} ${n > 1 ? `(x${n})` : ''}
      </button>
    `).join('');

    this._selectedDevType = null;
    document.querySelectorAll('.btn-dev-choice').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.btn-dev-choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._selectedDevType = btn.dataset.type;
        document.getElementById('monopoly-row').classList.toggle('hidden', btn.dataset.type !== 'MONOPOLY');
        document.getElementById('yop-row').classList.toggle('hidden',      btn.dataset.type !== 'YEAR_OF_PLENTY');
      };
    });

    document.getElementById('dev-dialog').classList.remove('hidden');
  }

  _submitDevCard() {
    const type = this._selectedDevType;
    if (!type) { window._showToast?.('Vui lòng chạm chọn 1 thẻ trước'); return; }

    let opts = {};
    if (type === 'MONOPOLY') {
      opts.resource = document.getElementById('monopoly-res').value;
    } else if (type === 'YEAR_OF_PLENTY') {
      const resources = {};
      document.querySelectorAll('.yop-input').forEach(inp => {
        const n = parseInt(inp.value) || 0;
        if (n > 0) resources[inp.dataset.res] = n;
      });
      opts.resources = resources;
    }

    const r = this.cb.onDevCard?.(type, opts);
    if (r?.ok) {
      document.getElementById('dev-dialog').classList.add('hidden');
      this.update();
      if (type === 'KNIGHT') {
        window._showToast?.('Chạm ô đất (Robber) hoặc biển (Pirate) để dời cướp.');
      }
    } else {
      window._showToast?.(r?.reason);
    }
  }

  _animateDice(roll) {
    const d1 = document.getElementById('die1');
    const d2 = document.getElementById('die2');
    const res = document.getElementById('die-result');
    let frames = 0;
    const iv = setInterval(() => {
      d1.textContent = Math.ceil(Math.random() * 6);
      d2.textContent = Math.ceil(Math.random() * 6);
      frames++;
      if (frames >= 10) {
        clearInterval(iv);
        d1.textContent = roll.d1;
        d2.textContent = roll.d2;
        res.textContent = `= ${roll.total}`;
        res.style.color = roll.total === 7 ? '#ff4d4f' : '#f0c040';
        if (roll.total === 7) res.textContent += ' [Robber/Pirate]';
      }
    }, 65);
  }
}
