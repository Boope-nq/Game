/**
 * CKKnightEngine.js — Xử lý logic Hiệp sĩ (Knights) theo luật C&K 5th Edition
 *
 * Luật chi tiết:
 * 1. Sức mạnh: Basic (1), Strong (2), Mighty (3). Mỗi người có kho: 2 basic, 2 strong, 2 mighty.
 * 2. Chiêu mộ (Recruit):
 *    - Đặt BASIC knight trên giao điểm (vertex) trống nối với mạng lưới đường của mình.
 *    - LUẬT KHOẢNG CÁCH (Distance rule) KHÔNG ÁP DỤNG với hiệp sĩ (có thể đặt cạnh nhau).
 *    - Ban đầu ở trạng thái CHƯA KÍCH HOẠT (inactive).
 *    - Chi phí: 1 Cừu + 1 Quặng (1 WOOL + 1 ORE).
 * 3. Thăng cấp (Promote):
 *    - Nâng cấp lên bậc kế tiếp (basic -> strong, strong -> mighty).
 *    - Giữ nguyên trạng thái active/inactive.
 *    - Mỗi hiệp sĩ chỉ được thăng cấp tối đa 1 lần / lượt (promote once per turn).
 *    - Lên Mighty (tinh nhuệ) yêu cầu Chính trị Cấp >= 3 (Fortress).
 *    - Phải còn quân cờ bậc cao hơn trong kho.
 *    - Chi phí: 1 Cừu + 1 Quặng.
 * 4. Kích hoạt (Activate):
 *    - Trả 1 Lúa (1 GRAIN).
 *    - Có thể chiêu mộ rồi kích hoạt ngay trong cùng lượt.
 *    - Có thể hành động xong rồi tái kích hoạt trong cùng lượt.
 *    - KHÔNG ĐƯỢC kích hoạt rồi hành động ngay trong cùng lượt (chỉ hiệp sĩ đã active từ đầu lượt hành động mới được hành động).
 * 5. Hành động của hiệp sĩ (Knight actions):
 *    - Chỉ hiệp sĩ đã ACTIVE lúc bắt đầu action phase (không phải vừa kích hoạt lượt này) mới được hành động.
 *    - Sau khi hành động, hiệp sĩ trở thành INACTIVE.
 *    a) Di chuyển (Move): Đi đến 1 vertex trống có thể tới được dọc theo tuyến đường của mình.
 *    b) Đẩy lùi (Displace): Đi vào vertex có hiệp sĩ đối phương YẾU HƠN dọc theo tuyến đường. Hiệp sĩ bị đẩy lùi phải di chuyển sang vị trí hợp lệ hoặc bị trả về kho nếu không còn đường đi.
 *    c) Đuổi tên cướp (Chase Robber): Hiệp sĩ active kề ô Tên cướp kích hoạt di chuyển tên cướp (và cướp bài như bình thường). Chỉ làm được khi Tên cướp đã ở trên bàn cờ.
 * 6. Hiệp sĩ chặn đường và điểm định cư:
 *    - Hiệp sĩ chặn đối phương đặt đường/định cư qua giao điểm đó.
 *    - Hiệp sĩ đối phương ngắt tuyến đường dài nhất (Longest Road) giống như công trình.
 */

import { CK_CONFIG } from './CKRulesConfig.js';
import { KnightLevel, KnightStatus, ImprovementTrack } from '../../shared/ck_constants.js';

