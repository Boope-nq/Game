/**
 * CKProgressCards.js — Hiện thực toàn bộ 54 thẻ tiến bộ Thành phố & Hiệp sĩ (5th Edition)
 *
 * 3 bộ × 18 thẻ:
 * 1. Khoa học (Science - xanh lá, 18 thẻ):
 *    - Alchemist (2): Chọn kết quả 2 xúc xắc sản xuất trước khi tung, xúc xắc sự kiện tung bình thường.
 *    - Crane (2): Nâng cấp thành phố giảm 1 hàng hóa (cấp 1 thành miễn phí).
 *    - Engineer (1): Xây 1 tường thành miễn phí.
 *    - Inventor (2): Đổi 2 đĩa số bất kỳ trừ 2, 6, 8, 12 (robber không di chuyển).
 *    - Irrigation (2): Lấy 2 lúa cho mỗi ô đồng bằng (Fields) kề ít nhất 1 công trình của mình.
 *    - Medicine (2): Nâng cấp định cư lên thành phố chỉ với 1 lúa + 2 quặng.
 *    - Mining (2): Lấy 2 quặng cho mỗi ô núi (Mountains) kề ít nhất 1 công trình của mình.
 *    - Printer (1): 1 Điểm chiến thắng (ngửa mặt ngay khi rút).
 *    - Road Building (2): Xây 2 đường (hoặc tàu) miễn phí.
 *    - Smith (2): Thăng cấp tối đa 2 hiệp sĩ miễn phí (mỗi hiệp sĩ vẫn tuân thủ max 1 lần/lượt).
 *
 * 2. Thương mại (Trade - vàng, 18 thẻ):
 *    - Commercial Harbor (2): Đưa 1 tài nguyên cho mỗi người chơi khác, mỗi người phải đưa lại 1 hàng hóa tự chọn (nếu có).
 *    - Master Merchant (2): Xem bài người có nhiều VP hơn mình, lấy 2 thẻ tài nguyên/hàng hóa tùy chọn.
 *    - Merchant (6): Lấy thương nhân đặt lên ô kề công trình của mình (+1 VP, đổi 2:1 tài nguyên của ô đó).
 *    - Merchant Fleet (2): Đổi 2:1 tại ngân hàng với 1 loại tài nguyên/hàng hóa trong suốt lượt này.
 *    - Resource Monopoly (4): Đọc tên 1 tài nguyên, mỗi người khác phải nộp 2 thẻ đó (hoặc 1 nếu chỉ có 1).
 *    - Trade Monopoly (2): Đọc tên 1 hàng hóa, mỗi người khác phải nộp 1 thẻ đó (nếu có).
 *
 * 3. Chính trị (Politics - xanh dương, 18 thẻ):
 *    - Diplomat (2): Gỡ 1 con đường "hở" (không nối tiếp) của đối thủ trả về kho (hoặc của mình và được xây lại 1 đường miễn phí).
 *    - Spy (3): Xem các thẻ tiến bộ của người khác và cướp 1 thẻ (trừ thẻ VP).
 *    - Warlord (2): Kích hoạt toàn bộ hiệp sĩ của mình miễn phí.
 *    - Intrigue (2): Đẩy lùi hiệp sĩ đối phương trên giao điểm nối với đường của mình (không cần dùng hiệp sĩ).
 *    - Bishop (2): Di chuyển Tên cướp và cướp 1 thẻ từ MỖI người có công trình tại ô mới (chỉ chơi được khi Robber đã trên bàn).
 *    - Constitution (1): 1 Điểm chiến thắng (ngửa mặt ngay khi rút).
 *    - Deserter (2): Chọn 1 người chơi khác, họ phải tự chọn gỡ 1 hiệp sĩ trả về kho; bạn được đặt 1 hiệp sĩ cùng cấp hoặc thấp hơn từ kho.
 *    - Wedding (2): Mỗi người chơi có NHIỀU VP hơn bạn phải tặng bạn 2 thẻ tài nguyên/hàng hóa tự chọn.
 *    - Saboteur (2): Mỗi người chơi có BẰNG HOẶC NHIỀU VP hơn bạn phải bỏ nửa số thẻ bài trên tay (làm tròn xuống).
 */

