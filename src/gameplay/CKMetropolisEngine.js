/**
 * CKMetropolisEngine.js — Xử lý logic Nâng cấp thành phố (City Improvements) và Đại đô thị (Metropolis)
 *
 * Luật Catan C&K 5th Edition:
 * - 3 nhánh: Trade (Thương mại), Politics (Chính trị), Science (Khoa học).
 * - Mỗi nhánh có 5 cấp (tối đa cấp 5).
 * - Chi phí cấp N = N hàng hóa tương ứng (L1: 1, L2: 2, L3: 3, L4: 4, L5: 5).
 *   (Thương mại = Vải, Chính trị = Đồng xu, Khoa học = Giấy).
 * - Thẻ Crane (Cần cẩu): Giảm 1 hàng hóa cho 1 lần nâng cấp (tối đa 1 Crane/lần, cấp 1 thành miễn phí).
 * - Điều kiện: Phải có ít nhất 1 thành phố trên bàn để mua nâng cấp. Nếu mất thành phố cuối cùng,
 *   người chơi vẫn giữ cấp độ đã nâng nhưng không thể mua thêm cho đến khi xây lại thành phố.
 * - Mua cấp 4 hoặc 5: Phải có sẵn một thành phố chưa có Đại đô thị (Metropolis).
 * - Người đầu tiên đạt Cấp 4 của một nhánh sẽ nhận Đại đô thị của nhánh đó (+2 VP).
 * - Nếu người chơi khác đạt Cấp 5 trong khi chủ sở hữu hiện tại chỉ ở Cấp 4, người đạt Cấp 5 sẽ cướp Đại đô thị
 *   (chủ cũ mất 2 VP, Đại đô thị chuyển sang thành phố của chủ mới). Nếu chủ cũ cũng đạt Cấp 5, họ giữ lại nó.
 * - Một thành phố chỉ gắn được tối đa 1 Đại đô thị.
 * - Thành phố có Đại đô thị không bao giờ bị quân man rợ cướp phá (immune to pillage).
 */

import { CK_CONFIG, improvementCost } from './CKRulesConfig.js';
import { ImprovementTrack } from '../../shared/ck_constants.js';

