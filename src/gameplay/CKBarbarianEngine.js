/**
 * CKBarbarianEngine.js — Xử lý các đợt tấn công của Quân man rợ (Barbarian Attacks)
 *
 * Luật chi tiết C&K 5th Edition:
 * 1. Sức mạnh quân man rợ = Tổng số Thành phố (City) trên toàn bàn chơi của tất cả người chơi
 *    (Bao gồm cả thành phố thường và thành phố có gắn Đại đô thị).
 * 2. Sức mạnh phòng thủ Catan = Tổng sức mạnh của TẤT CẢ HIỆP SĨ ĐANG KÍCH HOẠT (Active knights) trên bàn.
 * 3. So sánh kết quả:
 *    A) PHÒNG THỦ CHIẾN THẮNG (Sức phòng thủ >= Sức man rợ):
 *       - Người chơi đóng góp tổng sức mạnh hiệp sĩ active LỚN NHẤT nhận 1 Huy hiệu Người bảo vệ Catan (Defender of Catan token = 1 VP).
 *       - Nếu nhiều người chơi HÒA NHAU ở vị trí cao nhất: Không ai nhận huy hiệu, thay vào đó mỗi người hòa được rút 1 thẻ tiến bộ tự chọn (Science, Trade hoặc Politics), bắt đầu từ người chơi hiện tại theo chiều kim đồng hồ.
 *    B) QUÂN MAN RỢ CHIẾN THẮNG (Sức man rợ > Sức phòng thủ):
 *       - Người chơi đóng góp tổng sức mạnh hiệp sĩ active THẤP NHẤT (0 sức mạnh cũng tính) mỗi người bị CƯỚP PHÁ 1 THÀNH PHỐ.
 *       - Thành phố bị cướp phá: Giáng cấp từ Thành phố về Định cư (Settlement), dỡ bỏ Tường thành (nếu có) trả về kho.
 *       - Thành phố có Đại đô thị (Metropolis) ĐƯỢC MIỄN NHIỄM CƯỚP PHÁ (không thể bị cướp).
 *       - Nếu người đóng góp thấp nhất không có thành phố nào có thể cướp (chỉ có settlement hoặc chỉ có metropolis), xét tiếp đến người đóng góp thấp kế tiếp, cho đến khi có thành phố bị cướp phá.
 *       - Quy tắc thành phố đặt nằm (City-on-its-side): Nếu kho người chơi hết quân Định cư, đặt quân cờ Thành phố nằm nghiêng trên đỉnh đó và coi nó như Định cư. Nó phải được nâng cấp lên thành phố trước bất kỳ định cư nào khác.
 * 4. Sau MỖI đợt tấn công (Dù thắng hay thua):
 *    - Đưa thuyền man rợ về vạch xuất phát (vị trí 0).
 *    - Toàn bộ hiệp sĩ trên bàn chơi của TẤT CẢ người chơi trở về trạng thái CHƯA KÍCH HOẠT (Inactive).
 * 5. Đợt tấn công ĐẦU TIÊN:
 *    - Tên cướp (Robber) chính thức xuất hiện trên đảo Catan tại ô Sa mạc (Desert). Kể từ đó trở đi, Tên cướp bắt đầu hoạt động.
 */

import { CK_CONFIG } from './CKRulesConfig.js';
import { TileType } from '../core/HexTile.js';

