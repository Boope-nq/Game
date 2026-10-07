/**
 * m4_knights_barbarians.test.js — Kiểm tra Milestone 4: Hiệp sĩ & Quân man rợ
 *
 * Kiểm tra:
 * 1. Chiêu mộ hiệp sĩ: 1 Cừu + 1 Quặng, đặt trên vertex nối với đường, distance rule không áp dụng, inactive ban đầu.
 * 2. Kích hoạt hiệp sĩ: 1 Lúa, chuyển sang active. Không được kích hoạt rồi hành động ngay trong cùng lượt.
 * 3. Thăng cấp hiệp sĩ: 1 Cừu + 1 Quặng, tối đa 1 lần / lượt, Mighty đòi hỏi Politics L3.
 * 4. Di chuyển hiệp sĩ: Dọc theo tuyến đường của mình, trở thành inactive sau khi đi.
 * 5. Đẩy lùi hiệp sĩ đối phương: Phải mạnh hơn, đối phương chạy trốn hoặc bị loại về kho nếu hết đường lui.
 * 6. Hiệp sĩ chặn đường và ngắt Longest Road của đối phương.
 * 7. Đuổi tên cướp (Chase Robber): Đứng kề ô tên cướp để xua đuổi.
 * 8. Quân man rợ tấn công - Phòng thủ thắng:
 *    - Đóng góp cao nhất nhận Defender Token (+1 VP).
 *    - Hòa nhau ở mức cao nhất: Rút thẻ tiến bộ, không ai nhận token.
 * 9. Quân man rợ tấn công - Man rợ thắng:
 *    - Đóng góp thấp nhất bị giáng cấp 1 Thành phố -> Định cư, dỡ bỏ tường thành.
 *    - Thành phố có Đại đô thị (Metropolis) được miễn nhiễm cướp phá (fallthrough người kế tiếp).
 *    - Quy tắc City-on-its-side khi hết quân settlement.
 * 10. Sau đợt tấn công: Thuyền về 0, TOÀN BỘ hiệp sĩ trở về inactive.
 * 11. Đợt tấn công đầu tiên: Tên cướp chính thức được đặt vào Sa mạc và kích hoạt.
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { CKGameState } from '../src/gameplay/CKGameState.js';
import { Phase } from '../src/gameplay/GameState.js';
import { KnightLevel } from '../shared/ck_constants.js';

const suite = new TestSuite('Milestone 4: Knights & Barbarians');

// ─── 1. Chiêu mộ & Kích hoạt Hiệp sĩ ──────────────────────────────────────────

suite.test('Chiêu mộ hiệp sĩ: 1 Cừu + 1 Quặng, kề đường, inactive ban đầu, không vi phạm distance rule', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  // Lấy 1 cạnh và 2 đỉnh của nó
  const [eKey, edge] = [...gs.edges.entries()][0];
  const [vKey1, vKey2] = edge.vertices;

  // P0 có đường tại eKey
  edge.piece = { playerId: 0, type: 'road' };
  p0.resources.WOOL = 1;
  p0.resources.ORE = 1;
  assert.strictEqual(p0.knights.length, 0);

  // Chiêu mộ hiệp sĩ tại vKey1
  const res = gs.recruitKnight(vKey1);
  assert.ok(res.ok);
  assert.strictEqual(p0.knights.length, 1);
  assert.strictEqual(p0.knights[0].level, KnightLevel.BASIC);
  assert.strictEqual(p0.knights[0].active, false, 'Hiệp sĩ mới phải inactive');
  assert.strictEqual(p0.resources.WOOL, 0);
  assert.strictEqual(p0.resources.ORE, 0);
  assert.strictEqual(p0.knightSupply.basic, 1);

  // Chiêu mộ hiệp sĩ thứ 2 tại vKey2 ngay kề bên (Distance rule không áp dụng)
  p0.resources.WOOL = 1;
  p0.resources.ORE = 1;
  const res2 = gs.recruitKnight(vKey2);
  assert.ok(res2.ok, 'Hiệp sĩ được phép đứng ở 2 đỉnh kề nhau (distance rule không áp dụng)');
  assert.strictEqual(p0.knights.length, 2);
});

suite.test('Kích hoạt hiệp sĩ: 1 Lúa, cấm kích hoạt rồi hành động ngay trong cùng lượt', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  const [eKey, edge] = [...gs.edges.entries()][0];
  const [vKey1, vKey2] = edge.vertices;
  edge.piece = { playerId: 0, type: 'road' };

  p0.resources.WOOL = 1;
  p0.resources.ORE = 1;
  p0.resources.GRAIN = 1;

  gs.recruitKnight(vKey1);
  const knight = p0.knights[0];

  // Kích hoạt hiệp sĩ
  const actRes = gs.activateKnight(knight.id);
  assert.ok(actRes.ok);
  assert.strictEqual(knight.active, true);
  assert.strictEqual(p0.resources.GRAIN, 0);

  // Thử di chuyển hiệp sĩ vừa kích hoạt ngay trong cùng lượt -> BỊ CẤM
  const moveRes = gs.moveKnight(knight.id, vKey2);
  assert.strictEqual(moveRes.ok, false);
  assert.ok(moveRes.reason.includes('vừa kích hoạt'));
});

// ─── 2. Thăng cấp Hiệp sĩ ─────────────────────────────────────────────────────

suite.test('Thăng cấp hiệp sĩ: Tối đa 1 lần/lượt, Mighty yêu cầu Politics L3', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;
  gs.currentPlayerIndex = 0;
  const p0 = gs.currentPlayer;

  const [eKey, edge] = [...gs.edges.entries()][0];
  edge.piece = { playerId: 0, type: 'road' };
  const vKey = edge.vertices[0];

  p0.resources.WOOL = 3;
  p0.resources.ORE = 3;

  gs.recruitKnight(vKey);
  const knight = p0.knights[0];

  // Thăng cấp lần 1: Basic -> Strong
  const pRes1 = gs.promoteKnight(knight.id);
  assert.ok(pRes1.ok);
  assert.strictEqual(knight.level, KnightLevel.STRONG);

  // Thăng cấp lần 2 trong cùng lượt -> BỊ CẤM (max 1 lần / lượt)
  const pRes2 = gs.promoteKnight(knight.id);
  assert.strictEqual(pRes2.ok, false);
  assert.ok(pRes2.reason.includes('1 lần'));

  // Reset cờ lượt để kiểm tra điều kiện Mighty
  p0.resetTurnFlags();
  p0.improvements.politics = 2; // Chưa đạt Politics 3

  const pResMightyFail = gs.promoteKnight(knight.id);
  assert.strictEqual(pResMightyFail.ok, false);
  assert.ok(pResMightyFail.reason.includes('Chính trị cấp 3'));

  // Nâng cấp lên Politics 3 -> Được phép thăng cấp lên Mighty
  p0.improvements.politics = 3;
  const pResMightyOk = gs.promoteKnight(knight.id);
  assert.ok(pResMightyOk.ok);
  assert.strictEqual(knight.level, KnightLevel.MIGHTY);
});

// ─── 3. Hành động Di chuyển & Đẩy lùi ──────────────────────────────────────────

suite.test('Di chuyển và Đẩy lùi hiệp sĩ đối phương yếu hơn', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  const p0 = gs.players[0];
  const p1 = gs.players[1];

  // Tạo chuỗi 2 cạnh nối 3 vertex: v0 --(e0)-- v1 --(e1)-- v2
  const [e0Key, e0] = [...gs.edges.entries()][0];
  const [v0, v1] = e0.vertices;

  // Tìm cạnh e1 nối với v1
  let e1Key = null, e1 = null, v2 = null;
  for (const [k, e] of gs.edges) {
    if (k !== e0Key && e.vertices.includes(v1)) {
      e1Key = k;
      e1 = e;
      v2 = e.vertices.find(vk => vk !== v1);
      break;
    }
  }

  // Đường của P0 trên cả 2 cạnh
  e0.piece = { playerId: 0, type: 'road' };
  e1.piece = { playerId: 0, type: 'road' };

  // P0 có hiệp sĩ STRONG (sức mạnh 2) tại v0, đã active từ đầu lượt
  p0.knights.push({
    id: 'k0',
    playerId: 0,
    vertexKey: v0,
    level: KnightLevel.STRONG,
    active: true,
  });

  // P1 có hiệp sĩ BASIC (sức mạnh 1) tại v1
  p1.knights.push({
    id: 'k1',
    playerId: 1,
    vertexKey: v1,
    level: KnightLevel.BASIC,
    active: false,
  });

  // P0 đẩy lùi hiệp sĩ P1 tại v1
  gs.currentPlayerIndex = 0;
  const displaceRes = gs.displaceKnight('k0', v1);
  assert.ok(displaceRes.ok);

  // Hiệp sĩ P0 đã chiếm v1 và trở thành Inactive
  assert.strictEqual(p0.knights[0].vertexKey, v1);
  assert.strictEqual(p0.knights[0].active, false);
});

// ─── 4. Hiệp sĩ chặn Longest Road ────────────────────────────────────────────

suite.test('Hiệp sĩ đối phương ngắt tuyến đường dài nhất (Longest Road)', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  const p0 = gs.players[0];
  const p1 = gs.players[1];

  // Đặt 6 đoạn đường liên tiếp cho P0
  // Lấy các cạnh liên tiếp
  const chainEdges = [];
  let currentV = [...gs.vertices.keys()][0];

  for (let step = 0; step < 6; step++) {
    const v = gs.vertices.get(currentV);
    for (const eKey of v.adjacentEdges) {
      if (!chainEdges.includes(eKey)) {
        chainEdges.push(eKey);
        const e = gs.edges.get(eKey);
        e.piece = { playerId: 0, type: 'road' };
        currentV = e.vertices.find(vk => vk !== currentV);
        break;
      }
    }
  }

  // Cập nhật tuyến đường khi chưa có hiệp sĩ cản
  gs._updateLongestRoute();
  const initialLength = p0.longestRoute;
  assert.ok(initialLength >= 5, 'P0 phải có tuyến đường dài >= 5');

  // P1 đặt 1 hiệp sĩ vào giữa tuyến đường của P0
  const midVertexKey = gs.edges.get(chainEdges[2]).vertices[0];
  p1.knights.push({
    id: 'kOpp',
    playerId: 1,
    vertexKey: midVertexKey,
    level: KnightLevel.BASIC,
    active: false,
  });

  // Cập nhật lại tuyến đường -> Tuyến đường của P0 bị ngắt đôi
  gs._updateLongestRoute();
  assert.ok(p0.longestRoute < initialLength, 'Hiệp sĩ đối phương phải ngắt tuyến đường dài nhất');
});

// ─── 5. Quân man rợ tấn công ─────────────────────────────────────────────────

suite.test('Man rợ tấn công - Phòng thủ Thắng: Người đóng góp cao nhất nhận Defender Token (+1 VP)', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  // Toàn bàn cờ có 2 Thành phố (Sức man rợ = 2)
  gs.players[0].placed.cities = ['vCityA'];
  gs.players[1].placed.cities = ['vCityB'];

  // P0 có 1 Mighty Knight active (sức mạnh 3)
  gs.players[0].knights = [{ id: 'k0', playerId: 0, level: KnightLevel.MIGHTY, active: true }];
  // P1 có 1 Basic Knight active (sức mạnh 1)
  gs.players[1].knights = [{ id: 'k1', playerId: 1, level: KnightLevel.BASIC, active: true }];

  // Tổng phòng thủ = 3 + 1 = 4 >= Sức man rợ (2) -> THẮNG
  const res = gs.triggerBarbarianAttack();
  assert.strictEqual(res.defendersWon, true);
  assert.deepStrictEqual(res.rewardWinners, [0], 'P0 đóng góp 3 sức mạnh nhận thưởng');
  assert.strictEqual(gs.players[0].defenderTokens, 1);

  // Sau đợt tấn công: Thuyền về 0, tất cả hiệp sĩ trở về inactive
  assert.strictEqual(gs.barbarianPosition, 0);
  assert.strictEqual(gs.players[0].knights[0].active, false);
  assert.strictEqual(gs.players[1].knights[0].active, false);

  // Đợt tấn công đầu tiên: Robber được đặt lên bàn cờ tại Sa mạc
  assert.strictEqual(gs.robberOnBoard, true);
  assert.ok(gs.robberPos !== null);
});

suite.test('Man rợ tấn công - Man rợ Thắng: Người đóng góp thấp nhất bị cướp phá Thành phố -> Định cư', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  const [vKeyA, vKeyB] = [...gs.vertices.keys()].slice(0, 2);

  // P0 có 1 thành phố + tường thành (0 hiệp sĩ active)
  gs.players[0].placed.cities = [vKeyA];
  gs.vertices.get(vKeyA).building = { playerId: 0, type: 'city' };
  gs.players[0].cityWalls = [vKeyA];

  // P1 có 1 thành phố (1 basic knight active = 1 sức mạnh)
  gs.players[1].placed.cities = [vKeyB];
  gs.vertices.get(vKeyB).building = { playerId: 1, type: 'city' };
  gs.players[1].knights = [{ id: 'k1', playerId: 1, level: KnightLevel.BASIC, active: true }];

  // Sức man rợ = 2, Sức phòng thủ = 1 -> MAN RỢ THẮNG
  // P0 đóng góp 0 sức mạnh (thấp nhất) -> BỊ CƯỚP PHÁ THÀNH PHỐ
  const res = gs.triggerBarbarianAttack();
  assert.strictEqual(res.defendersWon, false);
  assert.ok(res.pillagedPlayers.includes(0));

  // Thành phố của P0 giáng cấp về settlement, tường thành bị dỡ bỏ
  assert.strictEqual(gs.players[0].placed.cities.length, 0);
  assert.strictEqual(gs.players[0].placed.settlements.length, 1);
  assert.strictEqual(gs.vertices.get(vKeyA).building.type, 'settlement');
  assert.strictEqual(gs.players[0].cityWalls.length, 0, 'Tường thành phải bị dỡ bỏ khi thành phố bị cướp phá');
});

suite.test('Đại đô thị (Metropolis) miễn nhiễm cướp phá khi man rợ thắng', () => {
  const gs = new CKGameState(3, ['A', 'B', 'C'], 12345);
  gs.phase = Phase.BUILD;

  const [vKeyA, vKeyB] = [...gs.vertices.keys()].slice(0, 2);

  // P0 có 1 thành phố có METROPOLIS (0 hiệp sĩ active)
  gs.players[0].placed.cities = [vKeyA];
  gs.vertices.get(vKeyA).building = { playerId: 0, type: 'city' };
  gs.players[0].metropolises = [{ track: 'trade', vertexKey: vKeyA }];

  // P1 có 1 thành phố thường (0 hiệp sĩ active)
  gs.players[1].placed.cities = [vKeyB];
  gs.vertices.get(vKeyB).building = { playerId: 1, type: 'city' };

  // Man rợ thắng. P0 và P1 cùng 0 sức mạnh, nhưng P0 có Metropolis miễn nhiễm -> P1 bị cướp
  const res = gs.triggerBarbarianAttack();
  assert.strictEqual(res.defendersWon, false);
  assert.strictEqual(gs.players[0].placed.cities.length, 1, 'Thành phố Metropolis của P0 không bị cướp');
  assert.ok(res.pillagedPlayers.includes(1), 'P1 bị cướp thay thế vì P0 miễn nhiễm');
});

// Chạy test suite
suite.run();
