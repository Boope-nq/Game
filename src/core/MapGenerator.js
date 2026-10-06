/**
 * MapGenerator.js — Tạo bản đồ Catan: Seafarers ngẫu nhiên
 *
 * Kịch bản mặc định: "Voyages of Discovery"
 *  - Đảo chính (main island): ~19 ô đất theo layout Catan chuẩn
 *  - Biển xung quanh + đảo nhỏ để khám phá
 *  - Số lượng ô theo nguyên tác Seafarers
 */

import { HexTile, TileType } from './HexTile.js';
import { hexKey } from './HexGrid.js';

// ─── Số lượng ô theo nguyên tác Catan cơ bản (đảo chính) ───────────────────
const MAIN_ISLAND_DISTRIBUTION = [
  { type: TileType.BRICK,  count: 3 },
  { type: TileType.LUMBER, count: 4 },
  { type: TileType.GRAIN,  count: 4 },
  { type: TileType.WOOL,   count: 4 },
  { type: TileType.ORE,    count: 3 },
  { type: TileType.DESERT, count: 1 },
];

// Token số sản xuất (nguyên tác: 2 bộ 3-11 + một số 2 và 12)
const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// Đảo nhỏ (Seafarers): thêm ô vàng và ô tài nguyên xa
const SMALL_ISLAND_TILES = [
  { type: TileType.GOLD,   count: 2 },
  { type: TileType.BRICK,  count: 1 },
  { type: TileType.LUMBER, count: 1 },
  { type: TileType.GRAIN,  count: 1 },
  { type: TileType.WOOL,   count: 1 },
  { type: TileType.ORE,    count: 1 },
];

// ─── Layout toạ độ axial của đảo chính (Catan chuẩn) ────────────────────────
const MAIN_ISLAND_COORDS = [
  // Hàng trên
  { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
  // Hàng giữa-trên
  { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
  // Hàng giữa
  { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
  // Hàng giữa-dưới
  { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
  // Hàng dưới
  { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 },
];

// Toạ độ các đảo nhỏ (xa hơn để khám phá) — Seafarers
const SMALL_ISLAND_COORDS = [
  // Đảo nhỏ bên phải
  { q: 4, r: -2 }, { q: 5, r: -2 },
  // Đảo nhỏ bên trái
  { q: -4, r: 1 }, { q: -5, r: 2 },
  // Đảo nhỏ phía dưới
  { q: -1, r: 4 }, { q: 0, r: 4 }, { q: 1, r: 4 },
];

// Định nghĩa cảng (Harbors) theo nguyên tác
export const HARBOR_TYPES = Object.freeze({
  GENERIC: 'GENERIC', // 3:1
  BRICK:   'BRICK',   // 2:1
  LUMBER:  'LUMBER',  // 2:1
  GRAIN:   'GRAIN',   // 2:1
  WOOL:    'WOOL',    // 2:1
  ORE:     'ORE',     // 2:1
});

// Cảng mặc định với vị trí (q, r) của ô biển + hướng nhìn vào đảo
const DEFAULT_HARBORS = [
  { type: HARBOR_TYPES.GENERIC, q: 1,  r: -3, facing: 4 },
  { type: HARBOR_TYPES.GENERIC, q: 3,  r: -3, facing: 3 },
  { type: HARBOR_TYPES.BRICK,   q: 3,  r: -1, facing: 2 },
  { type: HARBOR_TYPES.GENERIC, q: 3,  r: 1,  facing: 1 },
  { type: HARBOR_TYPES.GRAIN,   q: 1,  r: 3,  facing: 0 },
  { type: HARBOR_TYPES.GENERIC, q: -1, r: 3,  facing: 5 },
  { type: HARBOR_TYPES.WOOL,    q: -3, r: 3,  facing: 4 },
  { type: HARBOR_TYPES.ORE,     q: -3, r: 0,  facing: 3 },
  { type: HARBOR_TYPES.LUMBER,  q: -1, r: -2, facing: 1 },
];

// ─── Shuffle ngẫu nhiên mảng ────────────────────────────────────────────────
function makePRNG(seed) {
  let s = (typeof seed === 'number' ? seed : 123456789) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str) {
  if (!str) return Math.floor(Math.random() * 1000000);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function seededShuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffle(arr) {
  return seededShuffle(arr, Math.random);
}

// ─── Tạo danh sách tài nguyên từ phân phối ───────────────────────────────────
function buildTilePool(distribution, rand = Math.random) {
  const pool = [];
  for (const { type, count } of distribution) {
    for (let i = 0; i < count; i++) pool.push(type);
  }
  return seededShuffle(pool, rand);
}

/**
 * Tạo bản đồ đầy đủ cho game Catan Seafarers
 * @param {string|number|null} seed - Seed để tạo bản đồ đồng bộ giữa các máy
 * @returns {{ tiles: Map<string, HexTile>, harbors: Array, seaTiles: Array }}
 */
export function generateMap(seed = null) {
  const rand = seed ? makePRNG(stringToSeed(seed)) : Math.random;
  const tiles = new Map(); // key: "q,r" → HexTile

  // 1. Tạo pool tài nguyên cho đảo chính
  const mainPool   = buildTilePool(MAIN_ISLAND_DISTRIBUTION, rand);
  const numberPool = seededShuffle([...NUMBER_TOKENS], rand);

  // 2. Đặt ô đảo chính
  let desertCoord = null;
  for (let i = 0; i < MAIN_ISLAND_COORDS.length; i++) {
    const { q, r } = MAIN_ISLAND_COORDS[i];
    const type = mainPool[i];
    let num = null;
    if (type !== TileType.DESERT) {
      num = numberPool.shift();
    } else {
      desertCoord = { q, r };
    }
    const tile = new HexTile(q, r, type, num);
    tile.isDiscovered = true;
    tiles.set(hexKey(q, r), tile);
  }

  // 3. Đặt ô đảo nhỏ (Seafarers — ngẫu nhiên 2 Mỏ Vàng phân bổ trong 7 ô đảo nhỏ)
  const smallPool = seededShuffle([
    TileType.GOLD, TileType.GOLD,
    TileType.BRICK, TileType.LUMBER, TileType.GRAIN, TileType.WOOL, TileType.ORE
  ], rand);
  const smallNumbers = seededShuffle([3, 4, 5, 6, 8, 9, 10], rand);

  for (let i = 0; i < SMALL_ISLAND_COORDS.length; i++) {
    const { q, r } = SMALL_ISLAND_COORDS[i];
    const type = smallPool[i] ?? TileType.WOOL;
    const num  = type !== TileType.DESERT ? (smallNumbers[i] ?? 6) : null;
    const tile = new HexTile(q, r, type, num);
    tile.isDiscovered = false; // Bắt đầu ở trạng thái sương mù
    tiles.set(hexKey(q, r), tile);
  }

  // 4. Điền ô biển xung quanh (bán kính 4 từ gốc)
  for (let q = -5; q <= 6; q++) {
    for (let r = -4; r <= 5; r++) {
      const k = hexKey(q, r);
      if (!tiles.has(k)) {
        const tile = new HexTile(q, r, TileType.SEA, null);
        tile.isDiscovered = true;
        tiles.set(k, tile);
      }
    }
  }

  // 5. Đặt Robber lên sa mạc
  if (desertCoord) {
    tiles.get(hexKey(desertCoord.q, desertCoord.r)).hasRobber = true;
  }

  return {
    tiles,
    harbors: DEFAULT_HARBORS,
    desertCoord,
    mainIslandCoords:  MAIN_ISLAND_COORDS,
    smallIslandCoords: SMALL_ISLAND_COORDS,
  };
}
