/**
 * CKRulesConfig.js — Cấu hình luật Thành phố & Hiệp sĩ (5th Edition)
 * Đây là nguồn duy nhất cho tất cả magic numbers.
 */

export const CK_CONFIG = Object.freeze({
  // Victory
  WIN_VP: 13,

  // Hand limits
  HAND_LIMIT_BASE: 7,        // discard khi > limit (trên số 7)
  WALL_LIMIT_BONUS: 2,       // +2 per wall
  MAX_WALLS_PER_PLAYER: 3,
  PROGRESS_HAND_LIMIT: 4,    // max progress cards in hand (VP excluded)

  // Stock per player
  STOCK: {
    settlements: 5,
    cities: 4,
    roads: 15,
    walls: 3,
    knights: { basic: 2, strong: 2, mighty: 2 },
  },

  // Costs (resources)
  COSTS: {
    road:           { LUMBER: 1, BRICK: 1 },
    settlement:     { LUMBER: 1, BRICK: 1, WOOL: 1, GRAIN: 1 },
    city:           { ORE: 3, GRAIN: 2 },
    cityWall:       { BRICK: 2 },
    recruitKnight:  { WOOL: 1, ORE: 1 },
    promoteKnight:  { WOOL: 1, ORE: 1 },
    activateKnight: { GRAIN: 1 },
  },
  // City improvement: level N costs N commodities of track type (computed, not stored here)

  // City production (what a CITY produces per hex type)
  // Settlement always produces 1 resource as base
  CITY_PRODUCTION: {
    LUMBER: { resource: 'LUMBER', commodity: 'PAPER',  resQty: 1, comQty: 1 },
    WOOL:   { resource: 'WOOL',   commodity: 'CLOTH',  resQty: 1, comQty: 1 },
    ORE:    { resource: 'ORE',    commodity: 'COIN',   resQty: 1, comQty: 1 },
    BRICK:  { resource: 'BRICK',  commodity: null,     resQty: 2, comQty: 0 },
    GRAIN:  { resource: 'GRAIN',  commodity: null,     resQty: 2, comQty: 0 },
  },

  // Track → commodity type
  TRACK_COMMODITY: { trade: 'CLOTH', politics: 'COIN', science: 'PAPER' },

  // Commodity supply per type
  COMMODITY_SUPPLY: 12,

  // Improvement tracks
  MAX_IMPROVEMENT_LEVEL: 5,
  METROPOLIS_LEVEL: 4,  // first to reach this level gets metropolis

  // Progress card draw: red die ranges per improvement level
  // Level 0: never draws. Level N: draws if red die <= progressDrawRange[N]
  progressDrawRange: [0, 2, 3, 4, 5, 6],
  // Index 0 = level 0 (never), 1 = level 1 (red 1-2), ... 5 = level 5 (red 1-6 = always)

  // Knight strengths
  KNIGHT_STRENGTH: { basic: 1, strong: 2, mighty: 3 },

  // Barbarian track
  barbarianSteps: 7,  // attack after this many ship results

  // OPEN FLAGS (configurable)
  skipEventDieFirstRounds: true,   // (a) skip event die in first 2 rounds
  deserterVictimChooses: true,     // (b) victim chooses which knight to remove
  bishopRequiresRobber: true,      // (c) Bishop requires robber on board

  // Progress card deck sizes (per deck)
  PROGRESS_DECK_SIZES: { science: 18, trade: 18, politics: 18 },
});

// Computed helper: improvement cost for a given track at a given level
export function improvementCost(track, level) {
  const commodity = CK_CONFIG.TRACK_COMMODITY[track];
  return { [commodity]: level };
}

// Helper: get hand limit for a player with N walls
export function handLimit(numWalls) {
  return CK_CONFIG.HAND_LIMIT_BASE + (numWalls * CK_CONFIG.WALL_LIMIT_BONUS);
}
