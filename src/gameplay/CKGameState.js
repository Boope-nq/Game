/**
 * CKGameState.js — GameState cho bản mở rộng Cities & Knights
 */

import { GameState, Phase } from './GameState.js';
import { CKPlayer } from '../entities/CKPlayer.js';
import { CK_CONFIG, improvementCost, handLimit } from './CKRulesConfig.js';
import { buildAllProgressDecks, buildProgressDeck, executeProgressCard } from './CKProgressCards.js';
import { 
  CommodityType, ALL_COMMODITIES, KnightLevel, KnightStatus, ImprovementTrack, 
  EventDieFace, EVENT_DIE_FACES, CKPhase, IMPROVEMENT_NAMES, KNIGHT_STRENGTH 
} from '../../shared/ck_constants.js';
import { isValidSettlementPlacement } from '../core/BoardGraph.js';
import { TileType } from '../core/HexTile.js';
import { hexKey } from '../core/HexGrid.js';
import { CKMetropolisEngine } from './CKMetropolisEngine.js';
import { CKKnightEngine } from './CKKnightEngine.js';
import { CKBarbarianEngine } from './CKBarbarianEngine.js';

// Helpers cho seed ngẫu nhiên
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

export class CKGameState extends GameState {
  constructor(numPlayers = 3, playerNames = null, seed = null) {
    super(numPlayers, playerNames, seed);
    this.ruleset = 'cities_knights';
    
    // Thay thế người chơi bằng CKPlayer
    this.players = Array.from({ length: numPlayers }, (_, i) =>
      new CKPlayer(i, playerNames?.[i] ?? `Người chơi ${i + 1}`)
    );

    // Ghi đè điều kiện thắng VP
    this.winningVP = CK_CONFIG.WIN_VP;

    // Tắt Dev Card của bản gốc
    this.devCardDeck = [];

    // Bỏ Largest Army
    this.largestArmyOwner = null;
    this.largestArmySize = 0;

    // Barbarian state (Tình trạng quân man rợ)
    this.barbarianPosition = 0;
    this.barbarianSteps = CK_CONFIG.barbarianSteps;
    this.barbarianAttackCount = 0;
    
    this.robberOnBoard = false;
    
    // Robber bắt đầu ở ngoài bàn chơi cho đến khi man rợ tấn công lần đầu
    if (this.robberPos) {
      const oldTile = this.tiles.get(hexKey(this.robberPos.q, this.robberPos.r));
      if (oldTile) oldTile.hasRobber = false;
    }
    this.robberPos = null;

    // Khởi tạo Progress Decks
    const pRand = seed ? makePRNG(stringToSeed(String(seed) + '_progress')) : Math.random;
    const initialDecks = buildAllProgressDecks();
    this.progressDecks = {
      science: shuffle(initialDecks.science, pRand),
      trade: shuffle(initialDecks.trade, pRand),
      politics: shuffle(initialDecks.politics, pRand)
    };

    // Metropolis owners (Chủ sở hữu siêu đô thị)
    this.metropolisOwner = {
      trade: null,
      politics: null,
      science: null
    };

    // Merchant (Thương nhân)
    this.merchantOwner = null;
    this.merchantHex = null;

    // Nguồn cung cấp hàng hóa (Commodity supply)
    this.commoditySupply = {
      PAPER: 12,
      CLOTH: 12,
      COIN: 12
    };

    // Defender tokens (Kỷ niệm chương bảo vệ Catan)
    this.defenderTokens = {};

    // Xúc xắc sự kiện
    this.lastEventDie = null;
    this.config = { ...CK_CONFIG };
  }

  /**
   * Đặt định cư hoặc thành phố trong giai đoạn setup.
   * Vòng 1: Định cư (như cơ bản).
   * Vòng 2: Thành phố (không phải định cư).
   */
  setupPlaceSettlement(vertexKey) {
    if (this.phase !== Phase.SETUP_SETTLEMENT) return { ok: false, reason: 'Sai phase' };

    const check = isValidSettlementPlacement(
      this.vertices, this.edges, vertexKey, this.currentPlayerIndex, true
    );
    if (!check.ok) return check;

    const player = this.currentPlayer;
    const vertex = this.vertices.get(vertexKey);

    if (this.setupRound === 1) {
      vertex.building = { playerId: player.id, type: 'settlement' };
      player.stock.settlements--;
      player.placed.settlements.push(vertexKey);
      this.setupSettlementVertex = vertexKey;
      this.log(`${player.name} đặt Định cư.`);
    } else if (this.setupRound === 2) {
      vertex.building = { playerId: player.id, type: 'city' };
      player.stock.cities--;
      player.placed.cities.push(vertexKey);
      this.setupSettlementVertex = vertexKey;
      this.log(`${player.name} đặt Thành phố (setup vòng 2).`);
      
      this._grantSetupResources(player, vertex);
    }

    this._updateHarborAccess(player, vertexKey);
    player.recalcPublicVP();
    this.phase = Phase.SETUP_ROAD;
    return { ok: true };
  }