export class CKBarbarianEngine {
  /**
   * Tính toán và thực hiện đợt tấn công của quân man rợ
   * @param {Object} gameState - CKGameState
   * @returns {Object} Kết quả chi tiết đợt tấn công
   */
  static resolveAttack(gameState) {
    gameState.barbarianAttackCount++;
    gameState.log(`⚔️⚔️⚔️ [QUÂN MAN RỢ ĐỔ BỘ] Đợt tấn công thứ ${gameState.barbarianAttackCount} bắt đầu!`);

    // 1. Tính sức mạnh quân man rợ = Tổng số Thành phố của mọi người chơi
    let barbarianStrength = 0;
    for (const player of gameState.players) {
      barbarianStrength += (player.placed.cities?.length || 0);
    }

    // 2. Tính sức mạnh phòng thủ của từng người chơi và tổng phòng thủ
    const playerDefense = {};
    let totalDefense = 0;

    for (const player of gameState.players) {
      const pStrength = player.totalActiveKnightStrength ? player.totalActiveKnightStrength() : 0;
      playerDefense[player.id] = pStrength;
      totalDefense += pStrength;
    }

    gameState.log(`[So sánh lực lượng] Sức mạnh Man rợ: ${barbarianStrength} ⚔️ vs Sức phòng thủ Catan: ${totalDefense} 🛡️`);

    const result = {
      attackNumber: gameState.barbarianAttackCount,
      barbarianStrength,
      totalDefense,
      playerDefense,
      defendersWon: false,
      rewardWinners: [],
      rewardProgressCards: false,
      pillagedPlayers: [],
      pillagedCities: [],
    };

    // 3. Phân định Thắng / Thua
    if (totalDefense >= barbarianStrength) {
      // ═══ NGƯỜI BẢO VỆ CHIẾN THẮNG ═══
      result.defendersWon = true;
      gameState.log(`🎉 [Phòng thủ thắng lợi] Catan đã đẩy lùi quân man rợ!`);

      // Tìm sức mạnh đóng góp cao nhất
      let maxContribution = -1;
      for (const pid in playerDefense) {
        if (playerDefense[pid] > maxContribution) {
          maxContribution = playerDefense[pid];
        }
      }

      // Tìm những người cùng đạt mức cao nhất
      const topContributors = gameState.players.filter(p => playerDefense[p.id] === maxContribution && maxContribution > 0);

      if (topContributors.length === 1) {
        // Chỉ có 1 người cao nhất -> Nhận 1 Defender Token (+1 VP)
        const winner = topContributors[0];
        winner.defenderTokens = (winner.defenderTokens || 0) + 1;
        winner.recalcPublicVP();
        result.rewardWinners.push(winner.id);
        gameState.log(`🏆 [Người bảo vệ Catan] ${winner.name} đóng góp lớn nhất (${maxContribution} sức mạnh) và nhận Huy hiệu Người bảo vệ (+1 VP)!`);
      } else if (topContributors.length > 1) {
        // Hòa nhau ở vị trí cao nhất -> Mỗi người rút 1 thẻ tiến bộ tự chọn
        result.rewardProgressCards = true;
        result.rewardWinners = topContributors.map(p => p.id);
        gameState.log(`🤝 [Hòa đóng góp] Có ${topContributors.length} người chơi hòa nhau ở mức ${maxContribution} sức mạnh! Mỗi người được rút 1 thẻ tiến bộ.`);

        // Bắt đầu từ người chơi hiện tại, tặng mỗi người 1 thẻ tiến bộ (mặc định lấy từ deck còn nhiều nhất hoặc Science)
        for (let i = 0; i < gameState.numPlayers; i++) {
          const pIdx = (gameState.currentPlayerIndex + i) % gameState.numPlayers;
          const p = gameState.players[pIdx];
          if (topContributors.some(tc => tc.id === p.id)) {
            // Tự động rút 1 thẻ từ cọc Science (hoặc Trade/Politics nếu hết)
            const deckToDraw = gameState.progressDecks.science.length > 0 ? 'science' :
                               (gameState.progressDecks.trade.length > 0 ? 'trade' : 'politics');
            if (gameState._drawProgressCard) {
              gameState._drawProgressCard(p, deckToDraw);
            }
          }
        }
      }
    } else {
      // ═══ QUÂN MAN RỢ CHIẾN THẮNG ═══
      result.defendersWon = false;
      gameState.log(`💀 [Thất thủ] Quân man rợ áp đảo hoàn toàn hàng phòng thủ!`);

      // Tìm người chơi đóng góp thấp nhất có thể bị cướp phá
      const sortedByDefense = [...gameState.players].sort((a, b) => playerDefense[a.id] - playerDefense[b.id]);
      
      let cityPillaged = false;
      let minDefenseScore = playerDefense[sortedByDefense[0].id];

      // Những người có cùng mức thấp nhất
      const lowestPlayers = sortedByDefense.filter(p => playerDefense[p.id] === minDefenseScore);

      for (const victim of lowestPlayers) {
        const pillageRes = this.pillageCityOfPlayer(victim, gameState);
        if (pillageRes.pillaged) {
          cityPillaged = true;
          result.pillagedPlayers.push(victim.id);
          result.pillagedCities.push(pillageRes.vertexKey);
        }
      }

      // Nếu không ai trong nhóm thấp nhất có thành phố cướp được, duyệt tiếp lên cao hơn
      if (!cityPillaged) {
        for (const candidate of sortedByDefense) {
          if (lowestPlayers.includes(candidate)) continue;
          const pillageRes = this.pillageCityOfPlayer(candidate, gameState);
          if (pillageRes.pillaged) {
            result.pillagedPlayers.push(candidate.id);
            result.pillagedCities.push(pillageRes.vertexKey);
            break;
          }
        }
      }
    }

    // 4. Reset sau mỗi đợt tấn công
    // Thuyền trở về vạch xuất phát
    gameState.barbarianPosition = 0;

    // Tất cả hiệp sĩ trở về trạng thái Inactive
    for (const player of gameState.players) {
      for (const knight of player.knights || []) {
        knight.active = false;
      }
    }
    gameState.log(`💤 [Kiệt sức] Toàn bộ hiệp sĩ trên bàn chơi chuyển sang trạng thái Chưa kích hoạt (Inactive).`);

    // Đợt đầu tiên: Đặt Tên cướp vào sa mạc nếu chưa có
    if (!gameState.robberOnBoard) {
      gameState.robberOnBoard = true;
      // Tìm toạ độ ô Sa mạc
      let desertCoord = null;
      for (const tile of gameState.tiles.values()) {
        if (tile.type === TileType.DESERT) {
          desertCoord = { q: tile.q, r: tile.r };
          break;
        }
      }
      gameState.robberPos = desertCoord || { q: 0, r: 0 };
      const tile = gameState.getTile(gameState.robberPos.q, gameState.robberPos.r);
      if (tile) tile.hasRobber = true;
      gameState.log(`🦹 [Tên cướp thức tỉnh] Tên cướp chính thức xuất hiện tại Sa mạc (${gameState.robberPos.q}, ${gameState.robberPos.r}) và bắt đầu hoành hành!`);
    }

    // Cập nhật lại điểm số
    for (const player of gameState.players) {
      player.recalcPublicVP();
    }
    gameState._checkWin();

    return result;
  }

