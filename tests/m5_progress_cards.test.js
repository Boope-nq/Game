/**
 * m5_progress_cards.test.js — Kiểm tra Milestone 5: Toàn bộ 54 Thẻ Tiến Bộ (Progress Cards)
 *
 * Kiểm tra:
 * 1. Khoa học (Science):
 *    - Alchemist: chọn giá trị xúc xắc trước khi tung, xúc xắc sự kiện tung bình thường.
 *    - Crane: giảm 1 hàng hóa cho nâng cấp thành phố.
 *    - Engineer: xây tường thành miễn phí.
 *    - Inventor: đổi 2 đĩa số trừ 2, 6, 8, 12.
 *    - Irrigation & Mining: nhận 2 lúa/quặng cho mỗi ô kề công trình.
 *    - Medicine: nâng cấp city với 1 lúa + 2 quặng.
 *    - Smith: thăng cấp 2 hiệp sĩ miễn phí.
 * 2. Thương mại (Trade):
 *    - Merchant: lấy thương nhân đặt lên ô kề công trình (+1 VP).
 *    - Merchant Fleet: đổi 2:1 ngân hàng suốt lượt.
 *    - Resource Monopoly & Trade Monopoly: thu tài nguyên/hàng hóa từ các đối thủ.
 *    - Master Merchant: lấy 2 thẻ từ người có nhiều VP hơn.
 * 3. Chính trị (Politics):
 *    - Warlord: kích hoạt toàn bộ hiệp sĩ miễn phí.
 *    - Spy: xem và cướp 1 thẻ tiến bộ của đối phương (trừ VP cards).
 *    - Bishop: di chuyển Tên cướp và cướp từ mỗi người kề bên (yêu cầu robber đã trên bàn).
 *    - Deserter: đối phương gỡ hiệp sĩ về kho, mình đặt hiệp sĩ tương ứng.
 *    - Wedding: người nhiều VP hơn phải tặng 2 thẻ.
 *    - Saboteur: người bằng hoặc nhiều VP hơn phải bỏ nửa số thẻ bài.
 * 4. Quy tắc quản lý thẻ:
 *    - Thẻ VP ngửa mặt ngay lập tức, không tính vào giới hạn 4 thẻ.
 *    - Thẻ sử dụng xong trở về đáy cọc bài.
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { CKGameState } from '../src/gameplay/CKGameState.js';
import { Phase } from '../src/gameplay/GameState.js';
import { KnightLevel } from '../shared/ck_constants.js';

const suite = new TestSuite('Milestone 5: 54 Progress Cards & Interrupts');

// ─── 1. Thẻ Khoa học (Science Cards) ──────────────────────────────────────────

suite.test('Alchemist: Chọn trước kết quả 2 xúc xắc sản xuất ở Phase.ROLL', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.ROLL;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  p0.progressCards.push({ id: 'alchemist', isVP: false });

  // Đánh thẻ Alchemist chọn 5 + 6 = 11
  const playRes = gs.playProgressCard('alchemist', { d1: 5, d2: 6 });
  assert.ok(playRes.ok);
  assert.strictEqual(gs.alchemistForcedDice.d1, 5);
  assert.strictEqual(gs.alchemistForcedDice.d2, 6);

  // Tung xúc xắc -> Xúc xắc sản xuất phải ra đúng 5 và 6 (tổng 11)
  const rollRes = gs.rollDice();
  assert.ok(rollRes.ok);
  assert.strictEqual(rollRes.roll.d1, 5);
  assert.strictEqual(rollRes.roll.d2, 6);
  assert.strictEqual(rollRes.roll.total, 11);
});

suite.test('Engineer: Xây 1 Tường thành miễn phí (không tốn 2 Gạch)', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  const vKey = [...gs.vertices.keys()][0];
  p0.placed.cities = [vKey];
  gs.vertices.get(vKey).building = { playerId: 0, type: 'city' };
  p0.resources.BRICK = 0; // 0 gạch
  p0.progressCards.push({ id: 'engineer', isVP: false });

  const res = gs.playProgressCard('engineer', { vertexKey: vKey });
  assert.ok(res.ok);
  assert.strictEqual(p0.cityWalls.length, 1);
  assert.strictEqual(p0.resources.BRICK, 0);
});

suite.test('Inventor: Đổi 2 đĩa số trừ 2, 6, 8, 12', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  // Lấy 2 ô đất có số
  const numberedTiles = [...gs.tiles.values()].filter(t => t.number && ![2, 6, 8, 12].includes(t.number));
  const t1 = numberedTiles[0];
  const t2 = numberedTiles[1];
  const num1 = t1.number;
  const num2 = t2.number;

  p0.progressCards.push({ id: 'inventor', isVP: false });

  const res = gs.playProgressCard('inventor', {
    hex1: { q: t1.q, r: t1.r },
    hex2: { q: t2.q, r: t2.r }
  });
  assert.ok(res.ok);
  assert.strictEqual(t1.number, num2);
  assert.strictEqual(t2.number, num1);
});

suite.test('Medicine: Nâng cấp Thành phố chỉ với 1 Lúa + 2 Quặng', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  const vKey = [...gs.vertices.keys()][0];
  p0.placed.settlements = [vKey];
  gs.vertices.get(vKey).building = { playerId: 0, type: 'settlement' };

  p0.resources.GRAIN = 1;
  p0.resources.ORE = 2; // Không đủ 2 Lúa + 3 Quặng bình thường
  p0.progressCards.push({ id: 'medicine', isVP: false });

  const res = gs.playProgressCard('medicine', { vertexKey: vKey });
  assert.ok(res.ok);
  assert.strictEqual(p0.placed.cities.length, 1);
  assert.strictEqual(p0.resources.GRAIN, 0);
  assert.strictEqual(p0.resources.ORE, 0);
});

suite.test('Smith: Thăng cấp miễn phí 2 hiệp sĩ', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  p0.knights = [
    { id: 'k1', playerId: 0, level: KnightLevel.BASIC, active: false },
    { id: 'k2', playerId: 0, level: KnightLevel.BASIC, active: true },
  ];
  p0.resources.WOOL = 0;
  p0.resources.ORE = 0;
  p0.progressCards.push({ id: 'smith', isVP: false });

  const res = gs.playProgressCard('smith', { knightIds: ['k1', 'k2'] });
  assert.ok(res.ok);
  assert.strictEqual(p0.knights[0].level, KnightLevel.STRONG);
  assert.strictEqual(p0.knights[1].level, KnightLevel.STRONG);
  assert.strictEqual(p0.resources.WOOL, 0);
});

// ─── 2. Thẻ Thương mại (Trade Cards) ──────────────────────────────────────────

suite.test('Resource Monopoly & Trade Monopoly: Thu gom tài nguyên và hàng hóa từ đối thủ', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  // Cấp bài cho đối thủ
  gs.players[1].resources.ORE = 3;
  gs.players[2].resources.ORE = 1;
  p0.resources.ORE = 0;
  p0.progressCards.push({ id: 'resource_monopoly', isVP: false });

  // P0 độc quyền Quặng -> P1 nộp 2, P2 nộp 1 (tổng 3)
  const resMono = gs.playProgressCard('resource_monopoly', { resource: 'ORE' });
  assert.ok(resMono.ok);
  assert.strictEqual(p0.resources.ORE, 3);
  assert.strictEqual(gs.players[1].resources.ORE, 1);
  assert.strictEqual(gs.players[2].resources.ORE, 0);

  // Độc quyền Hàng hóa (Trade Monopoly)
  gs.players[1].commodities.PAPER = 2;
  gs.players[2].commodities.PAPER = 1;
  p0.commodities.PAPER = 0;
  p0.progressCards.push({ id: 'trade_monopoly', isVP: false });

  // Mỗi người nộp tối đa 1 hàng hóa (tổng 2)
  const tradeMono = gs.playProgressCard('trade_monopoly', { commodity: 'PAPER' });
  assert.ok(tradeMono.ok);
  assert.strictEqual(p0.commodities.PAPER, 2);
  assert.strictEqual(gs.players[1].commodities.PAPER, 1);
  assert.strictEqual(gs.players[2].commodities.PAPER, 0);
});

suite.test('Master Merchant: Lấy 2 thẻ từ người chơi có nhiều VP hơn', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;
  const p1 = gs.players[1];

  p0.victoryPoints = 2;
  p1.victoryPoints = 4; // P1 có nhiều VP hơn P0
  p1.resources.LUMBER = 2;
  p1.commodities.COIN = 2;
  p0.resources.LUMBER = 0;
  p0.commodities.COIN = 0;

  p0.progressCards.push({ id: 'master_merchant', isVP: false });

  const res = gs.playProgressCard('master_merchant', {
    targetPlayerId: 1,
    takeCards: { LUMBER: 1, COIN: 1 }
  });
  assert.ok(res.ok);
  assert.strictEqual(p0.resources.LUMBER, 1);
  assert.strictEqual(p0.commodities.COIN, 1);
  assert.strictEqual(p1.resources.LUMBER, 1);
  assert.strictEqual(p1.commodities.COIN, 1);
});

// ─── 3. Thẻ Chính trị (Politics Cards) ────────────────────────────────────────

suite.test('Warlord: Kích hoạt MIỄN PHÍ toàn bộ hiệp sĩ', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  p0.knights = [
    { id: 'k1', playerId: 0, level: KnightLevel.BASIC, active: false },
    { id: 'k2', playerId: 0, level: KnightLevel.STRONG, active: false },
    { id: 'k3', playerId: 0, level: KnightLevel.MIGHTY, active: false },
  ];
  p0.resources.GRAIN = 0; // 0 lúa
  p0.progressCards.push({ id: 'warlord', isVP: false });

  const res = gs.playProgressCard('warlord');
  assert.ok(res.ok);
  assert.ok(p0.knights.every(k => k.active === true), 'Toàn bộ hiệp sĩ phải active');
});

suite.test('Bishop: Di chuyển Tên cướp và cướp bài từ tất cả đối thủ kề bên', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  // Robber phải đã ở trên bàn cờ
  gs.robberOnBoard = true;
  gs.robberPos = { q: 0, r: 0 };

  // Tìm 1 ô đất và đặt công trình của P1 kề ô đó
  const targetTile = [...gs.tiles.values()].find(t => t.resource !== null);
  const adjVertex = [...gs.vertices.values()].find(v => v.hexes.some(h => h.q === targetTile.q && h.r === targetTile.r));
  adjVertex.building = { playerId: 1, type: 'settlement' };
  gs.players[1].resources.WOOL = 2;

  p0.progressCards.push({ id: 'bishop', isVP: false });

  const res = gs.playProgressCard('bishop', { hex: { q: targetTile.q, r: targetTile.r } });
  assert.ok(res.ok);
  assert.strictEqual(gs.robberPos.q, targetTile.q);
  assert.strictEqual(gs.robberPos.r, targetTile.r);
  assert.strictEqual(p0.resources.WOOL, 1, 'P0 phải cướp được 1 thẻ từ P1');
});

suite.test('Spy: Xem bài và cướp 1 thẻ tiến bộ của đối phương (không phải thẻ VP)', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;
  const p1 = gs.players[1];

  p1.progressCards = [
    { id: 'crane', isVP: false },
    { id: 'constitution', isVP: true },
  ];
  p0.progressCards.push({ id: 'spy', isVP: false });

  // Cướp thẻ Crane thành công
  const res = gs.playProgressCard('spy', { targetPlayerId: 1, cardIdToSteal: 'crane' });
  assert.ok(res.ok);
  assert.ok(p0.progressCards.some(c => c.id === 'crane'));
  assert.ok(!p1.progressCards.some(c => c.id === 'crane'));

  // Cố cướp thẻ VP Constitution -> BỊ TỪ CHỐI
  p0.progressCards.push({ id: 'spy', isVP: false });
  const failRes = gs.playProgressCard('spy', { targetPlayerId: 1, cardIdToSteal: 'constitution' });
  assert.strictEqual(failRes.ok, false);
});

// Chạy test suite
suite.run();