  /**
   * Cấp tài nguyên vòng 2.
   * Ở C&K, vòng 2 đặt thành phố nhưng chỉ nhận 1 tài nguyên cơ bản mỗi ô. Không nhận hàng hóa.
   */
  _grantSetupResources(player, vertex) {
    for (const hex of vertex.hexes) {
      const tile = this.tiles.get(hexKey(hex.q, hex.r));
      if (!tile || !tile.producesResource) continue;

      if (tile.type === TileType.GOLD) {
        player.resources.GOLD = (player.resources.GOLD ?? 0) + 1;
        this.log(`${player.name} nhận 1 Vàng (GOLD) từ setup.`);
      } else {
        const res = tile.resource;
        player.resources[res] = (player.resources[res] ?? 0) + 1;
        this.log(`${player.name} nhận 1 ${res} từ setup.`);
      }
    }
  }

  /**
   * Chuyển đổi trạng thái sang JSON để gửi cho client.
   * Che giấu các thông tin bí mật (như nội dung thẻ Progress).
   */
  toJSON(maskForPlayerId = null) {
    let state = null;
    if (typeof super.toJSON === 'function') {
      state = super.toJSON(maskForPlayerId);
    } else {
      state = Object.assign({}, this);
    }
    
    // Thêm các thuộc tính đặc thù của Cities & Knights
    state.ruleset = this.ruleset;
    state.barbarianPosition = this.barbarianPosition;
    state.barbarianSteps = this.barbarianSteps;
    state.barbarianAttackCount = this.barbarianAttackCount;
    state.robberOnBoard = this.robberOnBoard;
    state.metropolisOwner = this.metropolisOwner;
    state.merchantOwner = this.merchantOwner;
    state.merchantHex = this.merchantHex;
    state.commoditySupply = this.commoditySupply;
    state.defenderTokens = this.defenderTokens;
    state.lastEventDie = this.lastEventDie;
    
    // Che giấu bộ bài Progress Decks (chỉ hiện số lượng thẻ còn lại)
    if (this.progressDecks) {
      state.progressDecks = {
        science: this.progressDecks.science.length,
        trade: this.progressDecks.trade.length,
        politics: this.progressDecks.politics.length
      };
    }
    
    return state;
  }

  // ─── Các hàm tiện ích (Helper methods) ───────────────────────────────────

  canPromoteToMighty(player) {
    return (player.improvements[ImprovementTrack.POLITICS] >= 3);
  }

  getHandLimit(player) {
    return player.getHandLimit ? player.getHandLimit() : (7 + (player.cityWalls?.length || 0) * 2);
  }

  isRobberActive() {
    return this.robberOnBoard;
  }

  hasCity(player) {
    return player.placed.cities.length > 0;
  }

  hasAvailableCityForMetropolis(player) {
    const cityCount = player.placed.cities.length;
    let metropolisCount = 0;
    if (this.metropolisOwner.trade === player.id) metropolisCount++;
    if (this.metropolisOwner.politics === player.id) metropolisCount++;
    if (this.metropolisOwner.science === player.id) metropolisCount++;
    return cityCount > metropolisCount;
  }

  // ─── M2: DICE & PRODUCTION ────────────────────────────────────────────────