import { CK_CONFIG } from './CKRulesConfig.js';
import { KnightLevel } from '../../shared/ck_constants.js';
import { CKKnightEngine } from './CKKnightEngine.js';
import { hexKey } from '../core/HexGrid.js';

// ─── Định nghĩa 54 thẻ tiến bộ ──────────────────────────────────────────────

export const PROGRESS_CARD_DEFS = {
  // ═══ KHOA HỌC (SCIENCE) — 18 thẻ ═══
  alchemist:        { id: 'alchemist',        deck: 'science',  qty: 2, isVP: false },
  crane:            { id: 'crane',            deck: 'science',  qty: 2, isVP: false },
  engineer:         { id: 'engineer',         deck: 'science',  qty: 1, isVP: false },
  inventor:         { id: 'inventor',         deck: 'science',  qty: 2, isVP: false },
  irrigation:       { id: 'irrigation',       deck: 'science',  qty: 2, isVP: false },
  medicine:         { id: 'medicine',         deck: 'science',  qty: 2, isVP: false },
  mining:           { id: 'mining',           deck: 'science',  qty: 2, isVP: false },
  printer:          { id: 'printer',          deck: 'science',  qty: 1, isVP: true  },
  road_building:    { id: 'road_building',    deck: 'science',  qty: 2, isVP: false },
  smith:            { id: 'smith',            deck: 'science',  qty: 2, isVP: false },

  // ═══ THƯƠNG MẠI (TRADE) — 18 thẻ ═══
  commercial_harbor:{ id: 'commercial_harbor', deck: 'trade',   qty: 2, isVP: false },
  master_merchant:  { id: 'master_merchant',  deck: 'trade',    qty: 2, isVP: false },
  merchant:         { id: 'merchant',         deck: 'trade',    qty: 6, isVP: false },
  merchant_fleet:   { id: 'merchant_fleet',   deck: 'trade',    qty: 2, isVP: false },
  resource_monopoly:{ id: 'resource_monopoly', deck: 'trade',   qty: 4, isVP: false },
  trade_monopoly:   { id: 'trade_monopoly',   deck: 'trade',    qty: 2, isVP: false },

  // ═══ CHÍNH TRỊ (POLITICS) — 18 thẻ ═══
  diplomat:         { id: 'diplomat',         deck: 'politics', qty: 2, isVP: false },
  spy:              { id: 'spy',             deck: 'politics', qty: 3, isVP: false },
  warlord:          { id: 'warlord',         deck: 'politics', qty: 2, isVP: false },
  intrigue:         { id: 'intrigue',        deck: 'politics', qty: 2, isVP: false },
  bishop:           { id: 'bishop',          deck: 'politics', qty: 2, isVP: false },
  constitution:     { id: 'constitution',    deck: 'politics', qty: 1, isVP: true  },
  deserter:         { id: 'deserter',        deck: 'politics', qty: 2, isVP: false },
  wedding:          { id: 'wedding',         deck: 'politics', qty: 2, isVP: false },
  saboteur:         { id: 'saboteur',        deck: 'politics', qty: 2, isVP: false },
};

export function buildProgressDeck(deckName) {
  const cards = [];
  let uidCounter = 0;
  for (const def of Object.values(PROGRESS_CARD_DEFS)) {
    if (def.deck !== deckName) continue;
    for (let i = 0; i < def.qty; i++) {
      cards.push({
        uid: `${deckName}_${def.id}_${uidCounter++}`,
        id: def.id,
        deck: deckName,
        type: def.id,
        isVP: def.isVP,
      });
    }
  }
  return cards;
}

export function buildAllProgressDecks() {
  return {
    science:  buildProgressDeck('science'),
    trade:    buildProgressDeck('trade'),
    politics: buildProgressDeck('politics'),
  };
}

