/**
 * m3_improvements_metropolis.test.js — Kiểm tra Milestone 3
 *
 * Kiểm tra:
 * 1. Mua nâng cấp cấp 1-5 theo đúng hàng hóa của từng nhánh (Trade: Cloth, Politics: Coin, Science: Paper)
 * 2. Chi phí cấp N = N hàng hóa
 * 3. Không thể mua nâng cấp nếu không có thành phố nào trên bàn
 * 4. Không thể bỏ qua cấp độ (tuần tự 1 -> 2 -> 3 -> 4 -> 5)
 * 5. Thẻ Crane: giảm 1 hàng hóa (cấp 1 thành miễn phí)
 * 6. Người đầu tiên đạt Cấp 4 nhận Đại đô thị (+2 VP)
 * 7. Cướp Đại đô thị: Người chơi khác đạt Cấp 5 cướp Metropolis từ người giữ chỉ ở Cấp 4
 * 8. Giữ Đại đô thị: Nếu người giữ cũng đạt Cấp 5 thì không bị cướp
 * 9. Không thể mua Cấp 4/5 nếu không có thành phố trống (chưa có Metropolis)
 * 10. Miễn nhiễm cướp phá (isCityImmuneToPillage) cho thành phố có Metropolis
 * 11. Xây dựng Tường thành (City Wall): Chi phí 2 Gạch, max 3 tường, tăng hand limit
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { CKGameState } from '../src/gameplay/CKGameState.js';
import { Phase } from '../src/gameplay/GameState.js';
import { ImprovementTrack } from '../shared/ck_constants.js';

const suite = new TestSuite('Milestone 3: City Improvements, Metropolis & Walls');

// ─── 1. Chi phí & Điều kiện nâng cấp ──────────────────────────────────────────

suite.test('Không thể mua nâng cấp nếu không có Thành phố trên bàn', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p = gs.currentPlayer;

  p.placed.cities = []; // Không có thành phố
  p.commodities.CLOTH = 10;

  const res = gs.buyImprovement(ImprovementTrack.TRADE);
  assert.strictEqual(res.ok, false);
  assert.ok(res.reason.includes('thành phố'));
});

suite.test('Mua nâng cấp tuần tự Cấp 1, 2, 3 với đúng loại và số lượng hàng hóa', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p = gs.currentPlayer;

  // Cấp cho P0 1 thành phố
  p.placed.cities = ['vCity1'];

  // Nhánh Science dùng PAPER (Giấy)
  p.commodities.PAPER = 6; // 1 + 2 + 3 = 6
  assert.strictEqual(p.improvements.science, 0);

  // Mua Cấp 1 (tốn 1 Giấy)
  const res1 = gs.buyImprovement(ImprovementTrack.SCIENCE);
  assert.ok(res1.ok);
  assert.strictEqual(p.improvements.science, 1);
  assert.strictEqual(p.commodities.PAPER, 5);

  // Mua Cấp 2 (tốn 2 Giấy)
  const res2 = gs.buyImprovement(ImprovementTrack.SCIENCE);
  assert.ok(res2.ok);
  assert.strictEqual(p.improvements.science, 2);
  assert.strictEqual(p.commodities.PAPER, 3);

  // Mua Cấp 3 (tốn 3 Giấy)
  const res3 = gs.buyImprovement(ImprovementTrack.SCIENCE);
  assert.ok(res3.ok);
  assert.strictEqual(p.improvements.science, 3);
  assert.strictEqual(p.commodities.PAPER, 0);

  // Không đủ hàng hóa mua Cấp 4
  const res4 = gs.buyImprovement(ImprovementTrack.SCIENCE);
  assert.strictEqual(res4.ok, false);
});

suite.test('Thẻ Crane giảm 1 hàng hóa (Cấp 1 thành miễn phí)', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p = gs.currentPlayer;

  p.placed.cities = ['vCity1'];
  p.improvements.politics = 0;
  p.commodities.COIN = 0; // 0 đồng xu

  // Mua Cấp 1 dùng Crane: tốn 0 đồng xu
  const res = gs.buyImprovement(ImprovementTrack.POLITICS, { useCrane: true });
  assert.ok(res.ok);
  assert.strictEqual(p.improvements.politics, 1);
  assert.strictEqual(p.commodities.COIN, 0);
  assert.strictEqual(p.craneUsedThisTurn, true);
});

// ─── 2. Cơ chế Đại đô thị (Metropolis) ────────────────────────────────────────

suite.test('Người đầu tiên đạt Cấp 4 nhận Đại đô thị (+2 VP)', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p = gs.currentPlayer;

  p.placed.cities = ['vCity1'];
  p.improvements.trade = 3;
  p.commodities.CLOTH = 4;
  p.recalcPublicVP();

  const vpBefore = p.victoryPoints;
  const res = gs.buyImprovement(ImprovementTrack.TRADE);

  assert.ok(res.ok);
  assert.strictEqual(p.improvements.trade, 4);
  assert.strictEqual(res.metropolisAwarded, true);
  assert.strictEqual(gs.metropolisOwner.trade, p.id);
  assert.strictEqual(p.metropolises.length, 1);
  assert.strictEqual(p.metropolises[0].track, 'trade');
  assert.strictEqual(p.metropolises[0].vertexKey, 'vCity1');

  // Metropolis cộng +2 VP
  assert.strictEqual(p.victoryPoints, vpBefore + 2);
  // Thành phố có Metropolis được miễn nhiễm cướp phá
  assert.strictEqual(gs.isCityImmuneToPillage('vCity1'), true);
});

suite.test('Cướp Đại đô thị: P1 đạt Cấp 5 cướp Metropolis từ P0 đang ở Cấp 4', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  const p0 = gs.players[0];
  const p1 = gs.players[1];

  p0.placed.cities = ['vCity0'];
  p0.improvements.science = 4;
  p0.metropolises = [{ track: 'science', vertexKey: 'vCity0' }];
  gs.metropolisOwner.science = p0.id;
  p0.recalcPublicVP();

  const p0VPBefore = p0.victoryPoints;

  // Chuyển lượt sang P1
  gs.currentPlayerIndex = 1;
  p1.placed.cities = ['vCity1'];
  p1.improvements.science = 4;
  p1.commodities.PAPER = 5;
  p1.recalcPublicVP();

  const p1VPBefore = p1.victoryPoints;

  // P1 mua Cấp 5 Science (5 Giấy) -> CƯỚP Metropolis!
  const res = gs.buyImprovement(ImprovementTrack.SCIENCE);
  assert.ok(res.ok);
  assert.strictEqual(res.metropolisStolen, true);

  // P0 mất Metropolis (-2 VP)
  assert.strictEqual(p0.metropolises.length, 0);
  assert.strictEqual(p0.victoryPoints, p0VPBefore - 2);
  assert.strictEqual(gs.isCityImmuneToPillage('vCity0'), false);

  // P1 nhận Metropolis (+2 VP)
  assert.strictEqual(gs.metropolisOwner.science, p1.id);
  assert.strictEqual(p1.metropolises.length, 1);
  assert.strictEqual(p1.metropolises[0].vertexKey, 'vCity1');
  assert.strictEqual(p1.victoryPoints, p1VPBefore + 2);
  assert.strictEqual(gs.isCityImmuneToPillage('vCity1'), true);
});

suite.test('Người giữ Metropolis ở Cấp 5 KHÔNG bị cướp', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  const p0 = gs.players[0];
  const p1 = gs.players[1];

  // P0 đã đạt Cấp 5 và giữ Metropolis
  p0.placed.cities = ['vCity0'];
  p0.improvements.politics = 5;
  p0.metropolises = [{ track: 'politics', vertexKey: 'vCity0' }];
  gs.metropolisOwner.politics = p0.id;

  // P1 cũng lên Cấp 5
  gs.currentPlayerIndex = 1;
  p1.placed.cities = ['vCity1'];
  p1.improvements.politics = 4;
  p1.commodities.COIN = 5;

  const res = gs.buyImprovement(ImprovementTrack.POLITICS);
  assert.ok(res.ok);
  assert.strictEqual(res.metropolisStolen, false, 'Không thể cướp từ người chơi đã ở Cấp 5');
  assert.strictEqual(gs.metropolisOwner.politics, p0.id, 'P0 vẫn giữ Metropolis');
});

suite.test('Không có thành phố trống chặn mua Cấp 4/5', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  // P0 chỉ có 1 thành phố và đã gắn Metropolis Trade
  p0.placed.cities = ['vCitySingle'];
  p0.improvements.trade = 4;
  p0.metropolises = [{ track: 'trade', vertexKey: 'vCitySingle' }];
  gs.metropolisOwner.trade = p0.id;

  // P0 muốn mua Cấp 4 Science (cần gắn thêm 1 Metropolis nhưng không còn thành phố trống)
  p0.improvements.science = 3;
  p0.commodities.PAPER = 4;

  const res = gs.buyImprovement(ImprovementTrack.SCIENCE);
  assert.strictEqual(res.ok, false);
  assert.ok(res.reason.includes('thành phố trống'));
});

// ─── 3. Tường thành (City Walls) ──────────────────────────────────────────────

suite.test('Xây dựng Tường thành: Chi phí 2 Gạch, tăng hand limit, tối đa 3 tường', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  // Lấy 2 vertex thực tế trên bàn
  const [vKeyA, vKeyB] = [...gs.vertices.keys()].slice(0, 2);

  // Đặt 2 thành phố trên bàn
  p0.placed.cities = [vKeyA, vKeyB];
  gs.vertices.get(vKeyA).building = { playerId: 0, type: 'city' };
  gs.vertices.get(vKeyB).building = { playerId: 0, type: 'city' };

  p0.resources.BRICK = 4;
  assert.strictEqual(p0.getHandLimit(), 7);

  // Xây tường thành tại vKeyA
  const res1 = gs.buildCityWall(vKeyA);
  assert.ok(res1.ok);
  assert.strictEqual(p0.cityWalls.length, 1);
  assert.strictEqual(p0.resources.BRICK, 2);
  assert.strictEqual(p0.getHandLimit(), 9);

  // Không thể xây trùng vào vKeyA
  const resDuplicate = gs.buildCityWall(vKeyA);
  assert.strictEqual(resDuplicate.ok, false);

  // Xây tường thành tại vKeyB
  const res2 = gs.buildCityWall(vKeyB);
  assert.ok(res2.ok);
  assert.strictEqual(p0.cityWalls.length, 2);
  assert.strictEqual(p0.resources.BRICK, 0);
  assert.strictEqual(p0.getHandLimit(), 11);

});

// Chạy test suite
suite.run();
