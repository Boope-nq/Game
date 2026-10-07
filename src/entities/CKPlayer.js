import { Player } from './Player.js';

/**
 * CKPlayer.js — Entity người chơi cho bản mở rộng Cities & Knights
 */
export class CKPlayer extends Player {
  /**
   * @param {number} id - 0..3
   * @param {string} name 
   */
  constructor(id, name) {
    super(id, name);
    
    // Hàng hóa (Cities & Knights)
    this.commodities = { PAPER: 0, CLOTH: 0, COIN: 0 };
    
    // Nâng cấp thành phố (City improvements)
    this.cityImprovements = { trade: 0, politics: 0, science: 0 };
    this.improvements = this.cityImprovements; // alias tiện lợi
    
    // Hiệp sĩ (Knights)
    // Mỗi hiệp sĩ có dạng { id, vertexKey, level, active }
    this.knights = [];
    this.knightSupply = { basic: 2, strong: 2, mighty: 2 };
    
    // Tường thành
    this.cityWalls = []; // mảng các vertexKey
    this.wallStock = 3;
    
    // Thủ phủ (Metropolis)
    // Mỗi thủ phủ có dạng { track, vertexKey }
    this.metropolises = [];
    
    // Thẻ phát triển (Progress cards)
    // Mỗi thẻ có dạng { id, deck, type, isVP, drawTurn }
    this.progressCards = [];
    
    // Huy hiệu vệ quốc (Defender of Catan)
    this.defenderTokens = 0;
    
    // Thương nhân (Merchant)
    this.hasMerchant = false;
    
    // Cờ trạng thái trong lượt (Per-turn flags)
    this.knightsPromotedThisTurn = new Set();
    this.knightsActivatedThisTurn = new Set();
    this.knightsActedThisTurn = new Set();
    this.craneUsedThisTurn = false;
    this.medicineUsedThisTurn = false;
    this.merchantFleetResource = null;
  }

  /**
   * Tính tổng số thẻ (tài nguyên + hàng hóa)
   * Không bao gồm thẻ phát triển (Progress cards).
   * Dùng để kiểm tra giới hạn bài khi đổ ra 7.
   * @returns {number}
   */
  totalCards() {
    const resTotal = Object.entries(this.resources)
      .filter(([k]) => k !== 'GOLD')  // Loại bỏ GOLD
      .reduce((a, [,b]) => a + b, 0);
    const comTotal = Object.values(this.commodities).reduce((a, b) => a + b, 0);
    return resTotal + comTotal;
  }

  /**
   * Lấy giới hạn bài trên tay an toàn (Hand limit)
   * Mặc định là 7, cộng thêm 2 cho mỗi tường thành.
   * @returns {number}
   */
  getHandLimit() {
    return 7 + (this.cityWalls.length * 2);
  }

  /**
   * Kiểm tra xem người chơi có đủ tài nguyên/hàng hóa không
   * @param {Object} cost 
   * @returns {boolean}
   */
  canAffordCommodity(cost) {
    for (const [type, amount] of Object.entries(cost)) {
      if (['PAPER', 'CLOTH', 'COIN'].includes(type)) {
        if ((this.commodities[type] ?? 0) < amount) return false;
      } else {
        if ((this.resources[type] ?? 0) < amount) return false;
      }
    }
    return true;
  }

  /**
   * Trả chi phí bao gồm cả tài nguyên và hàng hóa
   * @param {Object} cost 
   */
  payCommodity(cost) {
    if (!this.canAffordCommodity(cost)) throw new Error('Không đủ tài nguyên/hàng hóa');
    for (const [type, amount] of Object.entries(cost)) {
      if (['PAPER', 'CLOTH', 'COIN'].includes(type)) {
        this.commodities[type] -= amount;
      } else {
        this.resources[type] -= amount;
      }
    }
  }

  /**
   * Nhận hàng hóa
   * @param {Object} commodities 
   */
  receiveCommodity(commodities) {
    for (const [type, amount] of Object.entries(commodities)) {
      if (this.commodities[type] !== undefined) this.commodities[type] += amount;
    }
  }

  /**
   * Chọn ngẫu nhiên 1 tài nguyên/hàng hóa (để cướp)
   * @returns {Object|null}
   */
  stealRandom() {
    const available = [];
    for (const [r, n] of Object.entries(this.resources)) {
      if (r === 'GOLD') continue;
      for (let i = 0; i < n; i++) available.push({ type: 'resource', key: r });
    }
    for (const [c, n] of Object.entries(this.commodities)) {
      for (let i = 0; i < n; i++) available.push({ type: 'commodity', key: c });
    }
    if (available.length === 0) return null;
    const picked = available[Math.floor(Math.random() * available.length)];
    if (picked.type === 'resource') this.resources[picked.key]--;
    else this.commodities[picked.key]--;
    return picked;
  }

  /**
   * Tính lại điểm công khai cho Cities & Knights
   * @returns {number}
   */
  recalcPublicVP() {
    let vp = 0;
    vp += this.placed.settlements.length * 1;
    vp += this.placed.cities.length * 2;
    vp += this.metropolises.length * 2;  // +2 per metropolis
    if (this.hasLongestRoad) vp += 2;
    vp += this.defenderTokens;
    if (this.hasMerchant) vp += 1;
    
    // Thẻ điểm phát triển (VP progress cards)
    const vpCards = this.progressCards.filter(c => c.isVP).length;
    vp += vpCards;
    
    this.victoryPoints = vp;
    return vp;
  }

  /**
   * Reset các cờ trạng thái lượt ở cuối mỗi lượt
   */
  resetTurnFlags() {
    this.knightsPromotedThisTurn = new Set();
    this.knightsActivatedThisTurn = new Set();
    this.knightsActedThisTurn = new Set();
    this.craneUsedThisTurn = false;
    this.medicineUsedThisTurn = false;
    this.merchantFleetResource = null;
  }

  /**
   * Tính tổng sức mạnh của tất cả hiệp sĩ ĐANG HOẠT ĐỘNG (active)
   * @returns {number}
   */
  totalActiveKnightStrength() {
    const STRENGTH = { basic: 1, strong: 2, mighty: 3 };
    return this.knights
      .filter(k => k.active)
      .reduce((sum, k) => sum + (STRENGTH[k.level] || 0), 0);
  }

  /**
   * Cấu trúc JSON công khai, ẩn chi tiết thẻ Progress
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    
    // Ghi đè victoryPoints bằng kết quả mới nhất cho chắc chắn
    json.victoryPoints = this.recalcPublicVP();
    
    return {
      ...json,
      commodities: { ...this.commodities },
      cityImprovements: { ...this.cityImprovements },
      knights: this.knights.map(k => ({ ...k })),
      knightSupply: { ...this.knightSupply },
      cityWalls: [...this.cityWalls],
      wallStock: this.wallStock,
      metropolises: [...this.metropolises],
      progressCardsCount: this.progressCards.length,
      defenderTokens: this.defenderTokens,
      hasMerchant: this.hasMerchant,
    };
  }
}