  /**
   * Tung 3 xúc xắc (đỏ, vàng, sự kiện) theo luật C&K 5th Edition.
   * Event die được phân xử ĐẦU TIÊN:
   *  - Thuyền: Thuyền man rợ tiến 1 ô
   *  - Cổng thành (Science/Trade/Politics): Rút thẻ tiến bộ tương ứng với giá trị xúc xắc đỏ
   * Tiếp theo là xúc xắc sản xuất (Đỏ + Vàng):
   *  - Nếu tổng = 7: kiểm tra bỏ bài (giới hạn bài tính cả tường thành), Robber chỉ hoạt động nếu đã trên bàn
   *  - Nếu khác 7: phân phối tài nguyên & hàng hóa (Settlement vs City)
   */
  rollDice(forcedD1 = null, forcedD2 = null, forcedEvent = null) {
    if (this.phase !== Phase.ROLL) return { ok: false, reason: 'Chưa đến lúc tung xúc xắc' };

    let finalD1 = forcedD1;
    let finalD2 = forcedD2;

    // Nếu đã chơi thẻ Alchemist trước khi tung xúc xắc
    if (this.alchemistForcedDice) {
      finalD1 = this.alchemistForcedDice.d1;
      finalD2 = this.alchemistForcedDice.d2;
      this.alchemistForcedDice = null;
    }

    const d1 = (finalD1 !== null && finalD1 !== undefined) ? finalD1 : (Math.floor(Math.random() * 6) + 1);
    const d2 = (finalD2 !== null && finalD2 !== undefined) ? finalD2 : (Math.floor(Math.random() * 6) + 1);
    
    // Tung xúc xắc sự kiện (3 mặt thuyền, 3 mặt cổng thành)
    let eventDie = forcedEvent;
    if (!eventDie) {
      const faces = EVENT_DIE_FACES;
      eventDie = faces[Math.floor(Math.random() * faces.length)];
    }

    this.lastRoll = { d1, d2, total: d1 + d2, eventDie };
    this.lastEventDie = eventDie;
    this.rollCount++;

    this.log(`[Xúc xắc C&K] ${this.currentPlayer.name} tung Đỏ: ${d1}, Vàng: ${d2} (Tổng: ${d1 + d2}), Sự kiện: ${eventDie.toUpperCase()}`);

    // BƯỚC 1: Phân xử xúc xắc sự kiện TRƯỚC
    this._handleEventDie(eventDie, d1);

    // BƯỚC 2: Phân xử sản xuất (Production phase)
    if (this.lastRoll.total === 7) {
      this._handleSeven();
    } else {
      this._distributeResources(this.lastRoll.total);
    }

    return { ok: true, roll: this.lastRoll };
  }

  /**
   * Xử lý xúc xắc sự kiện
   */
  _handleEventDie(eventDie, redDieVal) {
    if (eventDie === EventDieFace.SHIP) {
      this._advanceBarbarianTrack();
    } else if ([ImprovementTrack.SCIENCE, ImprovementTrack.TRADE, ImprovementTrack.POLITICS].includes(eventDie)) {
      this._triggerProgressCardDraw(eventDie, redDieVal);
    }
  }

  /**
   * Di chuyển thuyền man rợ thêm 1 ô
   */
  _advanceBarbarianTrack() {
    this.barbarianPosition++;
    this.log(`[Man rợ] Thuyền man rợ tiến 1 bước! (Vị trí hiện tại: ${this.barbarianPosition}/${this.barbarianSteps})`);
    if (this.barbarianPosition >= this.barbarianSteps) {
      this.log(`⚔️ [Man rợ tấn công] Thuyền man rợ đã cập bến Catan!`);
      this._handleBarbarianAttack();
    }
  }

  /**
   * Kích hoạt rút thẻ tiến bộ theo màu cổng thành và giá trị xúc xắc đỏ
   * Thứ tự: Bắt đầu từ người chơi hiện tại rồi theo chiều kim đồng hồ
   */
  _triggerProgressCardDraw(track, redDieVal) {
    const range = CK_CONFIG.progressDrawRange;
    for (let i = 0; i < this.numPlayers; i++) {
      const pIdx = (this.currentPlayerIndex + i) % this.numPlayers;
      const player = this.players[pIdx];
      const level = player.improvements[track] || 0;
      
      if (level > 0 && redDieVal <= range[level]) {
        this._drawProgressCard(player, track);
      }
    }
  }

