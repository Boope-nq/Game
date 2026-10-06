/**
 * GameState.js — State machine hoàn chỉnh theo đúng nguyên tắc Catan: Seafarers
 *
 * Luật tham khảo từ catan.com + catanrulesguide.com + tabletopmonthly.com:
 *
 * SETUP:
 *  - 2 vòng setup (thuận + ngược)
 *  - Lượt 1: đặt Settlement + Road/Ship
 *  - Lượt 2: đặt Settlement + Road/Ship + nhận tài nguyên từ tile liền kề
 *  - Có thể chọn Ship thay vì Road nếu Settlement ven biển
 *
 * LUẬT CHƠI:
 *  - Tung 2 xúc xắc → phân phối tài nguyên / kích hoạt Robber(7)
 *  - Số 7: bỏ bài nếu >7, di chuyển Robber HOẶC Pirate
 *  - Thương lượng: ngân hàng 4:1, cảng 3:1/2:1, trao đổi với người chơi
 *  - Xây dựng: Settlement, City, Road, Ship, Dev Card
 *  - Chỉ chơi 1 Dev Card/lượt (không chơi thẻ vừa mua)
 *
 * SEAFARERS:
 *  - Pirate: chặn tàu, đặt trên biển, kích hoạt bởi 7/Knight
 *  - Ship: thay thế Road trên biển, có thể di chuyển 1 tàu/lượt
 *  - Gold Field: chọn tài nguyên tuỳ ý
 *  - Longest Trade Route (thay Longest Road): tính cả đường + tàu
 *  - Khám phá đảo: đặt Định cư đầu tiên trên đảo mới → +1 VP
 *
 * WINNING:
 *  - Kịch bản Voyages of Discovery: 13 VP
 *  - Kiểm tra sau mỗi hành động xây dựng
 */

import { Player, ResourceType, ALL_RESOURCES }  from '../entities/Player.js';
import { generateMap }                           from '../core/MapGenerator.js';
import { buildBoardGraph,
         isValidSettlementPlacement,
         isValidRoadPlacement,
         isValidShipPlacement,
         calcLongestTradeRoute,
         getMovableShips,
         getHarborAtVertex,
         makeEdgeKey }                           from '../core/BoardGraph.js';
import { hexKey }                                from '../core/HexGrid.js';
import { TileType }                              from '../core/HexTile.js';

// ─── Phase ───────────────────────────────────────────────────────────────────
export const Phase = Object.freeze({
  SETUP_SETTLEMENT: 'SETUP_SETTLEMENT',  // đặt định cư setup
  SETUP_ROAD:       'SETUP_ROAD',        // đặt đường/tàu setup (ngay sau định cư)
  ROLL:             'ROLL',
  ROBBER:           'ROBBER',            // di chuyển Robber hoặc Pirate
  STEAL:            'STEAL',             // chọn người để cướp tài nguyên
  DISCARD:          'DISCARD',           // bỏ bài khi >7
  GOLD_PICK:        'GOLD_PICK',         // chọn tài nguyên từ Gold Field
  BUILD:            'BUILD',             // phase hành động (trade + build + move ship)
  GAME_OVER:        'GAME_OVER',
});

// ─── Chi phí xây dựng (nguyên tác) ──────────────────────────────────────────
export const BUILD_COST = Object.freeze({
  road:       { [ResourceType.BRICK]: 1, [ResourceType.LUMBER]: 1 },
  ship:       { [ResourceType.LUMBER]: 1, [ResourceType.WOOL]:  1 },
  settlement: {
    [ResourceType.BRICK]:  1, [ResourceType.LUMBER]: 1,
    [ResourceType.GRAIN]:  1, [ResourceType.WOOL]:   1,
  },
  city:       { [ResourceType.GRAIN]: 2, [ResourceType.ORE]: 3 },
  devCard:    { [ResourceType.GRAIN]: 1, [ResourceType.WOOL]: 1, [ResourceType.ORE]: 1 },
});

// ─── Thẻ phát triển (25 thẻ theo nguyên tác) ─────────────────────────────────
const DEV_CARD_POOL = [
  ...Array(14).fill('KNIGHT'),
  ...Array(5).fill('VP'),
  ...Array(2).fill('ROAD_BUILDING'),
  ...Array(2).fill('YEAR_OF_PLENTY'),
  ...Array(2).fill('MONOPOLY'),
];

