// CommodityType enum
const CommodityType = { PAPER: 'PAPER', CLOTH: 'CLOTH', COIN: 'COIN' };
const ALL_COMMODITIES = ['PAPER', 'CLOTH', 'COIN'];

// KnightLevel enum
const KnightLevel = { BASIC: 'basic', STRONG: 'strong', MIGHTY: 'mighty' };

// KnightStatus
const KnightStatus = { ACTIVE: 'active', INACTIVE: 'inactive' };

// ImprovementTrack
const ImprovementTrack = { TRADE: 'trade', POLITICS: 'politics', SCIENCE: 'science' };

// EventDieFace - 3 ship faces, 3 city gate faces
const EventDieFace = { SHIP: 'ship', TRADE_GATE: 'trade', POLITICS_GATE: 'politics', SCIENCE_GATE: 'science' };
const EVENT_DIE_FACES = ['ship', 'ship', 'ship', 'trade', 'politics', 'science'];

// C&K specific phases
const CKPhase = {
  CK_ALCHEMIST:        'CK_ALCHEMIST',
  CK_BARBARIAN_ATTACK: 'CK_BARBARIAN_ATTACK',
  CK_PROGRESS_DRAW:    'CK_PROGRESS_DRAW',
  CK_KNIGHT_DISPLACED: 'CK_KNIGHT_DISPLACED',
  CK_DESERTER_VICTIM:  'CK_DESERTER_VICTIM',
  CK_DESERTER_PLACE:   'CK_DESERTER_PLACE',
  CK_WEDDING:          'CK_WEDDING',
  CK_SABOTEUR:         'CK_SABOTEUR',
  CK_COMMERCIAL_HARBOR:'CK_COMMERCIAL_HARBOR',
  CK_BISHOP:           'CK_BISHOP',
  CK_SPY:              'CK_SPY',
  CK_MASTER_MERCHANT:  'CK_MASTER_MERCHANT',
  CK_RESOURCE_MONOPOLY:'CK_RESOURCE_MONOPOLY',
  CK_TRADE_MONOPOLY:   'CK_TRADE_MONOPOLY',
  CK_DIPLOMAT:         'CK_DIPLOMAT',
  CK_INTRIGUE:         'CK_INTRIGUE',
};

// Improvement level names (cosmetic)
const IMPROVEMENT_NAMES = {
  science:  ['', 'Tu viện', 'Thư viện', 'Cống dẫn nước', 'Nhà hát', 'Đại học'],
  trade:    ['', 'Chợ', 'Nhà buôn', 'Hội thương nhân', 'Ngân hàng', 'Sàn giao dịch lớn'],
  politics: ['', 'Tòa thị chính', 'Đại sứ quán', 'Pháo đài', 'Tòa án', 'Đại hội đồng'],
};

// Knight strength values
const KNIGHT_STRENGTH = { basic: 1, strong: 2, mighty: 3 };

// C&K Socket events
const CKSocketEvent = {
  CK_ROLL:              'game:ck_roll',
  CK_KNIGHT_ACTION:     'game:ck_knight_action',
  CK_IMPROVE:           'game:ck_improve',
  CK_PROGRESS_PLAY:     'game:ck_progress_play',
  CK_BARBARIAN:         'game:ck_barbarian',
  CK_INTERRUPT:         'game:ck_interrupt',
  CK_INTERRUPT_RESPONSE:'game:ck_interrupt_response',
  CK_BUILD_WALL:        'game:ck_build_wall',
  CK_RECRUIT_KNIGHT:    'game:ck_recruit_knight',
  CK_PROMOTE_KNIGHT:    'game:ck_promote_knight',
  CK_ACTIVATE_KNIGHT:   'game:ck_activate_knight',
};

// Ruleset
const Ruleset = { BASE: 'base', SEAFARERS: 'seafarers', CITIES_KNIGHTS: 'cities_knights' };

export {
  CommodityType,
  ALL_COMMODITIES,
  KnightLevel,
  KnightStatus,
  ImprovementTrack,
  EventDieFace,
  EVENT_DIE_FACES,
  CKPhase,
  IMPROVEMENT_NAMES,
  KNIGHT_STRENGTH,
  CKSocketEvent,
  Ruleset
};

if (typeof window !== 'undefined') {
  window.CommodityType = CommodityType;
  window.ALL_COMMODITIES = ALL_COMMODITIES;
  window.KnightLevel = KnightLevel;
  window.KnightStatus = KnightStatus;
  window.ImprovementTrack = ImprovementTrack;
  window.EventDieFace = EventDieFace;
  window.EVENT_DIE_FACES = EVENT_DIE_FACES;
  window.CKPhase = CKPhase;
  window.IMPROVEMENT_NAMES = IMPROVEMENT_NAMES;
  window.KNIGHT_STRENGTH = KNIGHT_STRENGTH;
  window.CKSocketEvent = CKSocketEvent;
  window.Ruleset = Ruleset;
}