  /**
   * Rút 1 thẻ tiến bộ cho người chơi từ cọc bài tương ứng
   */
  _drawProgressCard(player, track) {
    const deck = this.progressDecks[track];
    if (!deck || deck.length === 0) {
      this.log(`[Thẻ tiến bộ] Cọc bài ${track} đã hết thẻ, ${player.name} không nhận được thẻ.`);
      return null;
    }

    const card = deck.shift();
    if (card.isVP) {
      card.played = true;
      card.revealed = true;
      player.progressCards.push(card);
      player.recalcPublicVP();
      this.log(`[Điểm chiến thắng] ${player.name} rút được thẻ Điểm Tiến Bộ (${card.id.toUpperCase()}) và ngửa mặt ngay lập tức! (+1 VP)`);
      this._checkWin();
    } else {
      player.progressCards.push(card);
      this.log(`[Thẻ tiến bộ] ${player.name} rút 1 thẻ tiến bộ ${track.toUpperCase()} (${card.id}).`);
    }
    return card;
  }

  /**
   * Tạm xử lý man rợ tấn công cho M2 (sẽ mở rộng đầy đủ ở M4)
   */
  _handleBarbarianAttack() {
    return CKBarbarianEngine.resolveAttack(this);
  }

  /**
   * Phân phối tài nguyên & hàng hóa theo bảng sản xuất City C&K
   */
  _distributeResources(number) {
    const playersReceivedAny = new Set();

    for (const tile of this.tiles.values()) {
      if (tile.number !== number) continue;
      if (tile.hasRobber) continue; // Robber chặn ô

      for (const [vKey, vertex] of this.vertices) {
        if (!vertex.building) continue;
        if (!vertex.hexes.some(h => h.q === tile.q && h.r === tile.r)) continue;

        const player = this.players[vertex.building.playerId];
        const isCity = vertex.building.type === 'city';

        if (isCity) {
          const prodRule = CK_CONFIG.CITY_PRODUCTION[tile.resource];
          if (prodRule) {
            // Nhận tài nguyên cơ bản
            if (prodRule.resQty > 0) {
              player.resources[prodRule.resource] = (player.resources[prodRule.resource] ?? 0) + prodRule.resQty;
              playersReceivedAny.add(player.id);
            }
            // Nhận hàng hóa (nếu có nguồn cung)
            if (prodRule.commodity && prodRule.comQty > 0) {
              const comType = prodRule.commodity;
              const available = this.commoditySupply[comType] ?? 0;
              const toGive = Math.min(available, prodRule.comQty);
              if (toGive > 0) {
                player.commodities[comType] = (player.commodities[comType] ?? 0) + toGive;
                this.commoditySupply[comType] -= toGive;
                playersReceivedAny.add(player.id);
                this.log(`[Hàng hóa] ${player.name} +${toGive} ${comType} từ Thành phố.`);
              } else {
                this.log(`[Hết hàng hóa] Kho hàng ${comType} đã cạn kiệt!`);
              }
            }
          } else {
            // Các ô đặc biệt khác (như Vàng nếu chơi cùng Seafarers)
            const amt = 2;
            player.resources[tile.resource] = (player.resources[tile.resource] ?? 0) + amt;
            playersReceivedAny.add(player.id);
          }
        } else {
          // Settlement chỉ nhận 1 tài nguyên cơ bản
          player.resources[tile.resource] = (player.resources[tile.resource] ?? 0) + 1;
          playersReceivedAny.add(player.id);
        }
      }
    }

    // Đặc quyền Khoa học cấp 3 (Cống dẫn nước - Aqueduct):
    // Nếu trong lượt này bạn không nhận được bất kỳ thẻ nào từ sản xuất (không tính số 7)
    // thì được chọn 1 tài nguyên cơ bản bất kỳ.
    for (const player of this.players) {
      if ((player.improvements.science || 0) >= 3 && !playersReceivedAny.has(player.id)) {
        player.aqueductPending = true;
        this.log(`[Cống dẫn nước] ${player.name} không nhận được sản lượng nào, kích hoạt quyền nhận 1 tài nguyên tự chọn!`);
      }
    }

    this.phase = Phase.BUILD;
  }

  /**
   * Kích hoạt quyền Cống dẫn nước (Aqueduct) lấy 1 tài nguyên tự chọn
   */
  claimAqueductResource(playerId, resourceType) {
    const player = this.players[playerId];
    if (!player || !player.aqueductPending) {
      return { ok: false, reason: 'Không có quyền nhận tài nguyên từ Cống dẫn nước' };
    }
    const valid = ['BRICK', 'LUMBER', 'GRAIN', 'WOOL', 'ORE'];
    if (!valid.includes(resourceType)) {
      return { ok: false, reason: 'Chỉ được chọn 1 trong 5 tài nguyên cơ bản' };
    }

    player.resources[resourceType] = (player.resources[resourceType] ?? 0) + 1;
    player.aqueductPending = false;
    this.log(`[Cống dẫn nước] ${player.name} đã nhận 1 ${resourceType}.`);
    return { ok: true };
  }

