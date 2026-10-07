/**
 * InvariantChecker.js — Kiểm tra toàn vẹn trạng thái ván đấu (Invariants)
 * Bất kỳ vi phạm nào đều được coi là lỗi nghiêm trọng (P0 Bug).
 */

export class InvariantChecker {
  /**
   * Kiểm tra toàn bộ invariants trên trạng thái gameState
   * @param {Object} gameState
   * @throws {Error} Nếu có bất kỳ invariant nào bị vi phạm
   */
  static check(gameState) {
    if (!gameState) return;

    // 1. Invariant: Không có số lượng tài nguyên hoặc hàng hóa âm
    for (const player of gameState.players) {
      for (const [r, n] of Object.entries(player.resources || {})) {
        if (n < 0) throw new Error(`[INVARIANT VIOLATION] Player ${player.name} có tài nguyên âm: ${r} = ${n}`);
      }
      for (const [c, n] of Object.entries(player.commodities || {})) {
        if (n < 0) throw new Error(`[INVARIANT VIOLATION] Player ${player.name} có hàng hóa âm: ${c} = ${n}`);
      }
    }

    // 2. Invariant: Giới hạn quân cờ tối đa
    for (const player of gameState.players) {
      const placedCities = player.placed?.cities?.length || 0;
      const placedSettlements = player.placed?.settlements?.length || 0;
      const placedRoads = player.placed?.roads?.length || 0;
      const walls = player.cityWalls?.length || 0;

      if (placedCities > 4) throw new Error(`[INVARIANT VIOLATION] Player ${player.name} có > 4 thành phố trên bàn (${placedCities})`);
      if (placedSettlements > 5) throw new Error(`[INVARIANT VIOLATION] Player ${player.name} có > 5 định cư trên bàn (${placedSettlements})`);
      if (placedRoads > 15) throw new Error(`[INVARIANT VIOLATION] Player ${player.name} có > 15 đường trên bàn (${placedRoads})`);
      if (walls > 3) throw new Error(`[INVARIANT VIOLATION] Player ${player.name} có > 3 tường thành (${walls})`);
    }

    // 3. Invariant: Metropolis - Không có thành phố nào mang > 1 Metropolis
    const metroVertices = new Set();
    let totalMetros = 0;
    for (const player of gameState.players) {
      for (const m of player.metropolises || []) {
        if (metroVertices.has(m.vertexKey)) {
          throw new Error(`[INVARIANT VIOLATION] Đỉnh ${m.vertexKey} có > 1 Đại đô thị gắn vào!`);
        }
        metroVertices.add(m.vertexKey);
        totalMetros++;
      }
    }
    if (totalMetros > 3) {
      throw new Error(`[INVARIANT VIOLATION] Tổng số Đại đô thị trên bàn vượt quá 3 (${totalMetros})`);
    }

    // 4. Invariant: Điểm chiến thắng (VP) tính lại độc lập phải khớp chính xác
    for (const player of gameState.players) {
      const expectedVP = (player.placed?.settlements?.length || 0) * 1 +
                         (player.placed?.cities?.length || 0) * 2 +
                         (player.metropolises?.length || 0) * 2 +
                         (player.hasLongestRoad ? 2 : 0) +
                         (player.defenderTokens || 0) +
                         (player.hasMerchant ? 1 : 0) +
                         (player.progressCards?.filter(c => c.isVP)?.length || 0);

      if (player.victoryPoints !== expectedVP) {
        throw new Error(`[INVARIANT VIOLATION] Điểm VP của Player ${player.name} (${player.victoryPoints}) không khớp với tính toán độc lập (${expectedVP})`);
      }
    }

    // 5. Invariant: Hành trình thuyền man rợ trong khoảng [0, barbarianSteps]
    if (gameState.ruleset === 'cities_knights') {
      if (gameState.barbarianPosition < 0 || gameState.barbarianPosition > gameState.barbarianSteps) {
        throw new Error(`[INVARIANT VIOLATION] Vị trí thuyền man rợ không hợp lệ: ${gameState.barbarianPosition}/${gameState.barbarianSteps}`);
      }
    }
  }
}
