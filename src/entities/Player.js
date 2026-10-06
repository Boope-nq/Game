/**
 * Player.js — Entity người chơi
 */

export const PlayerColor = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']; // Đỏ, Xanh, Lá, Cam
export const PlayerColorHex = [0xE74C3C, 0x3498DB, 0x2ECC71, 0xF39C12];
export const PlayerName = ['Người chơi 1', 'Người chơi 2', 'Người chơi 3', 'Người chơi 4'];

export const ResourceType = Object.freeze({
  BRICK:  'BRICK',
  LUMBER: 'LUMBER',
  GRAIN:  'GRAIN',
  WOOL:   'WOOL',
  ORE:    'ORE',
  GOLD:   'GOLD',
});

export const ALL_RESOURCES = Object.values(ResourceType);
export const ALL_BASIC_RESOURCES = ['BRICK', 'LUMBER', 'GRAIN', 'WOOL', 'ORE'];

export class Player {
  /**
   * @param {number} id - 0..3
   * @param {string} name
   */
  constructor(id, name) {
    this.id   = id;
    this.name = name;
    this.color      = PlayerColor[id];
    this.colorHex   = PlayerColorHex[id];

    // Tài nguyên trong tay (bao gồm 5 loại cơ bản + Thẻ Vàng)
    this.resources = {
      [ResourceType.BRICK]:  0,
      [ResourceType.LUMBER]: 0,
      [ResourceType.GRAIN]:  0,
      [ResourceType.WOOL]:   0,
      [ResourceType.ORE]:    0,
      [ResourceType.GOLD]:   0,
    };

    // Công trình còn trong kho (chưa đặt lên bàn)
    this.stock = {
      settlements: 5,
      cities:      4,
      roads:       15,
      ships:       15,
    };

    // Công trình đã đặt lên bàn
    this.placed = {
      settlements: [], // [{q,r,vertex}]
      cities:      [], // [{q,r,vertex}]
      roads:       [], // [{q1,r1,q2,r2}]
      ships:       [], // [{q1,r1,q2,r2}]
    };

    // Thẻ phát triển
    this.devCards = [];          // tất cả thẻ đã mua
    this.playedDevCards = [];    // thẻ đã dùng lượt này

    // Điểm
    this.victoryPoints   = 0;   // điểm công khai (định cư, thành phố)
    this.hiddenVP        = 0;   // điểm ẩn (Victory Point cards)

    // Đặc biệt
    this.hasLongestRoad  = false;
    this.hasLargestArmy  = false;
    this.knightsPlayed   = 0;
    this.discoveredIslands = new Set(); // Seafarers: đảo đã khám phá

    // Trạng thái
    this.hasRolled       = false;
    this.hasBuiltThisTurn = false;
  }

  // ─── Quản lý tài nguyên ───────────────────────────────────────────────────

  totalResources() {
    return Object.values(this.resources).reduce((a, b) => a + b, 0);
  }

  canAfford(cost) {
    return Object.entries(cost).every(([r, n]) => (this.resources[r] ?? 0) >= n);
  }

  pay(cost) {
    if (!this.canAfford(cost)) throw new Error('Không đủ tài nguyên');
    for (const [r, n] of Object.entries(cost)) this.resources[r] -= n;
  }

  receive(resources) {
    for (const [r, n] of Object.entries(resources)) {
      if (this.resources[r] !== undefined) this.resources[r] += n;
    }
  }

  // Lấy ngẫu nhiên 1 tài nguyên (khi bị cướp)
  stealRandom() {
    const available = [];
    for (const [r, n] of Object.entries(this.resources)) {
      for (let i = 0; i < n; i++) available.push(r);
    }
    if (available.length === 0) return null;
    const picked = available[Math.floor(Math.random() * available.length)];
    this.resources[picked]--;
    return picked;
  }

  // ─── Tính điểm ───────────────────────────────────────────────────────────

  recalcPublicVP() {
    let vp = 0;
    vp += this.placed.settlements.length * 1;
    vp += this.placed.cities.length      * 2;
    if (this.hasLongestRoad)  vp += 2;
    if (this.hasLargestArmy)  vp += 2;
    vp += this.discoveredIslands.size;  // +1 mỗi đảo khám phá (Seafarers)

    // Tự động cộng thẻ điểm chiến thắng (VP cards) vào điểm số của người chơi
    const vpCards = (this.devCards || []).filter(c => c.type === 'VP').length;
    this.hiddenVP = Math.max(this.hiddenVP || 0, vpCards);
    vp += this.hiddenVP;

    this.victoryPoints = vp;
    return vp;
  }

  totalVP() {
    return this.recalcPublicVP();
  }

  toJSON() {
    return {
      id: this.id, name: this.name,
      resources: { ...this.resources },
      stock: { ...this.stock },
      victoryPoints: this.totalVP(),
    };
  }
}
