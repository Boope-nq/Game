/**
 * m1_setup.test.js — Kiểm tra Milestone 1: Data Model & Setup
 * 
 * Kiểm tra:
 * 1. CKPlayer: khởi tạo, commodities, handLimit, totalCards
 * 2. CKRulesConfig: magic numbers, cấu hình luật
 * 3. CKProgressCards: pool 54 thẻ, 3 deck × 18 thẻ
 * 4. CKGameState: khởi tạo, 13 VP, tắt dev cards, Robber ở ngoài bàn
 * 5. Setup Round 1: đặt Settlement + Road
 * 6. Setup Round 2: đặt CITY + Road (không phải settlement!)
 * 7. Starting resources: nhận tài nguyên cơ bản (không nhân đôi, không hàng hóa)
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { CKPlayer } from '../src/entities/CKPlayer.js';
import { CK_CONFIG, handLimit } from '../src/gameplay/CKRulesConfig.js';
import { buildAllProgressDecks, validateDeckSizes } from '../src/gameplay/CKProgressCards.js';
import { CKGameState } from '../src/gameplay/CKGameState.js';
import { Phase } from '../src/gameplay/GameState.js';

const suite = new TestSuite('Milestone 1: Data Model & Setup');

// ─── 1. CKPlayer Entity ───────────────────────────────────────────────────────

suite.test('CKPlayer khởi tạo đầy đủ thuộc tính Cities & Knights', () => {
  const p = new CKPlayer(0, 'Người chơi 1');
  
  // Hàng hóa bắt đầu bằng 0
  assert.strictEqual(p.commodities.PAPER, 0);
  assert.strictEqual(p.commodities.CLOTH, 0);
  assert.strictEqual(p.commodities.COIN, 0);

  // Nâng cấp thành phố bắt đầu ở cấp 0
  assert.strictEqual(p.improvements.trade, 0);
  assert.strictEqual(p.improvements.politics, 0);
  assert.strictEqual(p.improvements.science, 0);

  // Kho hiệp sĩ
  assert.strictEqual(p.knightSupply.basic, 2);
  assert.strictEqual(p.knightSupply.strong, 2);
  assert.strictEqual(p.knightSupply.mighty, 2);
  assert.strictEqual(p.knights.length, 0);

  // Tường thành
  assert.strictEqual(p.wallStock, 3);
  assert.strictEqual(p.cityWalls.length, 0);

  // Giới hạn cầm bài ban đầu = 7
  assert.strictEqual(p.getHandLimit(), 7);

  // Không có dev cards từ base game
  assert.strictEqual(p.devCards.length, 0);
});

suite.test('CKPlayer: Tường thành tăng giới hạn bài (+2 mỗi tường, tối đa 3 tường = 13)', () => {
  const p = new CKPlayer(0, 'Người chơi 1');
  assert.strictEqual(p.getHandLimit(), 7);

  p.cityWalls.push('v1');
  assert.strictEqual(p.getHandLimit(), 9);

  p.cityWalls.push('v2');
  assert.strictEqual(p.getHandLimit(), 11);

  p.cityWalls.push('v3');
  assert.strictEqual(p.getHandLimit(), 13);
});

suite.test('CKPlayer: totalCards() tính cả tài nguyên và hàng hóa (không tính thẻ tiến bộ)', () => {
  const p = new CKPlayer(0, 'Người chơi 1');
  p.resources.LUMBER = 3;
  p.resources.BRICK = 2;
  p.commodities.PAPER = 2;
  p.commodities.COIN = 1;

  // Thêm thẻ tiến bộ - không được tính vào totalCards
  p.progressCards.push({ id: 'crane', isVP: false });

  assert.strictEqual(p.totalCards(), 8); // 3 + 2 + 2 + 1 = 8
});

// ─── 2. CKRulesConfig ────────────────────────────────────────────────────────

suite.test('CKRulesConfig: Magic numbers chính xác theo luật Catan C&K 5th Edition', () => {
  assert.strictEqual(CK_CONFIG.WIN_VP, 13);
  assert.strictEqual(CK_CONFIG.HAND_LIMIT_BASE, 7);
  assert.strictEqual(CK_CONFIG.WALL_LIMIT_BONUS, 2);
  assert.strictEqual(CK_CONFIG.MAX_WALLS_PER_PLAYER, 3);
  assert.strictEqual(CK_CONFIG.PROGRESS_HAND_LIMIT, 4);
  assert.strictEqual(CK_CONFIG.barbarianSteps, 7);
  assert.strictEqual(CK_CONFIG.COMMODITY_SUPPLY, 12);
  assert.strictEqual(CK_CONFIG.MAX_IMPROVEMENT_LEVEL, 5);
  assert.strictEqual(CK_CONFIG.METROPOLIS_LEVEL, 4);
});

// ─── 3. Progress Card Pool ────────────────────────────────────────────────────

suite.test('CKProgressCards: Chuẩn xác 54 thẻ (18 Khoa học, 18 Thương mại, 18 Chính trị)', () => {
  const decks = buildAllProgressDecks();
  assert.strictEqual(decks.science.length, 18, 'Deck Khoa học phải có 18 thẻ');
  assert.strictEqual(decks.trade.length, 18, 'Deck Thương mại phải có 18 thẻ');
  assert.strictEqual(decks.politics.length, 18, 'Deck Chính trị phải có 18 thẻ');
  assert.doesNotThrow(() => validateDeckSizes(decks));
});

// ─── 4. CKGameState Khởi tạo ─────────────────────────────────────────────────

suite.test('CKGameState: Khởi tạo bàn chơi C&K chuẩn xác', () => {
  const gs = new CKGameState(3, ['An', 'Bình', 'Chi'], 12345);

  assert.strictEqual(gs.ruleset, 'cities_knights');
  assert.strictEqual(gs.winningVP, 13, 'Điểm thắng phải là 13 VP');
  assert.strictEqual(gs.devCardDeck.length, 0, 'Dev card deck của base game phải bị vô hiệu hóa');
  assert.strictEqual(gs.largestArmyOwner, null, 'Không có danh hiệu Đạo quân lớn nhất');

  // Robber ở NGOÀI bàn chơi ban đầu
  assert.strictEqual(gs.robberOnBoard, false, 'Tên cướp phải ở ngoài bàn');
  assert.strictEqual(gs.robberPos, null, 'Tên cướp không nằm trên bất kỳ ô nào');

  // Thuyền man rợ bắt đầu ở vị trí 0
  assert.strictEqual(gs.barbarianPosition, 0);

  // 3 bộ bài tiến bộ đã được xáo và sẵn sàng
  assert.strictEqual(gs.progressDecks.science.length, 18);
  assert.strictEqual(gs.progressDecks.trade.length, 18);
  assert.strictEqual(gs.progressDecks.politics.length, 18);

  // Người chơi là instance của CKPlayer
  assert.ok(gs.players[0] instanceof CKPlayer);
});

// ─── 5. Setup Round 1 & Round 2 ──────────────────────────────────────────────

suite.test('CKGameState: Setup Vòng 1 đặt Settlement + Road, Vòng 2 đặt CITY + Road', () => {
  const gs = new CKGameState(3, ['An', 'Bình', 'Chi'], 12345);

  // ── VÒNG 1: P0 đặt Settlement + Road ──
  assert.strictEqual(gs.phase, Phase.SETUP_SETTLEMENT);
  assert.strictEqual(gs.currentPlayerIndex, 0);
  assert.strictEqual(gs.setupRound, 1);

  const validVertices = gs.getValidSetupVertices();
  assert.ok(validVertices.length > 0);
  const v1 = validVertices[0];

  const res1 = gs.setupPlaceSettlement(v1);
  assert.ok(res1.ok, 'Vòng 1 đặt Settlement phải thành công');
  assert.strictEqual(gs.vertices.get(v1).building.type, 'settlement', 'Phải là settlement ở vòng 1');
  assert.strictEqual(gs.players[0].placed.settlements.length, 1);

  const validRoads = gs.getValidRoadEdges(true, v1);
  assert.ok(validRoads.length > 0);
  const r1 = validRoads[0];
  const resRoad1 = gs.setupPlaceRoadOrShip(r1, 'road');
  assert.ok(resRoad1.ok);

  // Chuyển sang P1
  assert.strictEqual(gs.currentPlayerIndex, 1);

  // Giả lập hoàn thành vòng 1 cho P1, P2
  const v2 = gs.getValidSetupVertices()[0];
  gs.setupPlaceSettlement(v2);
  gs.setupPlaceRoadOrShip(gs.getValidRoadEdges(true, v2)[0], 'road');

  const v3 = gs.getValidSetupVertices()[0];
  gs.setupPlaceSettlement(v3);
  gs.setupPlaceRoadOrShip(gs.getValidRoadEdges(true, v3)[0], 'road');

  // ── VÒNG 2: Bắt đầu từ P2 (thứ tự ngược) ──
  assert.strictEqual(gs.setupRound, 2, 'Phải chuyển sang vòng 2');
  assert.strictEqual(gs.currentPlayerIndex, 2, 'Vòng 2 bắt đầu từ người chơi cuối (P2)');

  // P2 đặt công trình ở Vòng 2 -> PHẢI LÀ THÀNH PHỐ (CITY)!
  const vCity = gs.getValidSetupVertices()[0];
  const resCity = gs.setupPlaceSettlement(vCity);
  assert.ok(resCity.ok, 'Vòng 2 đặt công trình phải thành công');

  const building = gs.vertices.get(vCity).building;
  assert.strictEqual(building.type, 'city', 'Vòng 2 BẮT BUỘC đặt Thành phố (CITY), không phải Định cư!');
  assert.strictEqual(gs.players[2].placed.cities.length, 1, 'P2 phải có 1 thành phố');
  assert.strictEqual(gs.players[2].stock.cities, 3, 'Kho thành phố của P2 còn 3 (bắt đầu là 4)');

  // Tài nguyên ban đầu vòng 2: Chỉ nhận tài nguyên cơ bản, không có hàng hóa
  const p2 = gs.players[2];
  const comSum = p2.commodities.PAPER + p2.commodities.CLOTH + p2.commodities.COIN;
  assert.strictEqual(comSum, 0, 'Setup vòng 2 KHÔNG ĐƯỢC nhận hàng hóa (commodities)');
  
  const totalRes = Object.values(p2.resources).reduce((a, b) => a + b, 0);
  assert.ok(totalRes > 0, 'P2 phải nhận được tài nguyên từ các ô liền kề thành phố vòng 2');
});

// Chạy test suite
suite.run();