  /**
   * Xử lý khi gieo vào số 7:
   * 1. Kiểm tra discard: Mỗi người chơi có > giới hạn (7 + tường thành * 2) phải bỏ 1/2
   * 2. Tên cướp chỉ di chuyển nếu đã ở trên bàn (sau đợt tấn công đầu tiên của man rợ)
   */
  _handleSeven() {
    const mustDiscard = this.players.filter(p => {
      const limit = p.getHandLimit ? p.getHandLimit() : (7 + (p.cityWalls?.length || 0) * 2);
      const totalCards = p.totalCards ? p.totalCards() : Object.values(p.resources).reduce((a, b) => a + b, 0);
      return totalCards > limit;
    });

    if (mustDiscard.length > 0) {
      this.discardPending = mustDiscard.map(p => p.id);
      this.phase = Phase.DISCARD;
      this.log(`[Bỏ bài] ${mustDiscard.map(p => p.name).join(', ')} có quá giới hạn bài, phải bỏ bớt một nửa!`);
    } else {
      this._proceedAfterDiscardOrSeven();
    }
  }

  _proceedAfterDiscardOrSeven() {
    if (this.robberOnBoard) {
      this.phase = Phase.ROBBER;
      this.log(`[Tên cướp] Số 7! ${this.currentPlayer.name} di chuyển Tên cướp.`);
    } else {
      this.phase = Phase.BUILD;
      this.log(`[Tên cướp] Tên cướp chưa xuất hiện trên đảo, không di chuyển hay cướp bài.`);
    }
  }

  /**
   * Người chơi bỏ bài khi vượt quá giới hạn lúc đổ ra 7
   */
  discardResources(playerId, toDiscard) {
    const player = this.players[playerId];
    if (!player) return { ok: false };

    const totalCards = player.totalCards ? player.totalCards() : 0;
    const required = Math.floor(totalCards / 2);
    const discardCount = Object.values(toDiscard).reduce((a, b) => a + b, 0);

    if (discardCount !== required) {
      return { ok: false, reason: `Phải bỏ đúng ${required} thẻ (tài nguyên hoặc hàng hóa)` };
    }

    // Kiểm tra có đủ số thẻ để bỏ không
    for (const [key, n] of Object.entries(toDiscard)) {
      if (['PAPER', 'CLOTH', 'COIN'].includes(key)) {
        if ((player.commodities[key] ?? 0) < n) return { ok: false, reason: `Không đủ hàng hóa ${key}` };
      } else {
        if ((player.resources[key] ?? 0) < n) return { ok: false, reason: `Không đủ tài nguyên ${key}` };
      }
    }

    // Khấu trừ
    for (const [key, n] of Object.entries(toDiscard)) {
      if (['PAPER', 'CLOTH', 'COIN'].includes(key)) {
        player.commodities[key] -= n;
        this.commoditySupply[key] = (this.commoditySupply[key] ?? 0) + n; // Trả về kho
      } else {
        player.resources[key] -= n;
      }
    }

    this.discardPending = this.discardPending.filter(id => id !== playerId);
    this.log(`${player.name} đã bỏ ${discardCount} thẻ.`);

    if (this.discardPending.length === 0) {
      this._proceedAfterDiscardOrSeven();
    }
    return { ok: true };
  }

  /**
   * Cướp tài nguyên/hàng hóa ngẫu nhiên
   */
  stealFrom(victimId, forcedPick = null) {
    if (this.phase !== Phase.STEAL) return { ok: false };
    if (!this.stealTargets.includes(victimId)) return { ok: false, reason: 'Không thể cướp người này' };

    const thief = this.currentPlayer;
    const victim = this.players[victimId];
    let stolen = forcedPick;

    if (!stolen) {
      stolen = victim.stealRandom();
    } else {
      if (stolen.type === 'resource') victim.resources[stolen.key]--;
      else victim.commodities[stolen.key]--;
    }

    if (stolen) {
      if (stolen.type === 'resource') {
        thief.resources[stolen.key] = (thief.resources[stolen.key] ?? 0) + 1;
        this.log(`${thief.name} cướp 1 ${stolen.key} từ ${victim.name}.`);
      } else {
        thief.commodities[stolen.key] = (thief.commodities[stolen.key] ?? 0) + 1;
        this.log(`${thief.name} cướp 1 hàng hóa ${stolen.key} từ ${victim.name}.`);
      }
    } else {
      this.log(`${victim.name} không có bài để cướp.`);
    }

    this.stealTargets = [];
    this.phase = Phase.BUILD;
    return { ok: true, stolen };
  }

