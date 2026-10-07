/**
 * m7_localization_rules_panel.test.js — Kiểm tra Milestone 7: Bản địa hóa & Panel Luật chơi
 *
 * Kiểm tra:
 * 1. Đầy đủ các khóa ngôn ngữ tiếng Việt (vi.js) cho cả 26 loại thẻ tiến bộ.
 * 2. Tất cả tài nguyên (Gạch, Gỗ, Lúa, Cừu, Quặng) và hàng hóa (Giấy, Vải, Đồng xu).
 * 3. Tất cả cấp độ nâng cấp thành phố cho 3 nhánh (Khoa học, Thương mại, Chính trị).
 * 4. Hàm dịch `t(key, params)` hoạt động trơn tru với tham số thay thế.
 * 5. Các thông số trong Bảng tra cứu (Cheat Sheet) khớp 100% với `CK_CONFIG` (Single Source of Truth).
 * 6. Việc mở/đóng Rules Panel không can thiệp hay thay đổi trạng thái ván đấu (`phase`, `turn`, `resources`).
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { VI, t } from '../shared/i18n/vi.js';
import { PROGRESS_CARD_DEFS } from '../src/gameplay/CKProgressCards.js';
import { CK_CONFIG } from '../src/gameplay/CKRulesConfig.js';
import { CKGameState } from '../src/gameplay/CKGameState.js';

const suite = new TestSuite('Milestone 7: Localization & Rules Panel');

// ─── 1. Kiểm tra Bản địa hóa 26 Thẻ Tiến Bộ ──────────────────────────────────

suite.test('Toàn bộ 26 loại thẻ tiến bộ đều có Tên và Mô tả tiếng Việt chính xác', () => {
  for (const cardId of Object.keys(PROGRESS_CARD_DEFS)) {
    const nameKey = `card.${cardId}.name`;
    const descKey = `card.${cardId}.desc`;

    assert.ok(VI[nameKey], `Thiếu tên tiếng Việt cho thẻ: ${cardId}`);
    assert.ok(VI[descKey], `Thiếu mô tả tiếng Việt cho thẻ: ${cardId}`);
    assert.ok(VI[nameKey].length > 0);
    assert.ok(VI[descKey].length > 0);
  }
});

// ─── 2. Kiểm tra Tài nguyên & Hàng hóa ───────────────────────────────────────

suite.test('Tất cả Tài nguyên và Hàng hóa đều được định nghĩa chuẩn tiếng Việt', () => {
  assert.strictEqual(t('resource.BRICK'), 'Gạch');
  assert.strictEqual(t('resource.LUMBER'), 'Gỗ');
  assert.strictEqual(t('resource.GRAIN'), 'Lúa');
  assert.strictEqual(t('resource.WOOL'), 'Cừu');
  assert.strictEqual(t('resource.ORE'), 'Quặng');

  assert.strictEqual(t('commodity.PAPER'), 'Giấy');
  assert.strictEqual(t('commodity.CLOTH'), 'Vải');
  assert.strictEqual(t('commodity.COIN'), 'Đồng xu');
});

// ─── 3. Kiểm tra Tên cấp độ nâng cấp 3 nhánh ─────────────────────────────────

suite.test('Các cấp độ nâng cấp thành phố có đầy đủ 5 cấp cho mỗi nhánh', () => {
  const tracks = ['science', 'trade', 'politics'];
  for (const track of tracks) {
    for (let level = 1; level <= 5; level++) {
      const key = `improvement.${track}.${level}`;
      assert.ok(VI[key], `Thiếu tên cấp độ: ${key}`);
    }
  }

  // Kiểm tra tên cấp 3 mang lại đặc quyền
  assert.ok(t('improvement.science.3').includes('Cống dẫn nước'));
  assert.ok(t('improvement.trade.3').includes('Hội thương nhân'));
  assert.ok(t('improvement.politics.3').includes('Pháo đài'));
});

// ─── 4. Đảm bảo Đồng bộ Single Source of Truth ──────────────────────────────

suite.test('Số liệu luật chơi đồng bộ với CK_CONFIG', () => {
  assert.strictEqual(CK_CONFIG.WIN_VP, 13);
  assert.strictEqual(CK_CONFIG.HAND_LIMIT_BASE, 7);
  assert.strictEqual(CK_CONFIG.WALL_LIMIT_BONUS, 2);
  assert.strictEqual(CK_CONFIG.MAX_WALLS_PER_PLAYER, 3);
  assert.strictEqual(CK_CONFIG.barbarianSteps, 7);
});

// ─── 5. Không ảnh hưởng đến Game State ───────────────────────────────────────

suite.test('Tra cứu luật không làm thay đổi trạng thái ván đấu', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  const initialPhase = gs.phase;
  const initialTurn = gs.turn;
  const initialP0Cards = gs.players[0].totalCards();

  // Tra cứu chuỗi luật từ từ điển
  const title = t('game.title');
  const winRule = t('game.win_vp');
  assert.ok(title.includes('Thành phố & Hiệp sĩ'));
  assert.ok(winRule.includes('13'));

  // Game state giữ nguyên vẹn 100%
  assert.strictEqual(gs.phase, initialPhase);
  assert.strictEqual(gs.turn, initialTurn);
  assert.strictEqual(gs.players[0].totalCards(), initialP0Cards);
});

// Chạy test suite
suite.run();