function makePRNG(seed) {
  let s = (typeof seed === 'number' ? seed : 123456789) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str) {
  if (!str) return 123456789;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── GameState ────────────────────────────────────────────────────────────────
export class GameState {
  constructor(numPlayers = 3, playerNames = null, seed = null) {
    this.numPlayers = numPlayers;
    this.players    = Array.from({ length: numPlayers }, (_, i) =>
      new Player(i, playerNames?.[i] ?? `Người chơi ${i + 1}`)
    );

    // ── Bản đồ ──
    const mapData      = generateMap(seed);
    this.tiles         = mapData.tiles;
    this.harbors       = mapData.harbors;
    this.desertCoord   = mapData.desertCoord;
    this.mainIslandCoords  = mapData.mainIslandCoords;
    this.smallIslandCoords = mapData.smallIslandCoords;

    // ── Đồ thị bàn chơi ──
    const graph       = buildBoardGraph(this.tiles);
    this.vertices     = graph.vertices;  // Map<vKey, Vertex>
    this.edges        = graph.edges;     // Map<eKey, Edge>

    // ── Robber / Pirate ──
    this.robberPos    = desertCoordFrom(this.tiles, mapData.desertCoord);
    this.piratePos    = null;  // bắt đầu ngoài bàn
    if (this.robberPos) {
      const t = this.tiles.get(hexKey(this.robberPos.q, this.robberPos.r));
      if (t) t.hasRobber = true;
    }

    // ── Xúc xắc ──
    this.lastRoll     = null;  // { d1, d2, total }
    this.rollCount    = 0;

    // ── Dev Cards ──
    const cardRand = seed ? makePRNG(stringToSeed(String(seed) + '_cards')) : Math.random;
    this.devCardDeck  = shuffle([...DEV_CARD_POOL], cardRand);

    // ── Longest Trade Route ──
    this.longestRouteOwner  = null;
    this.longestRouteLength = 4; // cần ≥ 5 để chiếm danh hiệu

    // ── Largest Army ──
    this.largestArmyOwner = null;
    this.largestArmySize  = 2; // cần ≥ 3 để chiếm

    // ── Kịch bản điểm thắng ──
    this.winningVP    = 13;  // Voyages of Discovery

    // ── Event Log ──
    this.eventLog     = [];

    // ── Setup state ──
    this.setupRound   = 1;   // 1 hoặc 2
    this.setupDir     = 1;   // +1 (thuận) hoặc -1 (ngược)
    this.setupSettlementVertex = null; // vertex vừa đặt settlement trong setup
    this.setupPlayersLeft      = [];   // hàng đợi setup

    // ── State ──
    this.currentPlayerIndex = 0;
    this.phase              = Phase.SETUP_SETTLEMENT;
    this.turn               = 0;
    this.winner             = null;

    // ── Pending actions ──
    this.goldPending        = [];  // [{ playerId, amount }] — chờ chọn tài nguyên
    this.discardPending     = [];  // [playerId] — chờ bỏ bài
    this.stealTargets       = [];  // [playerId] — có thể cướp
    this.movedShipThisTurn  = false;
    this.devCardPlayedThisTurn = false;

    // ── Islands discovered ──
    this.islandMap = this._buildIslandMap();

    this.log(`[Bắt đầu] Game bắt đầu! ${numPlayers} người chơi.`);
    this.log(`${this.currentPlayer.name} đặt định cư đầu tiên.`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  get currentPlayer() { return this.players[this.currentPlayerIndex]; }

  log(msg) {
    this.eventLog.unshift({ turn: this.turn, msg, time: Date.now() });
    if (this.eventLog.length > 100) this.eventLog.pop();
  }

  getTile(q, r) { return this.tiles.get(hexKey(q, r)) ?? null; }
  getVertex(vKey) { return this.vertices.get(vKey) ?? null; }
  getEdge(eKey)   { return this.edges.get(eKey) ?? null; }

  // ─── Lấy vertex hợp lệ để đặt định cư trong setup ────────────────────────
  getValidSetupVertices() {
    const valid = [];
    for (const [vKey, vertex] of this.vertices) {
      if (!vertex.hasLand) continue;
      // Setup settlements must be on the main island
      const onMainIsland = vertex.hexes.some(h =>
        this.mainIslandCoords?.some(mc => mc.q === h.q && mc.r === h.r)
      );
      if (this.mainIslandCoords && this.mainIslandCoords.length > 0 && !onMainIsland) continue;

      const check = isValidSettlementPlacement(
        this.vertices, this.edges, vKey, this.currentPlayerIndex, true
      );
      if (check.ok) valid.push(vKey);
    }
    return valid;
  }

  // ─── Lấy vertex hợp lệ để đặt định cư trong game ────────────────────────
  getValidSettlementVertices() {
    const pid = this.currentPlayerIndex;
    const valid = [];
    for (const [vKey, vertex] of this.vertices) {
      if (!vertex.hasLand) continue;
      const check = isValidSettlementPlacement(this.vertices, this.edges, vKey, pid, false);
      if (check.ok) valid.push(vKey);
    }
    return valid;
  }

  // ─── Lấy vertex hợp lệ để nâng cấp thành phố ────────────────────────────
  getValidCityVertices() {
    const pid = this.currentPlayerIndex;
    return [...this.vertices.entries()]
      .filter(([, v]) => v.building?.playerId === pid && v.building.type === 'settlement')
      .map(([k]) => k);
  }

  // ─── Lấy edge hợp lệ để đặt đường ────────────────────────────────────────
  getValidRoadEdges(isSetup = false, setupVertex = null) {
    const pid = this.currentPlayerIndex;
    const valid = [];
    for (const [eKey, edge] of this.edges) {
      if (isSetup && setupVertex) {
        // Setup: chỉ cạnh liền kề với vertex setup
        if (!edge.vertices.includes(setupVertex)) continue;
        if (!edge.isLand && !edge.isMixed) continue;
        if (edge.piece !== null) continue;
        valid.push(eKey);
      } else {
        const check = isValidRoadPlacement(this.vertices, this.edges, eKey, pid, false);
        if (check.ok) valid.push(eKey);
      }
    }
    return valid;
  }

  // ─── Lấy edge hợp lệ để đặt tàu ──────────────────────────────────────────
  getValidShipEdges(isSetup = false, setupVertex = null) {
    const pid = this.currentPlayerIndex;
    const valid = [];
    for (const [eKey, edge] of this.edges) {
      if (isSetup && setupVertex) {
        if (!edge.vertices.includes(setupVertex)) continue;
        if (edge.isLand) continue;
        if (edge.piece !== null) continue;
        valid.push(eKey);
      } else {
        const check = isValidShipPlacement(
          this.vertices, this.edges, eKey, pid, this.piratePos, this.tiles, false
        );
        if (check.ok) valid.push(eKey);
      }
    }
    return valid;
  }

  // ─── Lấy ships có thể di chuyển ──────────────────────────────────────────
  getMovableShips() {
    if (this.movedShipThisTurn) return [];
    return getMovableShips(this.vertices, this.edges, this.currentPlayerIndex, this.piratePos);
  }

  // ─── SETUP ────────────────────────────────────────────────────────────────

  /**
   * Đặt định cư trong giai đoạn setup
   * @param {string} vertexKey
   */
  setupPlaceSettlement(vertexKey) {
    if (this.phase !== Phase.SETUP_SETTLEMENT) return { ok: false, reason: 'Sai phase' };

    const check = isValidSettlementPlacement(
      this.vertices, this.edges, vertexKey, this.currentPlayerIndex, true
    );
    if (!check.ok) return check;

    const player = this.currentPlayer;
    const vertex = this.vertices.get(vertexKey);

    // Đặt định cư
    vertex.building = { playerId: player.id, type: 'settlement' };
    player.stock.settlements--;
    player.placed.settlements.push(vertexKey);
    this.setupSettlementVertex = vertexKey;

    // Cập nhật cảng biển nếu đặt ven cảng
    this._updateHarborAccess(player, vertexKey);

    // Nếu là vòng 2: nhận tài nguyên từ các tile liền kề
    if (this.setupRound === 2) {
      this._grantSetupResources(player, vertex);
    }

    player.recalcPublicVP();
    this.log(`${player.name} đặt Định cư.`);
    this.phase = Phase.SETUP_ROAD;
    return { ok: true };
  }

  /**
   * Đặt đường hoặc tàu trong giai đoạn setup
   * @param {string} edgeKey
   * @param {'road'|'ship'} type
   */
  setupPlaceRoadOrShip(edgeKey, type) {
    if (this.phase !== Phase.SETUP_ROAD) return { ok: false, reason: 'Sai phase' };

    const edge = this.edges.get(edgeKey);
    if (!edge) return { ok: false, reason: 'Cạnh không tồn tại' };
    if (!edge.vertices.includes(this.setupSettlementVertex)) {
      return { ok: false, reason: 'Phải liền kề với định cư vừa đặt' };
    }
    if (edge.piece !== null) return { ok: false, reason: 'Cạnh đã bị chiếm' };
    if (type === 'road' && !edge.isLand && !edge.isMixed) {
      return { ok: false, reason: 'Đường chỉ đặt trên đất liền' };
    }
    if (type === 'ship' && edge.isLand) {
      return { ok: false, reason: 'Tàu không đặt trên đất liền' };
    }

    const player = this.currentPlayer;
    edge.piece = { playerId: player.id, type, builtThisTurn: false };

    if (type === 'road') {
      player.stock.roads--;
      player.placed.roads.push(edgeKey);
    } else {
      player.stock.ships--;
      player.placed.ships.push(edgeKey);
    }

    this.log(`${player.name} đặt ${type === 'road' ? 'Đường' : 'Tàu'}.`);
    this.setupSettlementVertex = null;
    this._advanceSetup();
    return { ok: true };
  }

  _grantSetupResources(player, vertex) {
    for (const hex of vertex.hexes) {
      const tile = this.getTile(hex.q, hex.r);
      if (!tile || !tile.producesResource) continue;

      if (tile.type === TileType.GOLD) {
        player.resources.GOLD = (player.resources.GOLD ?? 0) + 1;
        this.log(`${player.name} nhận 1 Vàng (GOLD) từ setup.`);
      } else {
        player.resources[tile.resource] = (player.resources[tile.resource] ?? 0) + 1;
        this.log(`${player.name} nhận 1 ${tile.resource} từ setup.`);
      }
    }
  }

  _advanceSetup() {
    const pid = this.currentPlayerIndex;

    if (this.setupRound === 1) {
      if (pid < this.numPlayers - 1) {
        this.currentPlayerIndex++;
        this.phase = Phase.SETUP_SETTLEMENT;
        this.log(`${this.currentPlayer.name} đặt định cư đầu tiên.`);
      } else {
        // Chuyển sang vòng 2, bắt đầu từ người cuối
        this.setupRound = 2;
        this.phase = Phase.SETUP_SETTLEMENT;
        this.log(`Vòng 2 setup — ${this.currentPlayer.name} đặt định cư thứ hai.`);
      }
    } else {
      // Vòng 2: lượt ngược
      if (pid > 0) {
        this.currentPlayerIndex--;
        this.phase = Phase.SETUP_SETTLEMENT;
        this.log(`${this.currentPlayer.name} đặt định cư thứ hai.`);
      } else {
        // Setup xong
        this.currentPlayerIndex = 0;
        this.turn  = 1;
        this.phase = Phase.ROLL;
        this.log('[Setup] Xong thiết lập! Game bắt đầu.');
        this.log(`--- Lượt ${this.turn}: ${this.currentPlayer.name} ---`);
      }
    }
  }

  // ─── DICE ─────────────────────────────────────────────────────────────────

  rollDice(forcedD1 = null, forcedD2 = null) {
    if (this.phase !== Phase.ROLL) return { ok: false, reason: 'Chưa đến lúc tung xúc xắc' };

    const d1 = (forcedD1 !== null && forcedD1 !== undefined) ? forcedD1 : (Math.floor(Math.random() * 6) + 1);
    const d2 = (forcedD2 !== null && forcedD2 !== undefined) ? forcedD2 : (Math.floor(Math.random() * 6) + 1);
    this.lastRoll = { d1, d2, total: d1 + d2 };
    this.rollCount++;

    this.log(`[Xúc xắc] ${this.currentPlayer.name} tung ${d1}+${d2}=${d1+d2}`);

    if (this.lastRoll.total === 7) {
      this._handleSeven();
    } else {
      this._distributeResources(this.lastRoll.total);
    }

    return { ok: true, roll: this.lastRoll };
  }

  _handleSeven() {
    // Bước 1: người chơi có >7 tài nguyên phải bỏ bớt
    const mustDiscard = this.players.filter(p => p.totalResources() > 7);
    if (mustDiscard.length > 0) {
      this.discardPending = mustDiscard.map(p => p.id);
      this.phase = Phase.DISCARD;
      this.log(`[Bỏ bài] ${mustDiscard.map(p => p.name).join(', ')} có >7 tài nguyên, phải bỏ bớt!`);
    } else {
      this.phase = Phase.ROBBER;
      this.log(`[Robber/Pirate] Số 7! Di chuyển Tên cướp hoặc Cướp biển.`);
    }
  }

  /**
   * Người chơi bỏ bài khi bị 7 (phải bỏ floor(total/2))
   * @param {number} playerId
   * @param {Object} toDiscard - { BRICK: 1, LUMBER: 2, ... }
   */
  discardResources(playerId, toDiscard) {
    const player = this.players[playerId];
    if (!player) return { ok: false };

    const required = Math.floor(player.totalResources() / 2);
    const total    = Object.values(toDiscard).reduce((a, b) => a + b, 0);
    if (total !== required) return { ok: false, reason: `Phải bỏ đúng ${required} tài nguyên` };

    // Kiểm tra có đủ không
    for (const [r, n] of Object.entries(toDiscard)) {
      if ((player.resources[r] ?? 0) < n)
        return { ok: false, reason: `Không đủ ${r}` };
    }

    for (const [r, n] of Object.entries(toDiscard)) player.resources[r] -= n;

    this.discardPending = this.discardPending.filter(id => id !== playerId);
    this.log(`${player.name} bỏ ${total} tài nguyên.`);

    if (this.discardPending.length === 0) {
      this.phase = Phase.ROBBER;
      this.log(`[Robber/Pirate] Số 7! Di chuyển Tên cướp hoặc Cướp biển.`);
    }
    return { ok: true };
  }

  // ─── TÀI NGUYÊN ───────────────────────────────────────────────────────────

  _distributeResources(number) {
    for (const tile of this.tiles.values()) {
      if (tile.number !== number) continue;
      if (tile.hasRobber) continue;  // Robber chặn

      for (const [vKey, vertex] of this.vertices) {
        if (!vertex.building) continue;
        if (!vertex.hexes.some(h => h.q === tile.q && h.r === tile.r)) continue;

        const player = this.players[vertex.building.playerId];
        const amount = vertex.building.type === 'city' ? 2 : 1;

        if (tile.type === TileType.GOLD) {
          // Nhận trực tiếp Thẻ Vàng (GOLD) vào tay để người chơi tự do đổi sau
          player.resources.GOLD = (player.resources.GOLD ?? 0) + amount;
          this.log(`[Mỏ Vàng] ${player.name} +${amount} Vàng (GOLD) từ Mỏ Vàng.`);
        } else {
          player.resources[tile.resource] = (player.resources[tile.resource] ?? 0) + amount;
          this.log(`${player.name} +${amount} ${tile.resource}`);
        }
      }
    }

    this.phase = Phase.BUILD;
  }

  /**
   * Đổi Thẻ Vàng (GOLD) sang tài nguyên cơ bản bất kỳ theo tỉ lệ 1:1
   * Người chơi có thể tự do giữ Vàng trên tay và chủ động đổi lúc cần trong lượt.
   * @param {string} targetResource - 'LUMBER' | 'BRICK' | 'GRAIN' | 'WOOL' | 'ORE'
   * @param {number} amount - số lượng vàng muốn đổi (mặc định 1)
   */
  convertGold(targetResource, amount = 1) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Chỉ được đổi tài nguyên trong lượt xây dựng của bạn' };
    const player = this.currentPlayer;
    const validTargets = ['LUMBER', 'BRICK', 'GRAIN', 'WOOL', 'ORE'];
    if (!validTargets.includes(targetResource)) return { ok: false, reason: `Tài nguyên đổi không hợp lệ: ${targetResource}` };
    const numToConvert = Number(amount) || 1;
    if (numToConvert <= 0) return { ok: false, reason: 'Số lượng vàng phải lớn hơn 0' };
    if ((player.resources.GOLD ?? 0) < numToConvert) return { ok: false, reason: 'Không đủ Thẻ Vàng trong tay' };

    player.resources.GOLD -= numToConvert;
    player.resources[targetResource] = (player.resources[targetResource] ?? 0) + numToConvert;
    this.log(`[Đổi Vàng] ${player.name} dùng ${numToConvert} Vàng đổi lấy ${numToConvert} ${targetResource}.`);
    return { ok: true };
  }

  /**
   * Tương thích ngược: chọn tài nguyên từ Gold Field
   */
  pickGoldResources(playerId, choices) {
    const player = this.players[playerId];
    if (!player) return { ok: false, reason: 'Người chơi không tồn tại' };

    for (const [r, n] of Object.entries(choices)) {
      if (['LUMBER', 'BRICK', 'GRAIN', 'WOOL', 'ORE'].includes(r)) {
        player.resources[r] = (player.resources[r] ?? 0) + n;
      }
    }
    this.phase = Phase.BUILD;
    return { ok: true };
  }

  // ─── ROBBER / PIRATE ──────────────────────────────────────────────────────

  moveRobber(q, r) {
    if (this.phase !== Phase.ROBBER) return { ok: false, reason: 'Sai phase' };
    const tile = this.getTile(q, r);
    if (!tile) return { ok: false, reason: 'Ô không tồn tại' };
    if (tile.type === TileType.SEA) return { ok: false, reason: 'Robber chỉ đi trên đất liền' };
    if (this.robberPos?.q === q && this.robberPos?.r === r)
      return { ok: false, reason: 'Phải di chuyển Robber sang ô khác' };

    // Xoá vị trí cũ
    if (this.robberPos) {
      const old = this.getTile(this.robberPos.q, this.robberPos.r);
      if (old) old.hasRobber = false;
    }

    tile.hasRobber = true;
    this.robberPos = { q, r };

    // Tìm nạn nhân có thể cướp
    const victims = this._getVictimsNearTile(q, r, 'building');
    this.log(`[Robber] ${this.currentPlayer.name} đặt Robber tại (${q},${r}).`);

    if (victims.length > 0) {
      this.stealTargets = victims;
      this.phase = Phase.STEAL;
    } else {
      this.phase = this._returnPhaseAfterRobber || Phase.BUILD;
      this._returnPhaseAfterRobber = null;
    }
    return { ok: true, victims };
  }

  movePirate(q, r) {
    if (this.phase !== Phase.ROBBER) return { ok: false, reason: 'Sai phase' };
    const tile = this.getTile(q, r);
    if (!tile) return { ok: false, reason: 'Ô không tồn tại' };
    if (tile.type !== TileType.SEA) return { ok: false, reason: 'Pirate chỉ đi trên biển' };
    if (this.piratePos?.q === q && this.piratePos?.r === r)
      return { ok: false, reason: 'Phải di chuyển Pirate sang ô khác' };

    // Xoá vị trí cũ
    if (this.piratePos) {
      const old = this.getTile(this.piratePos.q, this.piratePos.r);
      if (old) old.hasPirate = false;
    }

    tile.hasPirate = true;
    this.piratePos = { q, r };

    const victims = this._getVictimsNearTile(q, r, 'ship');
    this.log(`[Pirate] ${this.currentPlayer.name} đặt Pirate tại biển (${q},${r}).`);

    if (victims.length > 0) {
      this.stealTargets = victims;
      this.phase = Phase.STEAL;
    } else {
      this.phase = this._returnPhaseAfterRobber || Phase.BUILD;
      this._returnPhaseAfterRobber = null;
    }
    return { ok: true, victims };
  }

  stealFrom(victimId, forcedResource = null) {
    if (this.phase !== Phase.STEAL) return { ok: false };
    if (!this.stealTargets.includes(victimId)) return { ok: false, reason: 'Không thể cướp người này' };

    const thief  = this.currentPlayer;
    const victim = this.players[victimId];
    let stolen = forcedResource;
    if (!stolen) {
      stolen = victim.stealRandom();
    } else {
      if ((victim.resources[stolen] ?? 0) > 0) {
        victim.resources[stolen]--;
      }
    }

    if (stolen) {
      thief.resources[stolen] = (thief.resources[stolen] ?? 0) + 1;
      this.log(`${thief.name} cướp 1 tài nguyên từ ${victim.name}.`);
    } else {
      this.log(`${victim.name} không có tài nguyên để cướp.`);
    }

    this.stealTargets = [];
    this.phase = this._returnPhaseAfterRobber || Phase.BUILD;
    this._returnPhaseAfterRobber = null;
    return { ok: true, stolen };
  }

  _getVictimsNearTile(q, r, checkType) {
    const victims = new Set();
    const cid = this.currentPlayerIndex;

    if (checkType === 'building') {
      for (const [, vertex] of this.vertices) {
        if (!vertex.building) continue;
        if (vertex.building.playerId === cid) continue;
        if (vertex.hexes.some(h => h.q === q && h.r === r)) {
          victims.add(vertex.building.playerId);
        }
      }
    } else {
      // Ship
      for (const [, edge] of this.edges) {
        if (!edge.piece || edge.piece.type !== 'ship') continue;
        if (edge.piece.playerId === cid) continue;
        if (edge.hexes.some(h => h.q === q && h.r === r)) {
          victims.add(edge.piece.playerId);
        }
      }
    }
    return [...victims];
  }

  // ─── XÂY DỰNG ─────────────────────────────────────────────────────────────

  placeSettlement(vertexKey) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    if (!player.canAfford(BUILD_COST.settlement)) return { ok: false, reason: 'Không đủ tài nguyên' };
    if (player.stock.settlements === 0) return { ok: false, reason: 'Hết định cư trong kho' };

    const check = isValidSettlementPlacement(this.vertices, this.edges, vertexKey, player.id, false);
    if (!check.ok) return check;

    player.pay(BUILD_COST.settlement);
    player.stock.settlements--;
    player.placed.settlements.push(vertexKey);
    this.vertices.get(vertexKey).building = { playerId: player.id, type: 'settlement' };

    // Kiểm tra khám phá đảo mới (Seafarers)
    this._checkIslandDiscovery(vertexKey, player);

    // Cập nhật cảng của player
    this._updateHarborAccess(player, vertexKey);

    player.recalcPublicVP();
    this._updateLongestRoute();
    this.log(`[Định cư] ${player.name} xây Định cư (+1 VP).`);
    this._checkWin();
    return { ok: true };
  }

  placeCity(vertexKey) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    if (!player.canAfford(BUILD_COST.city)) return { ok: false, reason: 'Không đủ tài nguyên' };
    if (player.stock.cities === 0) return { ok: false, reason: 'Hết thành phố trong kho' };

    const vertex = this.vertices.get(vertexKey);
    if (!vertex?.building || vertex.building.playerId !== player.id || vertex.building.type !== 'settlement') {
      return { ok: false, reason: 'Chỉ nâng cấp Định cư của bạn' };
    }

    player.pay(BUILD_COST.city);
    player.stock.cities--;
    player.stock.settlements++;  // định cư trả lại kho
    player.placed.settlements = player.placed.settlements.filter(k => k !== vertexKey);
    player.placed.cities.push(vertexKey);
    vertex.building = { playerId: player.id, type: 'city' };

    player.recalcPublicVP();
    this.log(`[Thành phố] ${player.name} nâng cấp Thành phố (+2 VP).`);
    this._checkWin();
    return { ok: true };
  }

  placeRoad(edgeKey) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    if (!player.canAfford(BUILD_COST.road)) return { ok: false, reason: 'Không đủ tài nguyên' };
    if (player.stock.roads === 0) return { ok: false, reason: 'Hết đường trong kho' };

    const check = isValidRoadPlacement(this.vertices, this.edges, edgeKey, player.id, false);
    if (!check.ok) return check;

    player.pay(BUILD_COST.road);
    player.stock.roads--;
    player.placed.roads.push(edgeKey);
    this.edges.get(edgeKey).piece = { playerId: player.id, type: 'road', builtThisTurn: true };

    this._updateLongestRoute();
    this._checkShipIslandReveal(edgeKey);
    this.log(`[Đường] ${player.name} xây Đường.`);
    this._checkWin();
    return { ok: true };
  }

  placeShip(edgeKey) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    if (!player.canAfford(BUILD_COST.ship)) return { ok: false, reason: 'Không đủ tài nguyên' };
    if (player.stock.ships === 0) return { ok: false, reason: 'Hết tàu trong kho' };

    const check = isValidShipPlacement(
      this.vertices, this.edges, edgeKey, player.id, this.piratePos, this.tiles, false
    );
    if (!check.ok) return check;

    player.pay(BUILD_COST.ship);
    player.stock.ships--;
    player.placed.ships.push(edgeKey);
    this.edges.get(edgeKey).piece = { playerId: player.id, type: 'ship', builtThisTurn: true };

    this._updateLongestRoute();
    this._checkShipIslandReveal(edgeKey);
    this.log(`[Tàu] ${player.name} đặt Tàu.`);
    return { ok: true };
  }

  /**
   * Di chuyển 1 tàu (1 lần/lượt, đúng nguyên tắc Seafarers)
   * @param {string} fromEdgeKey - tàu muốn di chuyển
   * @param {string} toEdgeKey   - vị trí mới
   */
  moveShip(fromEdgeKey, toEdgeKey) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    if (this.movedShipThisTurn) return { ok: false, reason: 'Chỉ di chuyển 1 tàu/lượt' };

    const player   = this.currentPlayer;
    const fromEdge = this.edges.get(fromEdgeKey);
    if (!fromEdge?.piece || fromEdge.piece.playerId !== player.id || fromEdge.piece.type !== 'ship') {
      return { ok: false, reason: 'Không phải tàu của bạn' };
    }
    if (fromEdge.piece.builtThisTurn) return { ok: false, reason: 'Không di chuyển tàu vừa xây' };

    const movable = this.getMovableShips();
    if (!movable.includes(fromEdgeKey)) return { ok: false, reason: 'Tàu này không thể di chuyển' };

    // Tạm thời xoá tàu khỏi vị trí cũ
    fromEdge.piece = null;
    player.placed.ships = player.placed.ships.filter(k => k !== fromEdgeKey);
    player.stock.ships++;

    // Kiểm tra vị trí mới hợp lệ (với tàu đã được xoá)
    const check = isValidShipPlacement(
      this.vertices, this.edges, toEdgeKey, player.id, this.piratePos, this.tiles, false
    );
    if (!check.ok) {
      // Hoàn tác
      fromEdge.piece = { playerId: player.id, type: 'ship', builtThisTurn: false };
      player.placed.ships.push(fromEdgeKey);
      player.stock.ships--;
      return check;
    }

    // Đặt tàu vào vị trí mới
    this.edges.get(toEdgeKey).piece = { playerId: player.id, type: 'ship', builtThisTurn: false };
    player.stock.ships--;
    player.placed.ships.push(toEdgeKey);
    this.movedShipThisTurn = true;

    this._updateLongestRoute();
    this._checkShipIslandReveal(toEdgeKey);
    this.log(`[Tàu] ${player.name} di chuyển Tàu.`);
    return { ok: true };
  }

  buyDevCard(forcedCardType = null) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    if (!player.canAfford(BUILD_COST.devCard)) return { ok: false, reason: 'Không đủ tài nguyên' };
    if (this.devCardDeck.length === 0 && !forcedCardType) return { ok: false, reason: 'Hết thẻ phát triển' };

    player.pay(BUILD_COST.devCard);

    let cardType = forcedCardType;
    if (!cardType) {
      cardType = this.devCardDeck.pop();
    } else {
      const idx = this.devCardDeck.lastIndexOf(cardType);
      if (idx !== -1) this.devCardDeck.splice(idx, 1);
      else if (this.devCardDeck.length > 0) this.devCardDeck.pop();
    }

    player.devCards.push({ type: cardType, newThisTurn: true });

    if (cardType === 'VP') {
      player.hiddenVP = (player.devCards || []).filter(c => c.type === 'VP').length;
      player.recalcPublicVP();
    }

    this._updateLargestArmy();
    player.recalcPublicVP();
    this._checkWin();

    this.log(`[Thẻ Dev] ${player.name} mua Thẻ phát triển.`);
    return { ok: true, cardType };
  }

  // ─── THẺ PHÁT TRIỂN ───────────────────────────────────────────────────────

  playDevCard(cardType, options = {}) {
    // Theo luật chính thức Catan: có thể đánh thẻ phát triển (nhất là Hiệp sĩ) trước khi gieo xúc xắc
    if (this.phase !== Phase.BUILD && !(this.phase === Phase.ROLL && cardType === 'KNIGHT')) {
      return { ok: false, reason: 'Chỉ có thể đánh thẻ trong giai đoạn xây dựng hoặc đánh Hiệp sĩ trước khi gieo xúc xắc' };
    }
    if (this.devCardPlayedThisTurn) return { ok: false, reason: 'Chỉ chơi 1 thẻ/lượt' };

    const player = this.currentPlayer;
    const cardIdx = player.devCards.findIndex(c => c.type === cardType && !c.newThisTurn && !c.played);
    if (cardIdx === -1) return { ok: false, reason: 'Không có thẻ này (hoặc vừa mua lượt này)' };

    player.devCards[cardIdx].played = true;
    this.devCardPlayedThisTurn = true;
    player.playedDevCards.push(cardType);

    switch (cardType) {
      case 'VP': {
        player.recalcPublicVP();
        this._checkWin();
        this.log(`[Điểm chiến thắng] ${player.name} kích hoạt Thẻ Điểm Chiến Thắng (+1 VP)!`);
        break;
      }

      case 'KNIGHT':
        player.knightsPlayed++;
        this._updateLargestArmy();
        this._returnPhaseAfterRobber = (this.phase === Phase.ROLL) ? Phase.ROLL : Phase.BUILD;
        this.phase = Phase.ROBBER;
        this.log(`[Knight] ${player.name} đánh Knight! Di chuyển Robber/Pirate.`);
        break;

      case 'MONOPOLY': {
        // options.resource: loại tài nguyên muốn chiếm
        const res = options.resource;
        if (!ALL_RESOURCES.includes(res)) return { ok: false, reason: 'Tài nguyên không hợp lệ' };
        let total = 0;
        for (const p of this.players) {
          if (p.id === player.id) continue;
          const amount = p.resources[res] ?? 0;
          p.resources[res] = 0;
          player.resources[res] = (player.resources[res] ?? 0) + amount;
          total += amount;
        }
        this.log(`[Độc quyền] ${player.name} Độc quyền ${res}! Nhận ${total} tài nguyên.`);
        break;
      }

      case 'YEAR_OF_PLENTY': {
        // options.resources: { BRICK: 1, GRAIN: 1 } — tổng 2
        const choices = options.resources ?? {};
        const total   = Object.values(choices).reduce((a, b) => a + b, 0);
        if (total !== 2) return { ok: false, reason: 'Phải chọn đúng 2 tài nguyên' };
        for (const [r, n] of Object.entries(choices)) player.resources[r] = (player.resources[r] ?? 0) + n;
        this.log(`[Bội thu] ${player.name} Năm Bội Thu: nhận 2 tài nguyên tự chọn.`);
        break;
      }

      case 'ROAD_BUILDING': {
        // options.edges: [edgeKey1, edgeKey2] — 2 đường/tàu miễn phí
        const freeEdges = options.edges ?? [];
        for (const eKey of freeEdges.slice(0, 2)) {
          const edge = this.edges.get(eKey);
          if (!edge || edge.piece) continue;
          const type = edge.isLand ? 'road' : 'ship';
          if (type === 'road' && player.stock.roads > 0) {
            edge.piece = { playerId: player.id, type: 'road', builtThisTurn: true };
            player.stock.roads--;
            player.placed.roads.push(eKey);
          } else if (type === 'ship' && player.stock.ships > 0) {
            edge.piece = { playerId: player.id, type: 'ship', builtThisTurn: true };
            player.stock.ships--;
            player.placed.ships.push(eKey);
          }
        }
        this._updateLongestRoute();
        this.log(`[Xây đường] ${player.name} Xây Đường: 2 đường/tàu miễn phí.`);
        break;
      }

      default:
        return { ok: false, reason: 'Thẻ không hợp lệ' };
    }

    player.recalcPublicVP();
    this._checkWin();
    return { ok: true };
  }

  // ─── THƯƠNG LƯỢNG ─────────────────────────────────────────────────────────

  /**
   * Trao đổi với ngân hàng
   * Tỷ lệ: 4:1 mặc định, 3:1 (cảng generic), 2:1 (cảng loại cụ thể)
   */
  tradeWithBank(giveResource, giveAmount, receiveResource) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    const rate = this._getTradeRate(player, giveResource);
    if (giveAmount !== rate) return { ok: false, reason: `Cần ${rate} ${giveResource}` };
    if ((player.resources[giveResource] ?? 0) < rate)
      return { ok: false, reason: `Không đủ ${giveResource}` };
    if (giveResource === receiveResource) return { ok: false, reason: 'Không trao đổi cùng loại' };

    player.resources[giveResource] -= rate;
    player.resources[receiveResource] = (player.resources[receiveResource] ?? 0) + 1;
    this.log(`[Ngân hàng] ${player.name}: ${rate}${giveResource} → 1${receiveResource}`);
    return { ok: true, rate };
  }

  /**
   * Đề nghị trao đổi với người chơi khác
   * Cả 2 phải đồng ý trước khi thực hiện
   */
  tradeWithPlayer(targetId, give, receive) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const p1 = this.currentPlayer;
    const p2 = this.players[targetId];
    if (!p2 || p2.id === p1.id) return { ok: false };

    for (const [r, n] of Object.entries(give)) {
      if ((p1.resources[r] ?? 0) < n) return { ok: false, reason: `${p1.name} không đủ ${r}` };
    }
    for (const [r, n] of Object.entries(receive)) {
      if ((p2.resources[r] ?? 0) < n) return { ok: false, reason: `${p2.name} không đủ ${r}` };
    }

    for (const [r, n] of Object.entries(give)) {
      p1.resources[r] -= n;
      p2.resources[r] = (p2.resources[r] ?? 0) + n;
    }
    for (const [r, n] of Object.entries(receive)) {
      p2.resources[r] -= n;
      p1.resources[r] = (p1.resources[r] ?? 0) + n;
    }

    const gStr = Object.entries(give).map(([r, n]) => `${n}${r}`).join('+');
    const rStr = Object.entries(receive).map(([r, n]) => `${n}${r}`).join('+');
    this.log(`[Đổi bài] ${p1.name}↔${p2.name}: [${gStr}]↔[${rStr}]`);
    return { ok: true };
  }

  // ─── KẾT THÚC LƯỢT ────────────────────────────────────────────────────────

  endTurn() {
    if (this.phase === Phase.GAME_OVER) return { ok: false };
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Chưa thể kết thúc lượt' };

    // Reset builtThisTurn cho tất cả edges của player
    for (const edge of this.edges.values()) {
      if (edge.piece) edge.piece.builtThisTurn = false;
    }

    // Reset dev card flags
    for (const card of this.currentPlayer.devCards) card.newThisTurn = false;
    this.devCardPlayedThisTurn = false;
    this.movedShipThisTurn     = false;
    this._returnPhaseAfterRobber = null;

    // Chuyển lượt
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.numPlayers;
    this.turn++;
    this.phase = Phase.ROLL;

    this.log(`--- Lượt ${this.turn}: ${this.currentPlayer.name} ---`);
    return { ok: true };
  }

  // ─── NỘI BỘ ───────────────────────────────────────────────────────────────

  _getTradeRate(player, resource) {
    // Kiểm tra cảng 2:1 cụ thể
    for (const harbor of this.harbors) {
      if (harbor.type === resource && player.harborAccess?.has(harbor.type)) return 2;
    }
    // Kiểm tra cảng 3:1
    if (player.harborAccess?.has('GENERIC')) return 3;
    return 4;
  }

  _updateHarborAccess(player, vertexKey) {
    if (!player.harborAccess) player.harborAccess = new Set();
    const vertex = this.vertices.get(vertexKey);
    if (!vertex) return;
    const harbor = getHarborAtVertex(this.harbors, vertex);
    if (harbor) {
      player.harborAccess.add(harbor.type);
      this.log(`[Cảng] ${player.name} tiếp cận cảng ${harbor.type === 'GENERIC' ? '3:1' : '2:1 ' + harbor.type}.`);
    }
  }

  _getIslandCoords(islandId) {
    if (islandId === 'island_east') return [{ q: 4, r: -2 }, { q: 5, r: -2 }];
    if (islandId === 'island_west') return [{ q: -4, r: 1 }, { q: -5, r: 2 }];
    if (islandId === 'island_south') return [{ q: -1, r: 4 }, { q: 0, r: 4 }, { q: 1, r: 4 }];
    return [];
  }

  _revealIsland(islandId) {
    const coords = this._getIslandCoords(islandId);
    let newlyRevealed = false;
    for (const c of coords) {
      const tile = this.getTile(c.q, c.r);
      if (tile && !tile.isDiscovered) {
        tile.isDiscovered = true;
        newlyRevealed = true;
      }
    }
    return newlyRevealed;
  }

  _checkShipIslandReveal(edgeKey) {
    const edge = this.edges.get(edgeKey);
    if (!edge) return;
    for (const vKey of edge.vertices) {
      const v = this.vertices.get(vKey);
      if (!v) continue;
      const islandId = this._getIslandId(v);
      if (islandId && this._revealIsland(islandId)) {
        this.log(`[Khám phá] Tuyến đường/tàu đã vươn tới đảo xa! Sương mù đã tan biến.`);
      }
    }
    if (edge.hexes) {
      for (const h of edge.hexes) {
        if ((h.q === 4 && h.r === -2) || (h.q === 5 && h.r === -2)) this._revealIsland('island_east');
        if ((h.q === -4 && h.r === 1) || (h.q === -5 && h.r === 2)) this._revealIsland('island_west');
        if (h.r === 4 && (h.q === -1 || h.q === 0 || h.q === 1)) this._revealIsland('island_south');
      }
    }
  }

  _checkIslandDiscovery(vertexKey, player) {
    const vertex = this.vertices.get(vertexKey);
    if (!vertex) return;

    // Kiểm tra vertex có nằm trên đảo nhỏ không
    const isSmallIsland = vertex.hexes.some(h =>
      this.smallIslandCoords?.some(c => c.q === h.q && c.r === h.r)
    );
    if (!isSmallIsland) return;

    // Lấy island ID dựa trên cluster
    const islandId = this._getIslandId(vertex);
    if (!islandId) return;

    // Lật toàn bộ các ô của hòn đảo này
    this._revealIsland(islandId);

    // Luật Catan Seafarers: Mỗi người chơi xây định cư đầu tiên trên một đảo xa
    // đều được thưởng điểm chiến thắng khám phá (Special Victory Point)
    if (!player.discoveredIslands.has(islandId)) {
      player.discoveredIslands.add(islandId);
      player.recalcPublicVP();
      this.log(`[Đảo mới] ${player.name} lập định cư trên đảo mới! +1 VP (tổng VP: ${player.totalVP()})`);
      this._checkWin();
    }
  }

  _getIslandId(vertex) {
    if (!vertex.hexes || vertex.hexes.length === 0) return null;
    for (const h of vertex.hexes) {
      if ((h.q === 4 && h.r === -2) || (h.q === 5 && h.r === -2)) return 'island_east';
      if ((h.q === -4 && h.r === 1) || (h.q === -5 && h.r === 2)) return 'island_west';
      if (h.r === 4 && (h.q === -1 || h.q === 0 || h.q === 1)) return 'island_south';
    }
    return null;
  }

  _updateLongestRoute() {
    for (const player of this.players) {
      const len = calcLongestTradeRoute(this.vertices, this.edges, player.id);
      player.longestRoute = len;
    }

    // Tìm người có tuyến dài nhất >= 5
    let maxLen = Math.max(this.longestRouteLength, 4);
    let newOwner = null;

    for (const player of this.players) {
      if ((player.longestRoute ?? 0) > maxLen) {
        maxLen = player.longestRoute;
        newOwner = player;
      }
    }

    if (newOwner && newOwner !== this.longestRouteOwner) {
      // Trao danh hiệu
      if (this.longestRouteOwner) {
        this.longestRouteOwner.hasLongestRoad = false;
        this.longestRouteOwner.recalcPublicVP();
      }
      newOwner.hasLongestRoad = true;
      this.longestRouteOwner  = newOwner;
      this.longestRouteLength = maxLen;
      newOwner.recalcPublicVP();
      this.log(`[Tuyến dài nhất] ${newOwner.name} có Tuyến Dài Nhất (${maxLen})! +2 VP`);
    }
  }

  _updateLargestArmy() {
    // Đếm tổng số hiệp sĩ của từng người chơi (cả trên tay lẫn đã đánh)
    for (const player of this.players) {
      const knightCardsCount = (player.devCards || []).filter(c => c.type === 'KNIGHT').length;
      const playedCount = player.knightsPlayed || 0;
      player.totalKnights = Math.max(knightCardsCount, playedCount);
    }

    let maxKnights = Math.max(this.largestArmySize || 2, 2);
    let newOwner = this.largestArmyOwner;

    // Nếu người đang giữ danh hiệu không còn đủ tối thiểu 3 hiệp sĩ
    if (this.largestArmyOwner) {
      const currentOwnerCount = this.largestArmyOwner.totalKnights || 0;
      if (currentOwnerCount < 3) {
        this.largestArmyOwner.hasLargestArmy = false;
        this.largestArmyOwner.recalcPublicVP();
        this.largestArmyOwner = null;
        this.largestArmySize = 2;
        maxKnights = 2;
        newOwner = null;
      } else {
        maxKnights = currentOwnerCount;
        this.largestArmySize = currentOwnerCount;
      }
    }

    // Duyệt tìm người chơi sở hữu từ 3 Hiệp Sĩ trở lên
    for (const player of this.players) {
      const count = player.totalKnights || 0;
      if (count >= 3) {
        if (!newOwner) {
          // Chưa có ai giữ danh hiệu, người đầu tiên đạt >= 3 sẽ nhận ngay danh hiệu
          newOwner = player;
          maxKnights = count;
        } else if (newOwner && player.id !== newOwner.id && count > maxKnights) {
          // Người chơi mới phải có số lượng hiệp sĩ nhiều hơn người giữ cũ
          newOwner = player;
          maxKnights = count;
        }
      }
    }

    if (newOwner && newOwner !== this.largestArmyOwner) {
      if (this.largestArmyOwner) {
        this.largestArmyOwner.hasLargestArmy = false;
        this.largestArmyOwner.recalcPublicVP();
      }
      newOwner.hasLargestArmy = true;
      this.largestArmyOwner  = newOwner;
      this.largestArmySize   = maxKnights;
      newOwner.recalcPublicVP();
      this.log(`[Đạo quân] ${newOwner.name} đạt Quân Đội Lớn Nhất (${maxKnights} Hiệp Sĩ)! +2 VP`);
    } else if (newOwner && newOwner === this.largestArmyOwner) {
      if (!newOwner.hasLargestArmy) {
        newOwner.hasLargestArmy = true;
        newOwner.recalcPublicVP();
      }
      this.largestArmySize = Math.max(this.largestArmySize || 2, newOwner.totalKnights || 0);
    }
  }

  _buildIslandMap() {
    // Tạo map nhóm các ô đảo nhỏ theo khoảng cách
    return {};
  }

  _checkWin() {
    this._updateLargestArmy();
    this._updateLongestRoute();
    for (const player of this.players) {
      player.recalcPublicVP();
      if (player.totalVP() >= this.winningVP) {
        this.winner = player;
        this.phase  = Phase.GAME_OVER;
        this.log(`[Chiến thắng] ${player.name} THẮNG với ${player.totalVP()} điểm!`);
        return true;
      }
    }
    return false;
  }
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function desertCoordFrom(tiles, desertCoord) {
  if (desertCoord) return desertCoord;
  for (const tile of tiles.values()) {
    if (tile.type === TileType.DESERT) return { q: tile.q, r: tile.r };
  }
  return null;
}