export class CKMetropolisEngine {
  /**
   * Mua nâng cấp thành phố
   * @param {Object} player - CKPlayer
   * @param {'trade'|'politics'|'science'} track
   * @param {Object} gameState - CKGameState
   * @param {Object} [options] - { useCrane?: boolean }
   * @returns {{ ok: boolean, reason?: string, newLevel?: number, metropolisAwarded?: boolean, metropolisStolen?: boolean }}
   */
  static buyImprovement(player, track, gameState, options = {}) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Chỉ được nâng cấp trong giai đoạn hành động (BUILD)' };
    }
    if (player.id !== gameState.currentPlayer.id) {
      return { ok: false, reason: 'Chỉ người chơi hiện tại mới được nâng cấp' };
    }

    const validTracks = [ImprovementTrack.TRADE, ImprovementTrack.POLITICS, ImprovementTrack.SCIENCE];
    if (!validTracks.includes(track)) {
      return { ok: false, reason: `Nhánh nâng cấp không hợp lệ: ${track}` };
    }

    // 1. Phải có ít nhất 1 thành phố trên bàn
    if (!player.placed.cities || player.placed.cities.length === 0) {
      return { ok: false, reason: 'Phải sở hữu ít nhất 1 thành phố trên bàn để mua nâng cấp' };
    }

    const currentLevel = player.improvements[track] || 0;
    if (currentLevel >= CK_CONFIG.MAX_IMPROVEMENT_LEVEL) {
      return { ok: false, reason: `Nhánh ${track} đã đạt cấp tối đa (${CK_CONFIG.MAX_IMPROVEMENT_LEVEL})` };
    }

    const nextLevel = currentLevel + 1;
    const requiredCommodity = CK_CONFIG.TRACK_COMMODITY[track];

    // 2. Kiểm tra điều kiện Metropolis khi mua cấp 4 hoặc 5
    if (nextLevel >= CK_CONFIG.METROPOLIS_LEVEL) {
      const availableCity = this.getAvailableCityForMetropolis(player, track, gameState);
      if (!availableCity) {
        return { ok: false, reason: 'Không có thành phố trống (chưa có Đại đô thị) để tiếp nhận Đại đô thị' };
      }
    }

    // 3. Tính toán chi phí (có xét thẻ Crane)
    let costAmount = nextLevel;
    let craneUsed = false;
    if (options.useCrane && !player.craneUsedThisTurn) {
      costAmount = Math.max(0, costAmount - 1);
      craneUsed = true;
    }

    // Kiểm tra hàng hóa
    if ((player.commodities[requiredCommodity] ?? 0) < costAmount) {
      return {
        ok: false,
        reason: `Không đủ ${costAmount} ${requiredCommodity} (hiện có: ${player.commodities[requiredCommodity] ?? 0})`
      };
    }

    // 4. Thanh toán
    if (costAmount > 0) {
      player.commodities[requiredCommodity] -= costAmount;
      gameState.commoditySupply[requiredCommodity] = (gameState.commoditySupply[requiredCommodity] ?? 0) + costAmount;
    }
    if (craneUsed) {
      player.craneUsedThisTurn = true;
      gameState.log(`[Thẻ Crane] ${player.name} dùng Crane giảm 1 ${requiredCommodity} cho nâng cấp.`);
    }

    // 5. Nâng cấp
    player.improvements[track] = nextLevel;
    gameState.log(`[Nâng cấp thành phố] ${player.name} nâng cấp ${track.toUpperCase()} lên Cấp ${nextLevel}!`);

    // 6. Xử lý cấp quyền Đại đô thị (Metropolis)
    const metroResult = this.checkAndAssignMetropolis(player, track, nextLevel, gameState);

    // Kiểm tra thắng ngay nếu VP đạt ngưỡng
    player.recalcPublicVP();
    gameState._checkWin();

    return {
      ok: true,
      newLevel: nextLevel,
      costPaid: costAmount,
      commodity: requiredCommodity,
      ...metroResult
    };
  }

  /**
   * Tìm thành phố hợp lệ của người chơi chưa có Đại đô thị
   * @param {Object} player
   * @param {string} track
   * @param {Object} gameState
   * @returns {string|null} vertexKey của thành phố
   */
  static getAvailableCityForMetropolis(player, track, gameState) {
    if (!player.placed.cities || player.placed.cities.length === 0) return null;

    // Tìm tất cả các vertex thành phố đã có Đại đô thị
    const takenVertices = new Set();
    for (const otherPlayer of gameState.players) {
      for (const metro of otherPlayer.metropolises || []) {
        takenVertices.add(metro.vertexKey);
      }
    }

    // Tìm thành phố của người chơi chưa bị gắn Đại đô thị
    for (const cityVertex of player.placed.cities) {
      if (!takenVertices.has(cityVertex)) {
        return cityVertex;
      }
    }
    return null;
  }

  /**
   * Kiểm tra và trao quyền sở hữu Đại đô thị
   * @param {Object} player
   * @param {string} track
   * @param {number} level
   * @param {Object} gameState
   * @returns {{ metropolisAwarded: boolean, metropolisStolen: boolean }}
   */
  static checkAndAssignMetropolis(player, track, level, gameState) {
    let metropolisAwarded = false;
    let metropolisStolen = false;

    const currentOwnerId = gameState.metropolisOwner[track];

    if (level === CK_CONFIG.METROPOLIS_LEVEL) {
      // Đạt cấp 4: Người đầu tiên đạt Cấp 4 nhận Đại đô thị
      if (currentOwnerId === null) {
        const targetCity = this.getAvailableCityForMetropolis(player, track, gameState);
        if (targetCity) {
          this.assignMetropolisToPlayer(player, track, targetCity, gameState);
          metropolisAwarded = true;
          gameState.log(`🏛️ [Đại đô thị] ${player.name} là người đầu tiên đạt Cấp 4 nhánh ${track.toUpperCase()} và nhận Đại đô thị (+2 VP)!`);
        }
      }
    } else if (level === CK_CONFIG.MAX_IMPROVEMENT_LEVEL) {
      // Đạt cấp 5:
      if (currentOwnerId === null) {
        // Chưa ai có (hiếm), trao cho người chơi
        const targetCity = this.getAvailableCityForMetropolis(player, track, gameState);
        if (targetCity) {
          this.assignMetropolisToPlayer(player, track, targetCity, gameState);
          metropolisAwarded = true;
          gameState.log(`🏛️ [Đại đô thị] ${player.name} đạt Cấp 5 nhánh ${track.toUpperCase()} và nhận Đại đô thị (+2 VP)!`);
        }
      } else if (currentOwnerId !== player.id) {
        // Đang có người khác giữ, kiểm tra xem chủ cũ ở cấp mấy
        const currentOwner = gameState.players[currentOwnerId];
        const currentOwnerLevel = currentOwner.improvements[track] || 0;

        if (currentOwnerLevel < CK_CONFIG.MAX_IMPROVEMENT_LEVEL) {
          // Chủ cũ chỉ ở cấp 4 -> Người chơi cấp 5 CƯỚP Đại đô thị!
          const targetCity = this.getAvailableCityForMetropolis(player, track, gameState);
          if (targetCity) {
            // Tước quyền chủ cũ
            this.removeMetropolisFromPlayer(currentOwner, track, gameState);
            // Trao cho chủ mới
            this.assignMetropolisToPlayer(player, track, targetCity, gameState);
            metropolisStolen = true;
            gameState.log(`⚔️ [Cướp Đại đô thị] ${player.name} đạt Cấp 5 nhánh ${track.toUpperCase()} và cướp Đại đô thị từ ${currentOwner.name}! (+2 VP)`);
          }
        }
      }
    }

    return { metropolisAwarded, metropolisStolen };
  }

  /**
   * Trao Đại đô thị cho người chơi
   */
  static assignMetropolisToPlayer(player, track, vertexKey, gameState) {
    if (!player.metropolises) player.metropolises = [];
    player.metropolises.push({ track, vertexKey });
    gameState.metropolisOwner[track] = player.id;
    player.recalcPublicVP();
  }

  /**
   * Xóa Đại đô thị khỏi người chơi
   */
  static removeMetropolisFromPlayer(player, track, gameState) {
    if (!player.metropolises) return;
    player.metropolises = player.metropolises.filter(m => m.track !== track);
    if (gameState.metropolisOwner[track] === player.id) {
      gameState.metropolisOwner[track] = null;
    }
    player.recalcPublicVP();
  }

  /**
   * Xây dựng Tường thành (City Wall)
   * Chi phí: 2 Gạch (2 BRICK), max 1 tường / thành phố, max 3 tường / người chơi trên bàn.
   * Mỗi tường thành tăng giới hạn cầm bài lên +2.
   */
  static buildCityWall(player, vertexKey, gameState) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Chỉ được xây tường thành trong lượt xây dựng' };
    }
    if (player.id !== gameState.currentPlayer.id) {
      return { ok: false, reason: 'Chỉ người chơi hiện tại mới được xây' };
    }

    // 1. Phải là thành phố của người chơi
    const vertex = gameState.vertices.get(vertexKey);
    if (!vertex || !vertex.building || vertex.building.playerId !== player.id || vertex.building.type !== 'city') {
      return { ok: false, reason: 'Tường thành chỉ có thể đặt dưới Thành phố của bạn' };
    }

    // 2. Thành phố chưa có tường thành
    if (player.cityWalls.includes(vertexKey)) {
      return { ok: false, reason: 'Thành phố này đã có tường thành' };
    }

    // 3. Tối đa 3 tường thành
    if (player.cityWalls.length >= CK_CONFIG.MAX_WALLS_PER_PLAYER) {
      return { ok: false, reason: `Đã đạt giới hạn tối đa ${CK_CONFIG.MAX_WALLS_PER_PLAYER} tường thành` };
    }
    if (player.wallStock <= 0) {
      return { ok: false, reason: 'Hết tường thành trong kho' };
    }

    // 4. Chi phí: 2 Gạch (hoặc miễn phí nếu dùng thẻ Engineer)
    const cost = CK_CONFIG.COSTS.cityWall;
    if ((player.resources.BRICK ?? 0) < cost.BRICK) {
      return { ok: false, reason: 'Cần 2 Gạch để xây tường thành' };
    }

    player.resources.BRICK -= cost.BRICK;
    player.wallStock--;
    player.cityWalls.push(vertexKey);
    gameState.log(`[Tường thành] ${player.name} xây Tường thành tại thành phố! Giới hạn bài tăng lên ${player.getHandLimit()}.`);

    return { ok: true, handLimit: player.getHandLimit() };
  }
}