export function validateDeckSizes(decks) {
  const expected = { science: 18, trade: 18, politics: 18 };
  for (const [name, deck] of Object.entries(decks)) {
    if (deck.length !== expected[name]) {
      throw new Error(`Deck ${name}: expected ${expected[name]} cards, got ${deck.length}`);
    }
  }
  return true;
}

// ─── THỰC THI HIỆU ỨNG TỪNG THẺ TIẾN BỘ (EXECUTION ENGINE) ──────────────────

export class CKProgressCardsEngine {
  /**
   * Đánh thẻ tiến bộ
   * @param {string} cardId
   * @param {Object} player
   * @param {Object} options
   * @param {Object} gameState
   * @returns {{ ok: boolean, reason?: string, data?: Object }}
   */
  static playCard(cardId, player, options, gameState) {
    // 1. Kiểm tra player có thẻ này trong tay không
    const cardIdx = player.progressCards.findIndex(c => c.id === cardId && !c.isVP);
    if (cardIdx === -1) {
      return { ok: false, reason: `Bạn không có thẻ ${cardId} trong tay` };
    }

    // 2. Kiểm tra phase hợp lệ:
    // Alchemist: CHỈ chơi ở Phase.ROLL trước khi gieo xúc xắc
    if (cardId === 'alchemist') {
      if (gameState.phase !== 'ROLL') {
        return { ok: false, reason: 'Thẻ Alchemist chỉ có thể chơi trước khi tung xúc xắc (Phase.ROLL)' };
      }
    } else {
      if (gameState.phase !== 'BUILD') {
        return { ok: false, reason: 'Chỉ có thể đánh thẻ tiến bộ trong lượt xây dựng/hành động của bạn' };
      }
    }

    // 3. Thực thi hiệu ứng cụ thể
    const execResult = this._execute(cardId, player, options, gameState);
    if (!execResult.ok) {
      return execResult;
    }

    // 4. Nếu thành công: Loại thẻ khỏi tay và đưa xuống đáy cọc bài tương ứng
    const [usedCard] = player.progressCards.splice(cardIdx, 1);
    const deckName = PROGRESS_CARD_DEFS[cardId]?.deck;
    if (deckName && gameState.progressDecks[deckName]) {
      gameState.progressDecks[deckName].push(usedCard);
    }

    gameState.log(`✨ [Đánh thẻ tiến bộ] ${player.name} sử dụng thẻ ${cardId.toUpperCase()}!`);
    return execResult;
  }

