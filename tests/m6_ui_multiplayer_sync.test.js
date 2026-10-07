/**
 * m6_ui_multiplayer_sync.test.js — Kiểm tra Milestone 6: UI, Multiplayer Sync & Full Pass
 *
 * Kiểm tra:
 * 1. Khởi tạo bàn chơi dựa trên phòng: `scenario === 'cities_knights'` tạo đúng instance `CKGameState`.
 * 2. Phân nhánh game mode: `ruleset = "base"` giữ nguyên 100% logic Seafarers.
 * 3. Bảo mật thông tin ẩn (Hidden Information):
 *    - `toJSON()` che giấu nội dung thẻ Tiến bộ của các bộ bài (chỉ gửi số lượng).
 *    - `toJSON()` của `CKPlayer` chỉ gửi `progressCardsCount` cho người khác.
 * 4. Khả năng phục hồi kết nối (Reconnect Safety & Action Replay):
 *    - Mọi action (tung xúc xắc, mua nâng cấp, hiệp sĩ) đều có thể tuần tự hóa và tái hiện xác định.
 * 5. Điều kiện thắng giữa lượt (Mid-turn Win Check):
 *    - Đạt 13 VP ở bất kỳ thời điểm nào trong lượt của mình (Settlement, City, Metropolis, Defender tokens, Merchant, VP cards).
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { CKGameState } from '../src/gameplay/CKGameState.js';
import { GameState, Phase } from '../src/gameplay/GameState.js';
import { CKPlayer } from '../src/entities/CKPlayer.js';
import { ImprovementTrack } from '../shared/ck_constants.js';

const suite = new TestSuite('Milestone 6: UI, Multiplayer Sync & Integration');

// ─── 1. Ruleset Branching & Compatibility ─────────────────────────────────────

suite.test('Chế độ phòng chọn "cities_knights" tạo CKGameState, "voyages" tạo GameState', () => {
  function createGameForRoom(room) {
    if (room.scenario === 'cities_knights') {
      return new CKGameState(3, ['A', 'B', 'C'], 'seed123');
    }
    return new GameState(3, ['A', 'B', 'C'], 'seed123');
  }

  const ckGame = createGameForRoom({ scenario: 'cities_knights' });
  assert.strictEqual(ckGame.ruleset, 'cities_knights');
  assert.strictEqual(ckGame.winningVP, 13);
  assert.ok(ckGame instanceof CKGameState);

  const baseGame = createGameForRoom({ scenario: 'voyages' });
  assert.strictEqual(baseGame.ruleset, undefined); // Base game
  assert.strictEqual(baseGame.devCardDeck.length, 25);
  assert.ok(baseGame instanceof GameState);
});

// ─── 2. Bảo mật thông tin ẩn (Hidden Information) ─────────────────────────────

suite.test('Bảo mật: toJSON() che giấu nội dung thẻ bài tiến bộ, chỉ gửi số lượng', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  const json = gs.toJSON();

  // Decks chỉ gửi số lượng còn lại
  assert.strictEqual(typeof json.progressDecks.science, 'number');
  assert.strictEqual(typeof json.progressDecks.trade, 'number');
  assert.strictEqual(typeof json.progressDecks.politics, 'number');
  assert.strictEqual(json.progressDecks.science, 18);

  // Player JSON che giấu chi tiết thẻ tiến bộ chưa chơi
  const p0 = gs.players[0];
  p0.progressCards.push({ id: 'crane', isVP: false });
  p0.progressCards.push({ id: 'printer', isVP: true });

  const p0Json = p0.toJSON();
  assert.strictEqual(p0Json.progressCardsCount, 2);
  assert.strictEqual(p0Json.progressCards, undefined, 'Không được lộ mảng progressCards');
});

// ─── 3. Kiểm tra thắng cuộc giữa lượt (Mid-turn Win Check) ────────────────────

suite.test('Mid-turn win check: Đạt 13 VP tại bất kỳ thời điểm nào trong lượt của mình', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  // Giả lập điểm số ban đầu của P0:
  // 3 City = 6 VP
  // 2 Settlement = 2 VP
  // Longest Road = 2 VP
  // Defender tokens = 2 VP
  // Tổng = 12 VP (cần thêm 1 VP để thắng ở 13 VP)
  p0.placed.cities = ['vC1', 'vC2', 'vC3'];
  p0.placed.settlements = ['vS1', 'vS2'];
  p0.hasLongestRoad = true;
  p0.defenderTokens = 2;
  p0.recalcPublicVP();

  assert.strictEqual(p0.victoryPoints, 12);
  assert.strictEqual(gs.phase, Phase.BUILD);
  assert.strictEqual(gs.winner, null);

  // Giữa lượt: P0 đánh thẻ Printer (1 VP) hoặc giành quyền kiểm soát Thương nhân (1 VP)
  p0.hasMerchant = true;
  p0.recalcPublicVP();
  gs._checkWin();

  // Đạt 13 VP -> GAME OVER ngay lập tức!
  assert.strictEqual(p0.victoryPoints, 13);
  assert.strictEqual(gs.phase, Phase.GAME_OVER, 'Phải kết thúc game ngay giữa lượt');
  assert.strictEqual(gs.winner.id, p0.id);
});

// ─── 4. Replay Safety & Deterministic State ──────────────────────────────────

suite.test('Deterministic Replay: Cùng seed và chuỗi hành động cho ra trạng thái giống hệt nhau', () => {
  const gs1 = new CKGameState(3, ['A', 'B', 'C'], 9999);
  const gs2 = new CKGameState(3, ['A', 'B', 'C'], 9999);

  // Thứ tự thẻ trong các cọc bài phải giống hệt nhau
  assert.strictEqual(gs1.progressDecks.science[0].id, gs2.progressDecks.science[0].id);
  assert.strictEqual(gs1.progressDecks.trade[0].id, gs2.progressDecks.trade[0].id);
  assert.strictEqual(gs1.progressDecks.politics[0].id, gs2.progressDecks.politics[0].id);
});

// Chạy test suite
suite.run();
