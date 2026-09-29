/**
 * constants.js — Hằng số dùng chung giữa client và server
 */

// Resource types
const ResourceType = {
  BRICK:  'BRICK',
  LUMBER: 'LUMBER',
  GRAIN:  'GRAIN',
  WOOL:   'WOOL',
  ORE:    'ORE',
};

const ALL_RESOURCES = Object.values(ResourceType);

// Tile types
const TileType = {
  BRICK:  'BRICK',
  LUMBER: 'LUMBER',
  GRAIN:  'GRAIN',
  WOOL:   'WOOL',
  ORE:    'ORE',
  GOLD:   'GOLD',
  SEA:    'SEA',
  DESERT: 'DESERT',
};

// Resource produced by each tile type
const TileResource = {
  BRICK:  'BRICK',
  LUMBER: 'LUMBER',
  GRAIN:  'GRAIN',
  WOOL:   'WOOL',
  ORE:    'ORE',
  GOLD:   'GOLD',
  SEA:    null,
  DESERT: null,
};

// Build costs (exact Catan rules)
const BUILD_COST = {
  road:       { BRICK: 1, LUMBER: 1 },
  ship:       { LUMBER: 1, WOOL: 1 },
  settlement: { BRICK: 1, LUMBER: 1, GRAIN: 1, WOOL: 1 },
  city:       { GRAIN: 2, ORE: 3 },
  devCard:    { GRAIN: 1, WOOL: 1, ORE: 1 },
};

// Game phases
const Phase = {
  SETUP_SETTLEMENT: 'SETUP_SETTLEMENT',
  SETUP_ROAD:       'SETUP_ROAD',
  ROLL:             'ROLL',
  ROBBER:           'ROBBER',
  STEAL:            'STEAL',
  DISCARD:          'DISCARD',
  GOLD_PICK:        'GOLD_PICK',
  BUILD:            'BUILD',
  GAME_OVER:        'GAME_OVER',
};

// Player colors
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];
const PLAYER_COLORS_HEX = [0xE74C3C, 0x3498DB, 0x2ECC71, 0xF39C12];
const PLAYER_COLOR_NAMES = ['Đỏ', 'Xanh dương', 'Xanh lá', 'Cam'];

// Dev card types
const DevCardType = {
  KNIGHT:         'KNIGHT',
  VP:             'VP',
  ROAD_BUILDING:  'ROAD_BUILDING',
  YEAR_OF_PLENTY: 'YEAR_OF_PLENTY',
  MONOPOLY:       'MONOPOLY',
};

// Dev card pool (25 cards, official Catan)
const DEV_CARD_POOL = [
  ...Array(14).fill(DevCardType.KNIGHT),
  ...Array(5).fill(DevCardType.VP),
  ...Array(2).fill(DevCardType.ROAD_BUILDING),
  ...Array(2).fill(DevCardType.YEAR_OF_PLENTY),
  ...Array(2).fill(DevCardType.MONOPOLY),
];

// Stock per player (official)
const INITIAL_STOCK = {
  settlements: 5,
  cities:      4,
  roads:       15,
  ships:       15,
};

// Winning VP thresholds
const WIN_VP = {
  voyages:  13,
  standard: 10,
};

// Tile type → 3D color (Three.js hex color)
const TILE_3D_COLOR = {
  BRICK:  0xC05030,
  LUMBER: 0x2d6a2d,
  GRAIN:  0xE8C444,
  WOOL:   0x88C857,
  ORE:    0x7A7A8E,
  GOLD:   0xFFD700,
  SEA:    0x1a5fa0,
  DESERT: 0xD4B97A,
};

// Tile extrude height for 3D
const TILE_HEIGHT = {
  BRICK:  0.5,
  LUMBER: 0.45,
  GRAIN:  0.4,
  WOOL:   0.38,
  ORE:    0.6,
  GOLD:   0.5,
  SEA:    0.15,
  DESERT: 0.3,
};

// Socket events
const SocketEvent = {
  // Lobby
  ROOM_LIST:    'room:list',
  ROOM_CREATE:  'room:create',
  ROOM_JOIN:    'room:join',
  ROOM_LEAVE:   'room:leave',
  ROOM_UPDATE:  'room:update',
  ROOM_READY:   'room:ready',
  ROOM_KICK:    'room:kick',
  FRIEND_ONLINE: 'friend:online',
  CHAT_ROOM:    'chat:room',
  CHAT_MSG:     'chat:msg',

  // Game
  GAME_START:      'game:start',
  GAME_STATE:      'game:state',
  GAME_ROLL:       'game:roll',
  GAME_BUILD:      'game:build',
  GAME_SETUP:      'game:setup_place',
  GAME_ROBBER:     'game:move_robber',
  GAME_STEAL:      'game:steal',
  GAME_TRADE_BANK: 'game:trade_bank',
  GAME_TRADE_OFFER:'game:trade_offer',
  GAME_TRADE_ACCEPT:'game:trade_accept',
  GAME_DEV_BUY:    'game:devcard_buy',
  GAME_DEV_PLAY:   'game:devcard_play',
  GAME_END_TURN:   'game:end_turn',
  GAME_DISCARD:    'game:discard',
  GAME_GOLD_PICK:  'game:gold_pick',
  GAME_OVER:       'game:over',
  GAME_ERROR:      'game:error',
};

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined') {
  module.exports = {
    ResourceType, ALL_RESOURCES, TileType, TileResource,
    BUILD_COST, Phase, PLAYER_COLORS, PLAYER_COLORS_HEX,
    PLAYER_COLOR_NAMES, DevCardType, DEV_CARD_POOL,
    INITIAL_STOCK, WIN_VP, TILE_3D_COLOR, TILE_HEIGHT, SocketEvent,
  };
}
// Also available as ES module globals for browser