  /**
   * Cướp phá 1 thành phố của người chơi
   * @param {Object} player
   * @param {Object} gameState
   * @returns {{ pillaged: boolean, vertexKey?: string }}
   */
  static pillageCityOfPlayer(player, gameState) {
    if (!player.placed.cities || player.placed.cities.length === 0) {
      return { pillaged: false };
    }

    // Tìm thành phố không có Đại đô thị (Metropolis)
    const pillageableCities = player.placed.cities.filter(vKey => {
      return !gameState.isCityImmuneToPillage || !gameState.isCityImmuneToPillage(vKey);
    });

    if (pillageableCities.length === 0) {
      return { pillaged: false }; // Tất cả thành phố đều có Đại đô thị bảo vệ
    }

    // Chọn thành phố đầu tiên để cướp phá
    const targetVKey = pillageableCities[0];
    const vertex = gameState.vertices.get(targetVKey);

    // 1. Giáng cấp từ City -> Settlement
    player.placed.cities = player.placed.cities.filter(k => k !== targetVKey);
    player.stock.cities++;

    if (player.stock.settlements > 0) {
      player.stock.settlements--;
      player.placed.settlements.push(targetVKey);
      if (vertex) vertex.building = { playerId: player.id, type: 'settlement' };
      gameState.log(`🔥 [Cướp phá] Thành phố của ${player.name} bị giáng cấp thành Định cư (Settlement)!`);
    } else {
      // Luật City-on-its-side: Hết quân settlement, đặt quân City nằm nghiêng
      player.placed.settlements.push(targetVKey);
      if (vertex) vertex.building = { playerId: player.id, type: 'settlement', onItsSide: true };
      gameState.log(`🔥 [Thành phố nằm nghiêng] Hết quân định cư! Thành phố của ${player.name} bị lật nghiêng để đóng vai trò Định cư.`);
    }

    // 2. Dỡ bỏ Tường thành (nếu có)
    if (player.cityWalls.includes(targetVKey)) {
      player.cityWalls = player.cityWalls.filter(k => k !== targetVKey);
      player.wallStock++;
      gameState.log(`🧱 [Sập tường thành] Tường thành tại thành phố bị cướp phá đã sụp đổ và được trả về kho.`);
    }

    return { pillaged: true, vertexKey: targetVKey };
  }
}
