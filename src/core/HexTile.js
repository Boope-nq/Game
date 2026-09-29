/**
 * HexTile.js — Định nghĩa các loại ô hex và thuộc tính của chúng
 *
 * Loại ô:
 *  BRICK    — Gạch (Đồi đỏ)
 *  LUMBER   — Gỗ (Rừng xanh)
 *  GRAIN    — Lúa (Đồng vàng)
 *  WOOL     — Cừu (Đồng cỏ)
 *  ORE      — Quặng (Núi xám)
 *  GOLD     — Vàng (Gold Field — chọn tài nguyên tuỳ ý) *Seafarers mới*
 *  SEA      — Biển (không sản xuất, dùng đặt tàu)
 *  DESERT   — Sa mạc (không sản xuất, nơi Robber bắt đầu)
 */

export const TileType = Object.freeze({
  BRICK:  'BRICK',
  LUMBER: 'LUMBER',
  GRAIN:  'GRAIN',
  WOOL:   'WOOL',
  ORE:    'ORE',
  GOLD:   'GOLD',
  SEA:    'SEA',
  DESERT: 'DESERT',
});

// Resource tương ứng với mỗi loại ô (GOLD = chọn bất kỳ runtime)
export const TileResource = {
  [TileType.BRICK]:  'BRICK',
  [TileType.LUMBER]: 'LUMBER',
  [TileType.GRAIN]:  'GRAIN',
  [TileType.WOOL]:   'WOOL',
  [TileType.ORE]:    'ORE',
  [TileType.GOLD]:   'GOLD',   // special: player picks
  [TileType.SEA]:    null,
  [TileType.DESERT]: null,
};

// Màu fill cho mỗi loại ô (dùng khi vẽ canvas fallback)
export const TileColor = {
  [TileType.BRICK]:  0xC0503A,
  [TileType.LUMBER]: 0x3A7A3A,
  [TileType.GRAIN]:  0xE8C444,
  [TileType.WOOL]:   0x88C857,
  [TileType.ORE]:    0x7A7A8E,
  [TileType.GOLD]:   0xFFD700,
  [TileType.SEA]:    0x2A6FA8,
  [TileType.DESERT]: 0xD9C690,
};

// Biểu tượng đơn sắc cho mỗi loại ô
export const TileEmoji = {
  [TileType.BRICK]:  'Gạch',
  [TileType.LUMBER]: 'Gỗ',
  [TileType.GRAIN]:  'Lúa',
  [TileType.WOOL]:   'Cừu',
  [TileType.ORE]:    'Quặng',
  [TileType.GOLD]:   'Vàng',
  [TileType.SEA]:    'Biển',
  [TileType.DESERT]: 'Sa mạc',
};

// Tên hiển thị tiếng Việt
export const TileName = {
  [TileType.BRICK]:  'Gạch',
  [TileType.LUMBER]: 'Gỗ',
  [TileType.GRAIN]:  'Lúa',
  [TileType.WOOL]:   'Cừu',
  [TileType.ORE]:    'Quặng',
  [TileType.GOLD]:   'Vàng',
  [TileType.SEA]:    'Biển',
  [TileType.DESERT]: 'Sa mạc',
};

/**
 * Lớp HexTile — đại diện cho một ô trên bản đồ
 */
export class HexTile {
  /**
   * @param {number} q - toạ độ axial q
   * @param {number} r - toạ độ axial r
   * @param {string} type - TileType.*
   * @param {number|null} number - số sản xuất (2-12), null nếu biển/sa mạc
   */
  constructor(q, r, type, number = null) {
    this.q = q;
    this.r = r;
    this.type = type;
    this.number = number;       // số sản xuất trên token
    this.hasRobber = false;     // true nếu Robber đang ở ô này
    this.hasPirate = false;     // true nếu Pirate đang ở ô này (chỉ biển)
    this.isDiscovered = false;  // Seafarers: ô chưa được khám phá
  }

  /** Ô này có sản xuất tài nguyên không? */
  get producesResource() {
    return this.type !== TileType.SEA &&
           this.type !== TileType.DESERT &&
           this.number !== null;
  }

  /** Tài nguyên sản xuất ra */
  get resource() {
    return TileResource[this.type] ?? null;
  }

  /** Màu vẽ */
  get color() {
    return TileColor[this.type];
  }

  /** Xác suất tung được số này (dot count) */
  get probability() {
    if (!this.number) return 0;
    return 6 - Math.abs(7 - this.number); // 6,5,4,3,2,1,2,3,4,5,6
  }

  toJSON() {
    return { q: this.q, r: this.r, type: this.type, number: this.number };
  }
}