  // ─── M2: TRADING MỞ RỘNG (COMMODITIES & SPECIAL ABILITIES) ──────────────────

  /**
   * Trao đổi với Ngân hàng:
   *  - Mặc định 4:1 (hoặc 3:1 qua cảng chung).
   *  - Có thể đổi Hàng hóa lấy Tài nguyên hoặc Hàng hóa khác theo tỷ lệ chung (4:1 hoặc 3:1 nếu có cảng chung).
   *  - Cảng 2:1 tài nguyên chuyên dụng chỉ áp dụng cho đúng tài nguyên đó.
   *  - Nếu có Merchant Fleet: 2:1 cho tài nguyên/hàng hóa đã chọn.
   */
  tradeWithBank(giveItem, giveAmount, receiveItem) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    const isGiveCommodity = ['PAPER', 'CLOTH', 'COIN'].includes(giveItem);
    const isReceiveCommodity = ['PAPER', 'CLOTH', 'COIN'].includes(receiveItem);

    if (giveItem === receiveItem) return { ok: false, reason: 'Không thể trao đổi cùng loại thẻ' };

    let requiredRate = 4;

    // Kiểm tra Merchant Fleet
    if (player.merchantFleetResource === giveItem) {
      requiredRate = 2;
    } else if (isGiveCommodity) {
      // Hàng hóa dùng tỷ lệ 3:1 nếu có cảng chung, ngược lại 4:1
      requiredRate = player.harborAccess?.has('GENERIC') ? 3 : 4;
    } else {
      // Tài nguyên bình thường
      requiredRate = this._getTradeRate(player, giveItem);
    }

    if (giveAmount !== requiredRate) {
      return { ok: false, reason: `Tỷ lệ đổi yêu cầu là ${requiredRate}:1 cho ${giveItem}` };
    }

    // Kiểm tra đủ thẻ để đưa
    const currentGiveQty = isGiveCommodity ? (player.commodities[giveItem] ?? 0) : (player.resources[giveItem] ?? 0);
    if (currentGiveQty < giveAmount) {
      return { ok: false, reason: `Không đủ ${giveItem}` };
    }

    // Nếu nhận hàng hóa, kiểm tra nguồn cung ngân hàng
    if (isReceiveCommodity && (this.commoditySupply[receiveItem] ?? 0) <= 0) {
      return { ok: false, reason: `Ngân hàng đã hết hàng hóa ${receiveItem}` };
    }

    // Thực hiện khấu trừ
    if (isGiveCommodity) {
      player.commodities[giveItem] -= giveAmount;
      this.commoditySupply[giveItem] = (this.commoditySupply[giveItem] ?? 0) + giveAmount;
    } else {
      player.resources[giveItem] -= giveAmount;
    }

    // Thực hiện nhận
    if (isReceiveCommodity) {
      player.commodities[receiveItem] = (player.commodities[receiveItem] ?? 0) + 1;
      this.commoditySupply[receiveItem]--;
    } else {
      player.resources[receiveItem] = (player.resources[receiveItem] ?? 0) + 1;
    }

