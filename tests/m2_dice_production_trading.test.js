/**
 * m2_dice_production_trading.test.js — Kiểm tra Milestone 2
 *
 * Kiểm tra:
 * 1. Tung 3 xúc xắc (Event die + Red + Yellow)
 * 2. Event die: Thuyền di chuyển track man rợ
 * 3. Event die: Cổng thành rút thẻ theo dải xúc xắc đỏ và cấp độ nâng cấp
 * 4. Sản xuất hàng hóa & tài nguyên: City vs Settlement theo bảng sản xuất
 * 5. Bỏ bài khi ra số 7: Hand limit tính cả Tường thành (+2 mỗi tường)
 * 6. Tên cướp: KHÔNG di chuyển/cướp trước đợt tấn công man rợ đầu tiên
 * 7. Giao dịch ngân hàng 4:1/3:1 cho hàng hóa
 * 8. Giao dịch Hội thương nhân (Trade L3): 2:1 hàng hóa
 * 9. Giao dịch Thương nhân: 2:1 tài nguyên của ô thương nhân
 * 10. Trao đổi giữa người chơi bao gồm cả hàng hóa
 * 11. Cống dẫn nước (Science L3 - Aqueduct): nhận 1 tài nguyên tự chọn khi không nhận sản lượng
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { CKGameState } from '../src/gameplay/CKGameState.js';
import { Phase } from '../src/gameplay/GameState.js';
import { EventDieFace, ImprovementTrack } from '../shared/ck_constants.js';

const suite = new TestSuite('Milestone 2: Dice, Production, Commodities, Trading');

// ─── 1. Dice & Event Die ─────────────────────────────────────────────────────

suite.test('Tung 3 xúc xắc và giải quyết xúc xắc sự kiện trước', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  // Setup xong để vào Phase.ROLL
  gs.phase = Phase.ROLL;
  gs.currentPlayerIndex = 0;

  // Tung xúc xắc với mặt Thuyền (Ship)
  const initialBarbPos = gs.barbarianPosition;
  const res = gs.rollDice(3, 4, EventDieFace.SHIP);

  assert.ok(res.ok);
  assert.strictEqual(res.roll.total, 7);
  assert.strictEqual(res.roll.eventDie, EventDieFace.SHIP);
  assert.strictEqual(gs.barbarianPosition, initialBarbPos + 1, 'Thuyền man rợ phải tiến 1 bước');
});

suite.test('Cổng thành kích hoạt rút thẻ tiến bộ dựa trên xúc xắc đỏ và cấp nâng cấp', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.ROLL;

  // P0 có Science level 1 (rút khi red <= 2)
  gs.players[0].improvements.science = 1;
  // P1 có Science level 3 (rút khi red <= 4)
  gs.players[1].improvements.science = 3;
  // P2 có Science level 0 (không bao giờ rút)
  gs.players[2].improvements.science = 0;

  const p0InitialCards = gs.players[0].progressCards.length;
  const p1InitialCards = gs.players[1].progressCards.length;
  const p2InitialCards = gs.players[2].progressCards.length;

  // Tung xúc xắc: Đỏ = 3, Vàng = 5, Cổng Science
  gs.rollDice(3, 5, EventDieFace.SCIENCE_GATE);

  // Red die = 3:
  // - P0 level 1 (range <= 2) -> KHÔNG ĐƯỢC
  // - P1 level 3 (range <= 4) -> ĐƯỢC RÚT
  // - P2 level 0 -> KHÔNG ĐƯỢC
  assert.strictEqual(gs.players[0].progressCards.length, p0InitialCards, 'P0 không được rút vì đỏ=3 > dải level 1');
  assert.strictEqual(gs.players[1].progressCards.length, p1InitialCards + 1, 'P1 phải rút được 1 thẻ Khoa học');
  assert.strictEqual(gs.players[2].progressCards.length, p2InitialCards, 'P2 level 0 không được rút');
});

// ─── 2. Production & Commodities ─────────────────────────────────────────────

suite.test('Bảng sản xuất C&K: Settlement nhận 1 tài nguyên, City nhận Tài nguyên + Hàng hóa', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  // Tìm 1 ô Forest (LUMBER), gán số = 8
  let forestTile = null;
  for (const tile of gs.tiles.values()) {
    if (tile.resource === 'LUMBER') {
      forestTile = tile;
      tile.number = 8;
      tile.hasRobber = false;
      break;
    }
  }
  assert.ok(forestTile, 'Phải có ô Forest');

  // Tìm 2 vertex kề ô Forest
  const adjVertices = [];
  for (const [vKey, v] of gs.vertices) {
    if (v.hexes.some(h => h.q === forestTile.q && h.r === forestTile.r)) {
      adjVertices.push(vKey);
    }
  }

  // P0 đặt Settlement ở v0
  gs.vertices.get(adjVertices[0]).building = { playerId: 0, type: 'settlement' };
  // P1 đặt City ở v1
  gs.vertices.get(adjVertices[1]).building = { playerId: 1, type: 'city' };

  const p0LumberBefore = gs.players[0].resources.LUMBER || 0;
  const p0PaperBefore = gs.players[0].commodities.PAPER || 0;
  const p1LumberBefore = gs.players[1].resources.LUMBER || 0;
  const p1PaperBefore = gs.players[1].commodities.PAPER || 0;

  // Tung ra số 8
  gs.phase = Phase.ROLL;
  gs.rollDice(4, 4, EventDieFace.SHIP);

  // Settlement của P0: +1 LUMBER, 0 PAPER
  assert.strictEqual(gs.players[0].resources.LUMBER, p0LumberBefore + 1);
  assert.strictEqual(gs.players[0].commodities.PAPER, p0PaperBefore);

  // City của P1 trên Forest: +1 LUMBER, +1 PAPER
  assert.strictEqual(gs.players[1].resources.LUMBER, p1LumberBefore + 1);
  assert.strictEqual(gs.players[1].commodities.PAPER, p1PaperBefore + 1);
});

// ─── 3. Discard on 7 & Hand Limits with Walls ─────────────────────────────────

suite.test('Số 7: Giới hạn bài tính cả Tường thành (+2 mỗi tường), tính cả hàng hóa', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.ROLL;

  // P0 có 8 thẻ (5 tài nguyên + 3 hàng hóa), không có tường thành (limit = 7) -> PHẢI BỎ
  gs.players[0].resources.LUMBER = 5;
  gs.players[0].commodities.PAPER = 3;

  // P1 có 8 thẻ (5 tài nguyên + 3 hàng hóa), có 1 TƯỜNG THÀNH (limit = 9) -> KHÔNG PHẢI BỎ
  gs.players[1].resources.LUMBER = 5;
  gs.players[1].commodities.PAPER = 3;
  gs.players[1].cityWalls.push('vWall');

  assert.strictEqual(gs.players[0].getHandLimit(), 7);
  assert.strictEqual(gs.players[1].getHandLimit(), 9);

  // Tung số 7
  gs.rollDice(3, 4, EventDieFace.SHIP);

  // Phải chuyển sang Phase.DISCARD cho P0
  assert.strictEqual(gs.phase, Phase.DISCARD);
  assert.ok(gs.discardPending.includes(0), 'P0 phải có trong danh sách bỏ bài');
  assert.ok(!gs.discardPending.includes(1), 'P1 có tường thành nên không phải bỏ bài');

  // P0 bỏ 4 thẻ (gồm cả tài nguyên và hàng hóa)
  const discardRes = gs.discardResources(0, { LUMBER: 2, PAPER: 2 });
  assert.ok(discardRes.ok);
  assert.strictEqual(gs.players[0].resources.LUMBER, 3);
  assert.strictEqual(gs.players[0].commodities.PAPER, 1);
});

suite.test('Tên cướp KHÔNG di chuyển hay cướp trước đợt tấn công man rợ đầu tiên', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.ROLL;
  assert.strictEqual(gs.robberOnBoard, false, 'Tên cướp chưa lên bàn');

  // Không ai phải bỏ bài
  for (const p of gs.players) {
    p.resources = { LUMBER: 0, BRICK: 0, GRAIN: 0, WOOL: 0, ORE: 0, GOLD: 0 };
    p.commodities = { PAPER: 0, CLOTH: 0, COIN: 0 };
  }

  // Đổ ra số 7
  gs.rollDice(3, 4, EventDieFace.SHIP);

  // Vì Robber chưa trên bàn, phase phải chuyển thẳng sang BUILD thay vì ROBBER
  assert.strictEqual(gs.phase, Phase.BUILD, 'Phải chuyển sang Phase.BUILD vì Robber chưa hoạt động');
});

// ─── 4. Trading Extensions ───────────────────────────────────────────────────

suite.test('Giao dịch Ngân hàng với hàng hóa (4:1 hoặc 3:1 với cảng chung)', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p = gs.currentPlayer;

  // P0 có 4 PAPER, đổi lấy 1 ORE (4:1)
  p.commodities.PAPER = 4;
  p.resources.ORE = 0;

  const res1 = gs.tradeWithBank('PAPER', 4, 'ORE');
  assert.ok(res1.ok);
  assert.strictEqual(p.commodities.PAPER, 0);
  assert.strictEqual(p.resources.ORE, 1);

  // Với cảng chung: tỷ lệ là 3:1
  p.harborAccess = new Set(['GENERIC']);
  p.commodities.CLOTH = 3;
  const res2 = gs.tradeWithBank('CLOTH', 3, 'BRICK');
  assert.ok(res2.ok);
  assert.strictEqual(p.commodities.CLOTH, 0);
  assert.strictEqual(p.resources.BRICK, 1);
});

suite.test('Hội thương nhân (Trade L3): Đổi 2:1 hàng hóa lấy bất kỳ thẻ nào', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p = gs.currentPlayer;

  // Chưa có Trade L3
  p.improvements.trade = 2;
  p.commodities.CLOTH = 2;
  const fail = gs.tradeCommodity2to1('CLOTH', 'ORE');
  assert.strictEqual(fail.ok, false);

  // Nâng lên Trade L3
  p.improvements.trade = 3;
  const success = gs.tradeCommodity2to1('CLOTH', 'ORE');
  assert.ok(success.ok);
  assert.strictEqual(p.commodities.CLOTH, 0);
  assert.strictEqual(p.resources.ORE, 1);
});

suite.test('Giao dịch với Thương nhân: Đổi 2:1 tài nguyên của ô Thương nhân', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p = gs.currentPlayer;

  // Đặt Thương nhân vào 1 ô ORE
  let oreHex = null;
  for (const tile of gs.tiles.values()) {
    if (tile.resource === 'ORE') {
      oreHex = { q: tile.q, r: tile.r };
      break;
    }
  }
  assert.ok(oreHex);

  gs.merchantOwner = p.id;
  gs.merchantHex = oreHex;
  p.hasMerchant = true;

  p.resources.ORE = 2;
  p.resources.GRAIN = 0;

  const res = gs.tradeWithMerchant(2, 'GRAIN');
  assert.ok(res.ok);
  assert.strictEqual(p.resources.ORE, 0);
  assert.strictEqual(p.resources.GRAIN, 1);
});

suite.test('Trao đổi giữa 2 người chơi bao gồm cả Hàng hóa', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;

  gs.players[0].resources.LUMBER = 2;
  gs.players[0].commodities.PAPER = 0;
  gs.players[1].commodities.PAPER = 1;
  gs.players[1].resources.LUMBER = 0;

  // P0 đổi 2 LUMBER lấy 1 PAPER của P1
  const res = gs.tradeWithPlayer(1, { LUMBER: 2 }, { PAPER: 1 });
  assert.ok(res.ok);

  assert.strictEqual(gs.players[0].resources.LUMBER, 0);
  assert.strictEqual(gs.players[0].commodities.PAPER, 1);
  assert.strictEqual(gs.players[1].commodities.PAPER, 0);
  assert.strictEqual(gs.players[1].resources.LUMBER, 2);
});

suite.test('Cống dẫn nước (Science L3 - Aqueduct): Nhận 1 tài nguyên tự chọn khi không có sản lượng', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.ROLL;

  // P0 có Science cấp 3
  gs.players[0].improvements.science = 3;
  // Đảm bảo P0 không có công trình nào trên ô số 4
  for (const [, v] of gs.vertices) {
    if (v.building?.playerId === 0) v.building = null;
  }

  // Tung ra số 4 (không trúng công trình của P0)
  gs.rollDice(2, 2, EventDieFace.SHIP);

  assert.strictEqual(gs.players[0].aqueductPending, true, 'P0 phải được quyền kích hoạt Cống dẫn nước');

  // P0 chọn nhận 1 ORE
  const claimRes = gs.claimAqueductResource(0, 'ORE');
  assert.ok(claimRes.ok);
  assert.strictEqual(gs.players[0].resources.ORE, 1);
  assert.strictEqual(gs.players[0].aqueductPending, false);
});

// Chạy test suite
suite.run();