export class CKKnightEngine {
  /**
   * Chiêu mộ hiệp sĩ bậc 1 (Basic Knight)
   * @param {Object} player - CKPlayer
   * @param {string} vertexKey
   * @param {Object} gameState - CKGameState
   * @returns {{ ok: boolean, reason?: string, knight?: Object }}
   */
  static recruitKnight(player, vertexKey, gameState) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Chỉ được chiêu mộ hiệp sĩ trong giai đoạn hành động (BUILD)' };
    }
    if (player.id !== gameState.currentPlayer.id) {
      return { ok: false, reason: 'Chỉ người chơi hiện tại mới được chiêu mộ' };
    }

    // 1. Kiểm tra kho hiệp sĩ basic
    if ((player.knightSupply.basic ?? 0) <= 0) {
      return { ok: false, reason: 'Hết hiệp sĩ thường (Basic) trong kho' };
    }

    // 2. Chi phí: 1 Cừu + 1 Quặng
    const cost = CK_CONFIG.COSTS.recruitKnight;
    if ((player.resources.WOOL ?? 0) < cost.WOOL || (player.resources.ORE ?? 0) < cost.ORE) {
      return { ok: false, reason: 'Cần 1 Cừu và 1 Quặng để chiêu mộ hiệp sĩ' };
    }

    // 3. Kiểm tra vị trí vertex hợp lệ
    const vertex = gameState.vertices.get(vertexKey);
    if (!vertex) return { ok: false, reason: 'Vị trí không tồn tại' };
    if (!vertex.hasLand) return { ok: false, reason: 'Chỉ đặt hiệp sĩ trên đất liền hoặc bờ biển' };

    // Không được trùng công trình hoặc hiệp sĩ khác
    if (vertex.building !== null) {
      return { ok: false, reason: 'Vị trí đã có công trình' };
    }
    const existingKnight = this.getKnightAtVertex(vertexKey, gameState);
    if (existingKnight !== null) {
      return { ok: false, reason: 'Vị trí đã có hiệp sĩ' };
    }

    // Phải kết nối với đường hoặc tàu của người chơi (không áp dụng distance rule)
    const isConnected = [...vertex.adjacentEdges].some(eKey => {
      const edge = gameState.edges.get(eKey);
      return edge?.piece?.playerId === player.id;
    });
    if (!isConnected) {
      return { ok: false, reason: 'Hiệp sĩ phải được đặt tại giao điểm nối với đường hoặc tàu của bạn' };
    }

    // 4. Trừ tài nguyên và kho
    player.resources.WOOL -= cost.WOOL;
    player.resources.ORE -= cost.ORE;
    player.knightSupply.basic--;

    // 5. Tạo hiệp sĩ mới (inactive ban đầu)
    const knightId = `k_${player.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newKnight = {
      id: knightId,
      playerId: player.id,
      vertexKey,
      level: KnightLevel.BASIC,
      active: false,
      recruitedThisTurn: true,
    };
    player.knights.push(newKnight);

    gameState.log(`⚔️ [Chiêu mộ hiệp sĩ] ${player.name} chiêu mộ 1 Hiệp sĩ thường (Basic) tại giao điểm!`);
    return { ok: true, knight: newKnight };
  }

  /**
   * Thăng cấp hiệp sĩ (Promote)
   * Basic -> Strong -> Mighty
   * @param {Object} player
   * @param {string} knightId
   * @param {Object} gameState
   * @param {Object} [options] - { free?: boolean } (dùng thẻ Smith)
   */
  static promoteKnight(player, knightId, gameState, options = {}) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Chỉ được thăng cấp trong giai đoạn hành động (BUILD)' };
    }
    if (player.id !== gameState.currentPlayer.id) {
      return { ok: false, reason: 'Chỉ người chơi hiện tại mới được thăng cấp' };
    }

    const knight = player.knights.find(k => k.id === knightId);
    if (!knight) return { ok: false, reason: 'Không tìm thấy hiệp sĩ này' };

    // Mỗi hiệp sĩ chỉ được thăng cấp 1 lần / lượt
    if (player.knightsPromotedThisTurn.has(knightId)) {
      return { ok: false, reason: 'Mỗi hiệp sĩ chỉ được thăng cấp tối đa 1 lần trong mỗi lượt' };
    }

    if (knight.level === KnightLevel.MIGHTY) {
      return { ok: false, reason: 'Hiệp sĩ đã ở cấp cao nhất (Mighty)' };
    }

    // Xác định cấp tiếp theo
    const nextLevel = (knight.level === KnightLevel.BASIC) ? KnightLevel.STRONG : KnightLevel.MIGHTY;

    // Lên Mighty yêu cầu Chính trị Cấp 3 (Fortress)
    if (nextLevel === KnightLevel.MIGHTY && (player.improvements.politics || 0) < 3) {
      return { ok: false, reason: 'Cần nâng cấp Chính trị cấp 3 (Pháo đài - Fortress) để đào tạo Hiệp sĩ tinh nhuệ (Mighty)' };
    }

    // Kiểm tra kho
    if ((player.knightSupply[nextLevel] ?? 0) <= 0) {
      return { ok: false, reason: `Hết quân cờ ${nextLevel} trong kho` };
    }

    // Chi phí: 1 Cừu + 1 Quặng (nếu không miễn phí)
    if (!options.free) {
      const cost = CK_CONFIG.COSTS.promoteKnight;
      if ((player.resources.WOOL ?? 0) < cost.WOOL || (player.resources.ORE ?? 0) < cost.ORE) {
        return { ok: false, reason: 'Cần 1 Cừu và 1 Quặng để thăng cấp hiệp sĩ' };
      }
      player.resources.WOOL -= cost.WOOL;
      player.resources.ORE -= cost.ORE;
    }

    // Cập nhật kho: trả quân cờ cũ về kho, lấy quân cờ mới
    player.knightSupply[knight.level]++;
    player.knightSupply[nextLevel]--;

    const oldLevel = knight.level;
    knight.level = nextLevel;
    player.knightsPromotedThisTurn.add(knightId);

    gameState.log(`⚔️ [Thăng cấp] ${player.name} thăng cấp hiệp sĩ từ ${oldLevel.toUpperCase()} lên ${nextLevel.toUpperCase()}!`);
    return { ok: true, newLevel: nextLevel };
  }

  /**
   * Kích hoạt hiệp sĩ (Activate)
   * Chi phí: 1 Lúa (1 GRAIN)
   */
  static activateKnight(player, knightId, gameState, options = {}) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Chỉ được kích hoạt trong giai đoạn hành động (BUILD)' };
    }
    if (player.id !== gameState.currentPlayer.id) {
      return { ok: false, reason: 'Chỉ người chơi hiện tại mới được kích hoạt' };
    }

    const knight = player.knights.find(k => k.id === knightId);
    if (!knight) return { ok: false, reason: 'Không tìm thấy hiệp sĩ' };
    if (knight.active) return { ok: false, reason: 'Hiệp sĩ này đã ở trạng thái kích hoạt' };

    if (!options.free) {
      const cost = CK_CONFIG.COSTS.activateKnight;
      if ((player.resources.GRAIN ?? 0) < cost.GRAIN) {
        return { ok: false, reason: 'Cần 1 Lúa để kích hoạt hiệp sĩ' };
      }
      player.resources.GRAIN -= cost.GRAIN;
    }

    knight.active = true;
    player.knightsActivatedThisTurn.add(knightId);

    gameState.log(`🛡️ [Kích hoạt hiệp sĩ] ${player.name} đã kích hoạt (Active) một hiệp sĩ!`);
    return { ok: true };
  }

  /**
   * Di chuyển hiệp sĩ (Move action)
   * Chỉ hiệp sĩ đã Active từ đầu lượt (không phải vừa kích hoạt lượt này) mới được đi.
   */
  static moveKnight(player, knightId, targetVertexKey, gameState) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Chỉ được hành động trong giai đoạn BUILD' };
    }
    if (player.id !== gameState.currentPlayer.id) {
      return { ok: false, reason: 'Chỉ người chơi hiện tại mới được hành động' };
    }

    const knight = player.knights.find(k => k.id === knightId);
    if (!knight) return { ok: false, reason: 'Không tìm thấy hiệp sĩ' };
    if (!knight.active) return { ok: false, reason: 'Hiệp sĩ phải ở trạng thái Active để hành động' };

    // Không được kích hoạt rồi hành động ngay trong cùng lượt
    if (player.knightsActivatedThisTurn.has(knightId)) {
      return { ok: false, reason: 'Không được hành động với hiệp sĩ vừa kích hoạt trong lượt này' };
    }
    if (player.knightsActedThisTurn.has(knightId)) {
      return { ok: false, reason: 'Mỗi hiệp sĩ chỉ được hành động 1 lần trong lượt' };
    }

    // Kiểm tra vị trí đến có trống không
    const targetVertex = gameState.vertices.get(targetVertexKey);
    if (!targetVertex || !targetVertex.hasLand) return { ok: false, reason: 'Vị trí đích không hợp lệ' };
    if (targetVertex.building !== null) return { ok: false, reason: 'Vị trí đích đã có công trình' };
    if (this.getKnightAtVertex(targetVertexKey, gameState) !== null) {
      return { ok: false, reason: 'Vị trí đích đã có hiệp sĩ khác' };
    }

    // Kiểm tra đường đi dọc theo mạng lưới đường của người chơi
    const canReach = this.isPathReachableAlongOwnRoads(knight.vertexKey, targetVertexKey, player.id, gameState);
    if (!canReach) {
      return { ok: false, reason: 'Không có đường đi liên tục của bạn nối đến vị trí này (hoặc bị đối thủ chặn)' };
    }

    // Di chuyển và chuyển sang INACTIVE
    knight.vertexKey = targetVertexKey;
    knight.active = false;
    player.knightsActedThisTurn.add(knightId);

    gameState._updateLongestRoute();
    gameState.log(`🏃 [Di chuyển hiệp sĩ] ${player.name} di chuyển hiệp sĩ đến vị trí mới và trở thành Inactive.`);
    return { ok: true };
  }

  /**
   * Đẩy lùi hiệp sĩ đối phương yếu hơn (Displace action)
   */
  static displaceKnight(player, knightId, targetVertexKey, gameState) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Sai phase' };
    }
    if (player.id !== gameState.currentPlayer.id) {
      return { ok: false, reason: 'Không phải lượt của bạn' };
    }

    const knight = player.knights.find(k => k.id === knightId);
    if (!knight) return { ok: false, reason: 'Không tìm thấy hiệp sĩ của bạn' };
    if (!knight.active) return { ok: false, reason: 'Hiệp sĩ phải active để hành động' };
    if (player.knightsActivatedThisTurn.has(knightId)) {
      return { ok: false, reason: 'Không được hành động với hiệp sĩ vừa kích hoạt trong lượt' };
    }
    if (player.knightsActedThisTurn.has(knightId)) {
      return { ok: false, reason: 'Hiệp sĩ đã hành động lượt này' };
    }

    // Tìm hiệp sĩ đối phương tại đích
    const opponentData = this.getKnightAtVertex(targetVertexKey, gameState);
    if (!opponentData || opponentData.player.id === player.id) {
      return { ok: false, reason: 'Tại đích không có hiệp sĩ của đối phương' };
    }

    const myStrength = CK_CONFIG.KNIGHT_STRENGTH[knight.level];
    const opponentStrength = CK_CONFIG.KNIGHT_STRENGTH[opponentData.knight.level];
    if (myStrength <= opponentStrength) {
      return { ok: false, reason: 'Hiệp sĩ của bạn phải mạnh hơn hiệp sĩ đối phương để đẩy lùi' };
    }

    // Kiểm tra đường đi đến vị trí đối phương
    const canReach = this.isPathReachableAlongOwnRoads(knight.vertexKey, targetVertexKey, player.id, gameState, true);
    if (!canReach) {
      return { ok: false, reason: 'Không thể vươn tới hiệp sĩ đối phương dọc theo tuyến đường của bạn' };
    }

    // Đẩy lùi đối phương: Tìm vị trí hợp lệ cho đối phương chạy trốn
    const oppPlayer = opponentData.player;
    const oppKnight = opponentData.knight;

    const escapeSpots = this.getValidEscapeVertices(oppKnight, oppPlayer.id, gameState, targetVertexKey);
    let escaped = false;
    if (escapeSpots.length > 0) {
      // Đối phương di chuyển sang 1 ô hợp lệ (chọn ô đầu tiên khả dụng theo logic tự động)
      oppKnight.vertexKey = escapeSpots[0];
      escaped = true;
      gameState.log(`💨 [Hiệp sĩ rút lui] Hiệp sĩ của ${oppPlayer.name} bị đẩy lùi và chạy đến vị trí mới.`);
    } else {
      // Không còn đường lui -> Bị tiêu diệt, trả về kho
      oppPlayer.knights = oppPlayer.knights.filter(k => k.id !== oppKnight.id);
      oppPlayer.knightSupply[oppKnight.level]++;
      gameState.log(`💀 [Hiệp sĩ bị loại] Hiệp sĩ của ${oppPlayer.name} không còn đường lui nên phải trở về kho!`);
    }

    // Hiệp sĩ của mình chiếm vị trí đó và trở thành Inactive
    knight.vertexKey = targetVertexKey;
    knight.active = false;
    player.knightsActedThisTurn.add(knightId);

    gameState._updateLongestRoute();
    return { ok: true, opponentEscaped: escaped };
  }

  /**
   * Đuổi tên cướp (Chase Robber action)
   */
  static chaseRobber(player, knightId, gameState) {
    if (gameState.phase !== 'BUILD') {
      return { ok: false, reason: 'Sai phase' };
    }
    if (!gameState.robberOnBoard || !gameState.robberPos) {
      return { ok: false, reason: 'Tên cướp chưa xuất hiện trên đảo Catan' };
    }

    const knight = player.knights.find(k => k.id === knightId);
    if (!knight || !knight.active) {
      return { ok: false, reason: 'Hiệp sĩ phải ở trạng thái Active' };
    }
    if (player.knightsActivatedThisTurn.has(knightId)) {
      return { ok: false, reason: 'Không được hành động với hiệp sĩ vừa kích hoạt' };
    }
    if (player.knightsActedThisTurn.has(knightId)) {
      return { ok: false, reason: 'Hiệp sĩ đã hành động trong lượt này' };
    }

    // Kiểm tra hiệp sĩ có đứng kề ô Tên cướp không
    const v = gameState.vertices.get(knight.vertexKey);
    const isAdjacentToRobber = v?.hexes.some(h => h.q === gameState.robberPos.q && h.r === gameState.robberPos.r);
    if (!isAdjacentToRobber) {
      return { ok: false, reason: 'Hiệp sĩ phải đứng kề ô có Tên cướp đóng quân để xua đuổi' };
    }

    // Đuổi tên cướp: hiệp sĩ thành Inactive, chuyển phase sang ROBBER để di chuyển tên cướp
    knight.active = false;
    player.knightsActedThisTurn.add(knightId);
    gameState._returnPhaseAfterRobber = 'BUILD';
    gameState.phase = 'ROBBER';

    gameState.log(`⚔️ [Đuổi tên cướp] ${player.name} ra lệnh cho Hiệp sĩ xua đuổi Tên cướp!`);
    return { ok: true };
  }

  // ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────

  /**
   * Lấy hiệp sĩ đang đứng tại vertexKey (nếu có)
   */
  static getKnightAtVertex(vertexKey, gameState) {
    for (const player of gameState.players) {
      const knight = player.knights?.find(k => k.vertexKey === vertexKey);
      if (knight) return { player, knight };
    }
    return null;
  }

  /**
   * Kiểm tra khả năng di chuyển dọc theo tuyến đường của mình
   */
  static isPathReachableAlongOwnRoads(startVKey, endVKey, playerId, gameState, allowOpponentKnightAtEnd = false) {
    if (startVKey === endVKey) return true;

    const visited = new Set([startVKey]);
    const queue = [startVKey];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === endVKey) return true;

      const vertex = gameState.vertices.get(current);
      if (!vertex) continue;

      for (const eKey of vertex.adjacentEdges) {
        const edge = gameState.edges.get(eKey);
        // Phải là đường/tàu của mình
        if (!edge || edge.piece?.playerId !== playerId) continue;

        const nextVKey = edge.vertices.find(vk => vk !== current);
        if (visited.has(nextVKey)) continue;

        const nextV = gameState.vertices.get(nextVKey);
        if (!nextV) continue;

        // Bị chặn tại giao điểm trung gian nếu có công trình đối phương hoặc hiệp sĩ đối phương
        const isTarget = (nextVKey === endVKey);
        if (!isTarget) {
          if (nextV.building && nextV.building.playerId !== playerId) continue;
          const kData = this.getKnightAtVertex(nextVKey, gameState);
          if (kData && kData.player.id !== playerId) continue;
        } else {
          // Tại điểm đích
          if (nextV.building && nextV.building.playerId !== playerId) continue;
          if (!allowOpponentKnightAtEnd) {
            const kData = this.getKnightAtVertex(nextVKey, gameState);
            if (kData) continue;
          }
        }

        visited.add(nextVKey);
        queue.push(nextVKey);
      }
    }

    return false;
  }

  /**
   * Tìm các vị trí chạy trốn khả dụng cho hiệp sĩ bị đẩy lùi
   */
  static getValidEscapeVertices(knight, playerId, gameState, excludeVKey) {
    const valid = [];
    for (const [vKey, v] of gameState.vertices) {
      if (vKey === excludeVKey || vKey === knight.vertexKey) continue;
      if (!v.hasLand) continue;
      if (v.building !== null) continue;
      if (this.getKnightAtVertex(vKey, gameState) !== null) continue;

      if (this.isPathReachableAlongOwnRoads(knight.vertexKey, vKey, playerId, gameState, false)) {
        valid.push(vKey);
      }
    }
    return valid;
  }
}