    this.log(`[Ngân hàng] ${player.name}: ${giveAmount} ${giveItem} ➔ 1 ${receiveItem}`);
    return { ok: true, rate: requiredRate };
  }

  /**
   * Kỹ năng Thương mại cấp 3 (Hội thương nhân - Trading House):
   * Đổi 2 hàng hóa cùng loại lấy bất kỳ 1 hàng hóa hoặc tài nguyên nào khác.
   */
  tradeCommodity2to1(giveCommodity, receiveItem) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    if ((player.improvements.trade || 0) < 3) {
      return { ok: false, reason: 'Cần nâng cấp Thương mại cấp 3 (Hội thương nhân) để đổi hàng hóa 2:1' };
    }
    if (!['PAPER', 'CLOTH', 'COIN'].includes(giveCommodity)) {
      return { ok: false, reason: 'Chỉ áp dụng khi đưa ra hàng hóa' };
    }
    if ((player.commodities[giveCommodity] ?? 0) < 2) {
      return { ok: false, reason: `Cần ít nhất 2 ${giveCommodity}` };
    }
    if (giveCommodity === receiveItem) {
      return { ok: false, reason: 'Không đổi cùng loại' };
    }

    const isReceiveCommodity = ['PAPER', 'CLOTH', 'COIN'].includes(receiveItem);
    if (isReceiveCommodity && (this.commoditySupply[receiveItem] ?? 0) <= 0) {
      return { ok: false, reason: `Ngân hàng đã hết hàng hóa ${receiveItem}` };
    }

    player.commodities[giveCommodity] -= 2;
    this.commoditySupply[giveCommodity] = (this.commoditySupply[giveCommodity] ?? 0) + 2;

    if (isReceiveCommodity) {
      player.commodities[receiveItem] = (player.commodities[receiveItem] ?? 0) + 1;
      this.commoditySupply[receiveItem]--;
    } else {
      player.resources[receiveItem] = (player.resources[receiveItem] ?? 0) + 1;
    }

    this.log(`[Hội thương nhân] ${player.name} đổi 2:1: 2 ${giveCommodity} ➔ 1 ${receiveItem}`);
    return { ok: true };
  }

  /**
   * Trao đổi với Merchant (Thương nhân):
   * Trong khi kiểm soát thương nhân, bạn có thể đổi TÀI NGUYÊN của ô thương nhân theo tỷ lệ 2:1 với ngân hàng.
   */
  tradeWithMerchant(giveAmount, receiveItem) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const player = this.currentPlayer;

    if (this.merchantOwner !== player.id || !this.merchantHex) {
      return { ok: false, reason: 'Bạn không nắm giữ Thương nhân' };
    }

    const hexTile = this.tiles.get(hexKey(this.merchantHex.q, this.merchantHex.r));
    if (!hexTile || !hexTile.resource) {
      return { ok: false, reason: 'Ô của Thương nhân không có tài nguyên hợp lệ' };
    }

    const merchantResource = hexTile.resource;
    if (giveAmount !== 2) {
      return { ok: false, reason: 'Tỷ lệ đổi với Thương nhân là 2:1' };
    }
    if ((player.resources[merchantResource] ?? 0) < 2) {
      return { ok: false, reason: `Không đủ 2 ${merchantResource}` };
    }
    if (merchantResource === receiveItem) {
      return { ok: false, reason: 'Không đổi cùng loại tài nguyên' };
    }

    const isReceiveCommodity = ['PAPER', 'CLOTH', 'COIN'].includes(receiveItem);
    if (isReceiveCommodity && (this.commoditySupply[receiveItem] ?? 0) <= 0) {
      return { ok: false, reason: `Ngân hàng đã hết hàng hóa ${receiveItem}` };
    }

    player.resources[merchantResource] -= 2;
    if (isReceiveCommodity) {
      player.commodities[receiveItem] = (player.commodities[receiveItem] ?? 0) + 1;
      this.commoditySupply[receiveItem]--;
    } else {
      player.resources[receiveItem] = (player.resources[receiveItem] ?? 0) + 1;
    }

    this.log(`[Thương nhân 2:1] ${player.name}: 2 ${merchantResource} ➔ 1 ${receiveItem}`);
    return { ok: true };
  }

  /**
   * Trao đổi giữa người chơi với nhau (hỗ trợ cả Tài nguyên và Hàng hóa)
   */
  tradeWithPlayer(targetId, give, receive) {
    if (this.phase !== Phase.BUILD) return { ok: false, reason: 'Sai phase' };
    const p1 = this.currentPlayer;
    const p2 = this.players[targetId];
    if (!p2 || p2.id === p1.id) return { ok: false, reason: 'Người chơi không hợp lệ' };

    // Kiểm tra p1 có đủ bài đưa không
    for (const [k, n] of Object.entries(give)) {
      const isCom = ['PAPER', 'CLOTH', 'COIN'].includes(k);
      const have = isCom ? (p1.commodities[k] ?? 0) : (p1.resources[k] ?? 0);
      if (have < n) return { ok: false, reason: `${p1.name} không đủ ${k}` };
    }

    // Kiểm tra p2 có đủ bài đưa không
    for (const [k, n] of Object.entries(receive)) {
      const isCom = ['PAPER', 'CLOTH', 'COIN'].includes(k);
      const have = isCom ? (p2.commodities[k] ?? 0) : (p2.resources[k] ?? 0);
      if (have < n) return { ok: false, reason: `${p2.name} không đủ ${k}` };
    }

    // Chuyển giao
    for (const [k, n] of Object.entries(give)) {
      if (['PAPER', 'CLOTH', 'COIN'].includes(k)) {
        p1.commodities[k] -= n;
        p2.commodities[k] = (p2.commodities[k] ?? 0) + n;
      } else {
        p1.resources[k] -= n;
        p2.resources[k] = (p2.resources[k] ?? 0) + n;
      }
    }

    for (const [k, n] of Object.entries(receive)) {
      if (['PAPER', 'CLOTH', 'COIN'].includes(k)) {
        p2.commodities[k] -= n;
        p1.commodities[k] = (p1.commodities[k] ?? 0) + n;
      } else {
        p2.resources[k] -= n;
        p1.resources[k] = (p1.resources[k] ?? 0) + n;
      }
    }

    this.log(`[Trao đổi] ${p1.name} ↔ ${p2.name} đã trao đổi thành công.`);
    return { ok: true };
  }

  // ─── M3: CITY IMPROVEMENTS & METROPOLIS & WALLS ──────────────────────────

  /**
   * Mua nâng cấp thành phố
   * @param {'trade'|'politics'|'science'} track
   * @param {Object} [options] - { useCrane?: boolean }
   */
  buyImprovement(track, options = {}) {
    return CKMetropolisEngine.buyImprovement(this.currentPlayer, track, this, options);
  }

  /**
   * Xây dựng Tường thành tại thành phố
   * @param {string} vertexKey
   */
  buildCityWall(vertexKey) {
    return CKMetropolisEngine.buildCityWall(this.currentPlayer, vertexKey, this);
  }

  /**
   * Kiểm tra thành phố có được miễn nhiễm cướp phá không (do có Đại đô thị)
   * @param {string} vertexKey
   * @returns {boolean}
   */
  isCityImmuneToPillage(vertexKey) {
    for (const player of this.players) {
      for (const m of player.metropolises || []) {
        if (m.vertexKey === vertexKey) return true;
      }
    }
    return false;
  }

  // ─── M4: KNIGHT ACTIONS & BARBARIANS ──────────────────────────────────────

  recruitKnight(vertexKey) {
    return CKKnightEngine.recruitKnight(this.currentPlayer, vertexKey, this);
  }

  promoteKnight(knightId, options = {}) {
    return CKKnightEngine.promoteKnight(this.currentPlayer, knightId, this, options);
  }

  activateKnight(knightId, options = {}) {
    return CKKnightEngine.activateKnight(this.currentPlayer, knightId, this, options);
  }

  moveKnight(knightId, targetVertexKey) {
    return CKKnightEngine.moveKnight(this.currentPlayer, knightId, targetVertexKey, this);
  }

  displaceKnight(knightId, targetVertexKey) {
    return CKKnightEngine.displaceKnight(this.currentPlayer, knightId, targetVertexKey, this);
  }

  chaseRobber(knightId) {
    return CKKnightEngine.chaseRobber(this.currentPlayer, knightId, this);
  }

  triggerBarbarianAttack() {
    return CKBarbarianEngine.resolveAttack(this);
  }

  /**
   * Cập nhật tuyến đường dài nhất có tính đến việc Hiệp sĩ đối phương chặn đường
   */
  _updateLongestRoute() {
    // 1. Đồng bộ vertex.knight từ tất cả hiệp sĩ của người chơi
    for (const v of this.vertices.values()) {
      v.knight = null;
    }
    for (const player of this.players) {
      for (const knight of player.knights || []) {
        const v = this.vertices.get(knight.vertexKey);
        if (v) {
          v.knight = { playerId: player.id, level: knight.level, active: knight.active };
        }
      }
    }

    // 2. Gọi logic tính toán của lớp cha (sử dụng BoardGraph đã hỗ trợ vertex.knight)
    super._updateLongestRoute();
  }

  // ─── M5: PROGRESS CARDS ───────────────────────────────────────────────────

  playProgressCard(cardId, options = {}) {
    return executeProgressCard(cardId, this.currentPlayer, options, this);
  }
}