  static _execute(cardId, player, options, gameState) {
    switch (cardId) {
      // ═══════════════ KHOA HỌC (SCIENCE) ═══════════════
      case 'alchemist': {
        const { d1, d2 } = options;
        if (!d1 || !d2 || d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) {
          return { ok: false, reason: 'Phải chọn giá trị hợp lệ từ 1-6 cho cả 2 xúc xắc sản xuất' };
        }
        gameState.alchemistForcedDice = { d1, d2 };
        gameState.log(`[Nhà giả kim] ${player.name} chọn trước kết quả xúc xắc: ${d1} + ${d2} = ${d1 + d2}!`);
        return { ok: true, forcedDice: { d1, d2 } };
      }

      case 'crane': {
        player.craneUsedThisTurn = true;
        gameState.log(`[Cần cẩu] ${player.name} kích hoạt giảm 1 hàng hóa cho lần nâng cấp tiếp theo trong lượt.`);
        return { ok: true };
      }

      case 'engineer': {
        const { vertexKey } = options;
        if (!vertexKey) return { ok: false, reason: 'Cần chỉ định vị trí thành phố để xây tường thành' };
        if (player.cityWalls.length >= CK_CONFIG.MAX_WALLS_PER_PLAYER || player.wallStock <= 0) {
          return { ok: false, reason: 'Đã hết tường thành trong kho hoặc đạt giới hạn tối đa' };
        }
        const vertex = gameState.vertices.get(vertexKey);
        if (!vertex || vertex.building?.playerId !== player.id || vertex.building.type !== 'city') {
          return { ok: false, reason: 'Chỉ xây tường thành dưới thành phố của bạn' };
        }
        if (player.cityWalls.includes(vertexKey)) {
          return { ok: false, reason: 'Thành phố này đã có tường thành' };
        }
        player.wallStock--;
        player.cityWalls.push(vertexKey);
        gameState.log(`[Kỹ sư] ${player.name} xây 1 tường thành MIỄN PHÍ tại thành phố!`);
        return { ok: true };
      }

      case 'inventor': {
        const { hex1, hex2 } = options;
        if (!hex1 || !hex2) return { ok: false, reason: 'Phải chọn 2 ô số để hoán đổi' };
        const t1 = gameState.getTile(hex1.q, hex1.r);
        const t2 = gameState.getTile(hex2.q, hex2.r);
        if (!t1 || !t2 || !t1.number || !t2.number) {
          return { ok: false, reason: 'Cả 2 ô phải có đĩa số hợp lệ' };
        }
        const banned = [2, 6, 8, 12];
        if (banned.includes(t1.number) || banned.includes(t2.number)) {
          return { ok: false, reason: 'Không được hoán đổi các đĩa số 2, 6, 8, 12' };
        }
        const temp = t1.number;
        t1.number = t2.number;
        t2.number = temp;
        gameState.log(`[Nhà phát minh] ${player.name} hoán đổi đĩa số giữa (${hex1.q},${hex1.r}) và (${hex2.q},${hex2.r})!`);
        return { ok: true };
      }

      case 'irrigation': {
        let fieldCount = 0;
        for (const tile of gameState.tiles.values()) {
          if (tile.resource === 'GRAIN') {
            const hasAdjacentBuilding = [...gameState.vertices.values()].some(v =>
              v.building?.playerId === player.id && v.hexes.some(h => h.q === tile.q && h.r === tile.r)
            );
            if (hasAdjacentBuilding) fieldCount++;
          }
        }
        const wheatGained = fieldCount * 2;
        player.resources.GRAIN = (player.resources.GRAIN ?? 0) + wheatGained;
        gameState.log(`[Thủy lợi] ${player.name} kề ${fieldCount} ô Cánh đồng ➔ nhận +${wheatGained} Lúa!`);
        return { ok: true, wheatGained };
      }

      case 'medicine': {
        const { vertexKey } = options;
        if (!vertexKey) return { ok: false, reason: 'Cần chỉ định định cư để nâng cấp' };
        const vertex = gameState.vertices.get(vertexKey);
        if (!vertex || vertex.building?.playerId !== player.id || vertex.building.type !== 'settlement') {
          return { ok: false, reason: 'Chỉ nâng cấp định cư của bạn' };
        }
        if (player.stock.cities <= 0) return { ok: false, reason: 'Hết thành phố trong kho' };
        // Chi phí ưu đãi: 1 Lúa + 2 Quặng
        if ((player.resources.GRAIN ?? 0) < 1 || (player.resources.ORE ?? 0) < 2) {
          return { ok: false, reason: 'Cần 1 Lúa và 2 Quặng để nâng cấp bằng Y học' };
        }
        player.resources.GRAIN -= 1;
        player.resources.ORE -= 2;
        player.stock.cities--;
        player.stock.settlements++;
        player.placed.settlements = player.placed.settlements.filter(k => k !== vertexKey);
        player.placed.cities.push(vertexKey);
        vertex.building = { playerId: player.id, type: 'city' };
        player.recalcPublicVP();
        gameState._checkWin();
        gameState.log(`[Y học] ${player.name} nâng cấp Thành phố với giá ưu đãi (1 Lúa + 2 Quặng)!`);
        return { ok: true };
      }

      case 'mining': {
        let mountainCount = 0;
        for (const tile of gameState.tiles.values()) {
          if (tile.resource === 'ORE') {
            const hasAdjacentBuilding = [...gameState.vertices.values()].some(v =>
              v.building?.playerId === player.id && v.hexes.some(h => h.q === tile.q && h.r === tile.r)
            );
            if (hasAdjacentBuilding) mountainCount++;
          }
        }
        const oreGained = mountainCount * 2;
        player.resources.ORE = (player.resources.ORE ?? 0) + oreGained;
        gameState.log(`[Khai khoáng] ${player.name} kề ${mountainCount} ô Núi ➔ nhận +${oreGained} Quặng!`);
        return { ok: true, oreGained };
      }

      case 'road_building': {
        const { edges } = options; // [eKey1, eKey2]
        if (!Array.isArray(edges) || edges.length === 0 || edges.length > 2) {
          return { ok: false, reason: 'Chỉ định 1 hoặc 2 cạnh để xây đường/tàu' };
        }
        for (const eKey of edges) {
          const edge = gameState.edges.get(eKey);
          if (!edge || edge.piece !== null) continue;
          if (player.stock.roads > 0) {
            edge.piece = { playerId: player.id, type: 'road' };
            player.stock.roads--;
            player.placed.roads.push(eKey);
          }
        }
        gameState._updateLongestRoute();
        gameState.log(`[Xây đường] ${player.name} xây đường miễn phí!`);
        return { ok: true };
      }

      case 'smith': {
        const { knightIds } = options; // [id1, id2]
        if (!Array.isArray(knightIds) || knightIds.length === 0 || knightIds.length > 2) {
          return { ok: false, reason: 'Chọn tối đa 2 hiệp sĩ để thăng cấp miễn phí' };
        }
        for (const kId of knightIds) {
          CKKnightEngine.promoteKnight(player, kId, gameState, { free: true });
        }
        return { ok: true };
      }

      // ═══════════════ THƯƠNG MẠI (TRADE) ═══════════════
      case 'commercial_harbor': {
        const { offerResource, choicesByPlayer } = options;
        if (!['BRICK', 'LUMBER', 'GRAIN', 'WOOL', 'ORE'].includes(offerResource)) {
          return { ok: false, reason: 'Phải chọn 1 tài nguyên cơ bản để trao đổi' };
        }
        let totalExchanges = 0;
        for (const other of gameState.players) {
          if (other.id === player.id) continue;
          const chosenCom = choicesByPlayer?.[other.id];
          if (chosenCom && ['PAPER', 'CLOTH', 'COIN'].includes(chosenCom) && (other.commodities[chosenCom] ?? 0) > 0) {
            if ((player.resources[offerResource] ?? 0) > 0) {
              player.resources[offerResource]--;
              other.resources[offerResource] = (other.resources[offerResource] ?? 0) + 1;
              other.commodities[chosenCom]--;
              player.commodities[chosenCom] = (player.commodities[chosenCom] ?? 0) + 1;
              totalExchanges++;
            }
          }
        }
        gameState.log(`[Cảng thương mại] ${player.name} hoàn tất ${totalExchanges} giao dịch đổi tài nguyên lấy hàng hóa!`);
        return { ok: true, totalExchanges };
      }

      case 'master_merchant': {
        const { targetPlayerId, takeCards } = options; // takeCards: { LUMBER: 1, PAPER: 1 }
        const target = gameState.players[targetPlayerId];
        if (!target || target.id === player.id) return { ok: false, reason: 'Người chơi không hợp lệ' };
        if (target.victoryPoints <= player.victoryPoints) {
          return { ok: false, reason: 'Chỉ được nhắm vào người chơi có nhiều Điểm chiến thắng (VP) hơn bạn' };
        }
        let count = 0;
        for (const [k, n] of Object.entries(takeCards || {})) {
          const isCom = ['PAPER', 'CLOTH', 'COIN'].includes(k);
          const has = isCom ? (target.commodities[k] ?? 0) : (target.resources[k] ?? 0);
          const takeAmt = Math.min(has, n);
          if (isCom) {
            target.commodities[k] -= takeAmt;
            player.commodities[k] = (player.commodities[k] ?? 0) + takeAmt;
          } else {
            target.resources[k] -= takeAmt;
            player.resources[k] = (player.resources[k] ?? 0) + takeAmt;
          }
          count += takeAmt;
        }
        gameState.log(`[Đại thương gia] ${player.name} lấy ${count} thẻ từ ${target.name}!`);
        return { ok: true, count };
      }

      case 'merchant': {
        const { hex } = options;
        if (!hex) return { ok: false, reason: 'Phải chọn 1 ô lục địa kề công trình' };
        const tile = gameState.getTile(hex.q, hex.r);
        if (!tile || !tile.resource) return { ok: false, reason: 'Ô không hợp lệ hoặc không có tài nguyên' };
        const hasAdjacentBuilding = [...gameState.vertices.values()].some(v =>
          v.building?.playerId === player.id && v.hexes.some(h => h.q === hex.q && h.r === hex.r)
        );
        if (!hasAdjacentBuilding) {
          return { ok: false, reason: 'Thương nhân phải được đặt kề ít nhất 1 công trình của bạn' };
        }
        // Chuyển quyền kiểm soát Thương nhân
        if (gameState.merchantOwner !== null && gameState.merchantOwner !== player.id) {
          const oldOwner = gameState.players[gameState.merchantOwner];
          oldOwner.hasMerchant = false;
          oldOwner.recalcPublicVP();
        }
        gameState.merchantOwner = player.id;
        gameState.merchantHex = { q: hex.q, r: hex.r };
        player.hasMerchant = true;
        player.recalcPublicVP();
        gameState._checkWin();
        gameState.log(`[Thương nhân] ${player.name} giành quyền kiểm soát Thương nhân (+1 VP) tại ô (${hex.q},${hex.r})!`);
        return { ok: true };
      }

      case 'merchant_fleet': {
        const { resourceOrCommodity } = options;
        const valid = ['BRICK', 'LUMBER', 'GRAIN', 'WOOL', 'ORE', 'PAPER', 'CLOTH', 'COIN'];
        if (!valid.includes(resourceOrCommodity)) {
          return { ok: false, reason: 'Loại tài nguyên hoặc hàng hóa không hợp lệ' };
        }
        player.merchantFleetResource = resourceOrCommodity;
        gameState.log(`[Đội tàu buôn] ${player.name} được quyền đổi 2:1 với ngân hàng cho ${resourceOrCommodity} trong suốt lượt này!`);
        return { ok: true };
      }

      case 'resource_monopoly': {
        const { resource } = options;
        if (!['BRICK', 'LUMBER', 'GRAIN', 'WOOL', 'ORE'].includes(resource)) {
          return { ok: false, reason: 'Phải chọn 1 tài nguyên cơ bản' };
        }
        let total = 0;
        for (const other of gameState.players) {
          if (other.id === player.id) continue;
          const avail = other.resources[resource] ?? 0;
          const give = Math.min(2, avail);
          other.resources[resource] -= give;
          player.resources[resource] = (player.resources[resource] ?? 0) + give;
          total += give;
        }
        gameState.log(`[Độc quyền tài nguyên] ${player.name} thu được ${total} ${resource} từ các đối thủ!`);
        return { ok: true, totalGained: total };
      }

      case 'trade_monopoly': {
        const { commodity } = options;
        if (!['PAPER', 'CLOTH', 'COIN'].includes(commodity)) {
          return { ok: false, reason: 'Phải chọn 1 hàng hóa (PAPER, CLOTH, COIN)' };
        }
        let total = 0;
        for (const other of gameState.players) {
          if (other.id === player.id) continue;
          const avail = other.commodities[commodity] ?? 0;
          const give = Math.min(1, avail);
          other.commodities[commodity] -= give;
          player.commodities[commodity] = (player.commodities[commodity] ?? 0) + give;
          total += give;
        }
        gameState.log(`[Độc quyền hàng hóa] ${player.name} thu được ${total} ${commodity} từ các đối thủ!`);
        return { ok: true, totalGained: total };
      }

      // ═══════════════ CHÍNH TRỊ (POLITICS) ═══════════════
      case 'diplomat': {
        const { targetEdgeKey } = options;
        const edge = gameState.edges.get(targetEdgeKey);
        if (!edge || !edge.piece || edge.piece.type !== 'road') {
          return { ok: false, reason: 'Cạnh không có đường để gỡ bỏ' };
        }
        const roadOwner = gameState.players[edge.piece.playerId];
        edge.piece = null;
        roadOwner.placed.roads = roadOwner.placed.roads.filter(k => k !== targetEdgeKey);
        roadOwner.stock.roads++;
        if (roadOwner.id === player.id && options.freeEdgeKey) {
          // Xây lại đường của mình miễn phí
          const freeEdge = gameState.edges.get(options.freeEdgeKey);
          if (freeEdge && freeEdge.piece === null) {
            freeEdge.piece = { playerId: player.id, type: 'road' };
            player.stock.roads--;
            player.placed.roads.push(options.freeEdgeKey);
          }
        }
        gameState._updateLongestRoute();
        gameState.log(`[Nhà ngoại giao] ${player.name} dỡ bỏ 1 con đường tại cạnh ${targetEdgeKey}!`);
        return { ok: true };
      }

      case 'spy': {
        const { targetPlayerId, cardIdToSteal } = options;
        const target = gameState.players[targetPlayerId];
        if (!target || target.id === player.id) return { ok: false, reason: 'Người chơi không hợp lệ' };
        const stealIdx = target.progressCards.findIndex(c => c.id === cardIdToSteal && !c.isVP);
        if (stealIdx === -1) {
          return { ok: false, reason: 'Đối phương không có thẻ tiến bộ này (hoặc là thẻ điểm VP không thể cướp)' };
        }
        const [stolenCard] = target.progressCards.splice(stealIdx, 1);
        player.progressCards.push(stolenCard);
        gameState.log(`[Gián điệp] ${player.name} xem bài và cướp thẻ ${stolenCard.id.toUpperCase()} từ ${target.name}!`);
        return { ok: true };
      }

      case 'warlord': {
        let count = 0;
        for (const k of player.knights) {
          if (!k.active) {
            k.active = true;
            count++;
          }
        }
        gameState.log(`[Thống soái] ${player.name} kích hoạt MIỄN PHÍ toàn bộ ${count} hiệp sĩ của mình!`);
        return { ok: true, activatedCount: count };
      }

      case 'intrigue': {
        const { targetVertexKey } = options;
        const kData = CKKnightEngine.getKnightAtVertex(targetVertexKey, gameState);
        if (!kData || kData.player.id === player.id) {
          return { ok: false, reason: 'Phải chọn hiệp sĩ của đối phương' };
        }
        // Đẩy lùi đối phương mà không cần hiệp sĩ của mình
        const oppKnight = kData.knight;
        const oppPlayer = kData.player;
        const escapeSpots = CKKnightEngine.getValidEscapeVertices(oppKnight, oppPlayer.id, gameState, targetVertexKey);
        if (escapeSpots.length > 0) {
          oppKnight.vertexKey = escapeSpots[0];
          gameState.log(`[Âm mưu] Hiệp sĩ của ${oppPlayer.name} bị đuổi sang vị trí mới!`);
        } else {
          oppPlayer.knights = oppPlayer.knights.filter(k => k.id !== oppKnight.id);
          oppPlayer.knightSupply[oppKnight.level]++;
          gameState.log(`[Âm mưu] Hiệp sĩ của ${oppPlayer.name} không còn đường lui nên bị loại về kho!`);
        }
        return { ok: true };
      }

      case 'bishop': {
        if (!gameState.robberOnBoard) {
          return { ok: false, reason: 'Chỉ chơi được Giám mục sau khi Tên cướp đã xuất hiện trên bàn' };
        }
        const { hex } = options;
        if (!hex) return { ok: false, reason: 'Phải chọn ô để di chuyển Tên cướp' };
        
        const prevPhase = gameState.phase;
        gameState.phase = 'ROBBER';
        const moveRes = gameState.moveRobber(hex.q, hex.r);
        if (!moveRes.ok) {
          gameState.phase = prevPhase;
          return moveRes;
        }
        // Cướp 1 thẻ từ MỖI người chơi có công trình tại ô mới
        let totalStolen = 0;
        for (const victimId of moveRes.victims || []) {
          const victim = gameState.players[victimId];
          const stolen = victim.stealRandom();
          if (stolen) {
            if (stolen.type === 'resource') player.resources[stolen.key] = (player.resources[stolen.key] ?? 0) + 1;
            else player.commodities[stolen.key] = (player.commodities[stolen.key] ?? 0) + 1;
            totalStolen++;
          }
        }
        gameState.phase = 'BUILD';
        gameState.log(`[Giám mục] ${player.name} di chuyển Tên cướp và cướp bài từ tất cả ${totalStolen} người chơi kề bên!`);
        return { ok: true, totalStolen };
      }

      case 'deserter': {
        const { victimId, victimKnightId, placeVertexKey } = options;
        const victim = gameState.players[victimId];
        if (!victim || victim.id === player.id) return { ok: false, reason: 'Nạn nhân không hợp lệ' };
        if (victim.knights.length === 0) {
          gameState.log(`[Kẻ đào ngũ] ${victim.name} không có hiệp sĩ nào.`);
          return { ok: true, noKnights: true };
        }
        const kIdx = victim.knights.findIndex(k => k.id === victimKnightId);
        if (kIdx === -1) return { ok: false, reason: 'Hiệp sĩ của nạn nhân không hợp lệ' };
        const [removedKnight] = victim.knights.splice(kIdx, 1);
        victim.knightSupply[removedKnight.level]++;

        // Người chơi đặt hiệp sĩ có cấp bằng hoặc thấp hơn từ kho của mình
        if (placeVertexKey && (player.knightSupply[removedKnight.level] ?? 0) > 0) {
          player.knightSupply[removedKnight.level]--;
          player.knights.push({
            id: `k_${player.id}_${Date.now()}`,
            playerId: player.id,
            vertexKey: placeVertexKey,
            level: removedKnight.level,
            active: removedKnight.active,
          });
        }
        gameState.log(`[Kẻ đào ngũ] Hiệp sĩ của ${victim.name} đã đào ngũ!`);
        return { ok: true };
      }

      case 'wedding': {
        let totalReceived = 0;
        for (const other of gameState.players) {
          if (other.id === player.id) continue;
          if (other.victoryPoints > player.victoryPoints) {
            // Nộp 2 thẻ
            const choices = options.giftsByPlayer?.[other.id] || {};
            for (const [k, n] of Object.entries(choices)) {
              const isCom = ['PAPER', 'CLOTH', 'COIN'].includes(k);
              const avail = isCom ? (other.commodities[k] ?? 0) : (other.resources[k] ?? 0);
              const giveAmt = Math.min(avail, n);
              if (isCom) {
                other.commodities[k] -= giveAmt;
                player.commodities[k] = (player.commodities[k] ?? 0) + giveAmt;
              } else {
                other.resources[k] -= giveAmt;
                player.resources[k] = (player.resources[k] ?? 0) + giveAmt;
              }
              totalReceived += giveAmt;
            }
          }
        }
        gameState.log(`[Đám cưới] ${player.name} nhận được ${totalReceived} quà mừng cưới từ các đối thủ dẫn đầu!`);
        return { ok: true, totalReceived };
      }

      case 'saboteur': {
        let affectedCount = 0;
        for (const other of gameState.players) {
          if (other.id === player.id) continue;
          if (other.victoryPoints >= player.victoryPoints) {
            const total = other.totalCards();
            const toDiscard = Math.floor(total / 2);
            // Tự động bỏ ngẫu nhiên hoặc theo choices
            let discarded = 0;
            while (discarded < toDiscard) {
              const picked = other.stealRandom();
              if (!picked) break;
              discarded++;
            }
            affectedCount++;
          }
        }
        gameState.log(`[Kẻ phá hoại] ${affectedCount} đối thủ dẫn đầu đã bị phá hoại và phải bỏ nửa số thẻ trên tay!`);
        return { ok: true, affectedCount };
      }

      default:
        return { ok: false, reason: `Chưa có cài đặt cho thẻ ${cardId}` };
    }
  }
}

/**
 * Proxy helper kết nối với API GameState
 */
export function executeProgressCard(cardId, player, options, gameState) {
  return CKProgressCardsEngine.playCard(cardId, player, options, gameState);
}
