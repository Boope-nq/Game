/**
 * vi.js — Toàn bộ từ điển và chuỗi ngôn ngữ tiếng Việt chuẩn Catan Cities & Knights (5th Edition)
 *
 * Thuật ngữ chuẩn hóa:
 * - Resources: Gạch, Gỗ, Lúa, Cừu, Quặng (và Vàng nếu chơi cùng Seafarers)
 * - Commodities: Giấy (Paper), Vải (Cloth), Đồng xu (Coin)
 * - Buildings: Định cư (Settlement), Thành phố (City), Đường bộ (Road), Tàu biển (Ship), Tường thành (City Wall)
 * - Improvements: Nâng cấp thành phố (City Improvements)
 *   + Khoa học (Science): Tu viện, Thư viện, Cống dẫn nước (Aqueduct), Nhà hát, Đại học
 *   + Thương mại (Trade): Chợ, Nhà buôn, Hội thương nhân (Trading House), Ngân hàng, Sàn giao dịch lớn
 *   + Chính trị (Politics): Tòa thị chính, Đại sứ quán, Pháo đài (Fortress), Tòa án, Đại hội đồng
 * - Knights: Hiệp sĩ thường (Basic), Hiệp sĩ mạnh (Strong), Hiệp sĩ tinh nhuệ (Mighty)
 * - Metropolis: Đại đô thị / Thủ phủ
 * - Barbarians: Thuyền man rợ, Đợt tấn công của quân man rợ
 * - Tokens: Huy hiệu Người bảo vệ Catan (Defender of Catan)
 * - Progress Cards: Thẻ tiến bộ
 */

export const VI = {
  // ─── Chung ────────────────────────────────────────────────────────────────
  'game.title': 'Catan: Thành phố & Hiệp sĩ',
  'game.subtitle': 'Cities & Knights (Phiên bản thứ 5)',
  'game.win_vp': '13 Điểm chiến thắng',
  'game.victory': 'Chiến thắng!',

  // ─── Tài nguyên ──────────────────────────────────────────────────────────
  'resource.BRICK': 'Gạch',
  'resource.LUMBER': 'Gỗ',
  'resource.GRAIN': 'Lúa',
  'resource.WOOL': 'Cừu',
  'resource.ORE': 'Quặng',
  'resource.GOLD': 'Vàng',

  // ─── Hàng hóa ────────────────────────────────────────────────────────────
  'commodity.PAPER': 'Giấy',
  'commodity.CLOTH': 'Vải',
  'commodity.COIN': 'Đồng xu',

  // ─── Công trình ──────────────────────────────────────────────────────────
  'building.settlement': 'Định cư',
  'building.city': 'Thành phố',
  'building.road': 'Đường bộ',
  'building.ship': 'Tàu biển',
  'building.cityWall': 'Tường thành',
  'building.metropolis': 'Đại đô thị',

  // ─── Hiệp sĩ ─────────────────────────────────────────────────────────────
  'knight.basic': 'Hiệp sĩ thường (Sức mạnh 1)',
  'knight.strong': 'Hiệp sĩ mạnh (Sức mạnh 2)',
  'knight.mighty': 'Hiệp sĩ tinh nhuệ (Sức mạnh 3)',
  'knight.active': 'Đã kích hoạt',
  'knight.inactive': 'Chưa kích hoạt',
  'knight.action.recruit': 'Chiêu mộ hiệp sĩ',
  'knight.action.promote': 'Thăng cấp hiệp sĩ',
  'knight.action.activate': 'Kích hoạt hiệp sĩ',
  'knight.action.move': 'Di chuyển hiệp sĩ',
  'knight.action.displace': 'Đẩy lùi hiệp sĩ',
  'knight.action.chaseRobber': 'Xua đuổi Tên cướp',

  // ─── Nhánh nâng cấp thành phố ───────────────────────────────────────────
  'track.science': 'Khoa học',
  'track.trade': 'Thương mại',
  'track.politics': 'Chính trị',

  'improvement.science.1': 'Tu viện (Abbey)',
  'improvement.science.2': 'Thư viện (Library)',
  'improvement.science.3': 'Cống dẫn nước (Aqueduct)',
  'improvement.science.4': 'Nhà hát (Theater)',
  'improvement.science.5': 'Đại học (University)',

  'improvement.trade.1': 'Chợ (Market)',
  'improvement.trade.2': 'Nhà buôn (Trading Post)',
  'improvement.trade.3': 'Hội thương nhân (Trading House)',
  'improvement.trade.4': 'Ngân hàng (Bank)',
  'improvement.trade.5': 'Sàn giao dịch lớn (Great Exchange)',

  'improvement.politics.1': 'Tòa thị chính (Town Hall)',
  'improvement.politics.2': 'Đại sứ quán (Embassy)',
  'improvement.politics.3': 'Pháo đài (Fortress)',
  'improvement.politics.4': 'Tòa án (Court)',
  'improvement.politics.5': 'Đại hội đồng (Assembly)',

  // ─── Thẻ tiến bộ: Tên & Hiệu ứng (26 loại thẻ) ──────────────────────────
  // Khoa học (Science)
  'card.alchemist.name': 'Nhà giả kim (Alchemist)',
  'card.alchemist.desc': 'Trước khi tung xúc xắc, chọn kết quả của 2 xúc xắc sản xuất; sau đó tung xúc xắc sự kiện như bình thường.',
  'card.crane.name': 'Cần cẩu (Crane)',
  'card.crane.desc': 'Nâng cấp thành phố tiếp theo trong lượt này được giảm 1 hàng hóa (cấp 1 thành miễn phí).',
  'card.engineer.name': 'Kỹ sư (Engineer)',
  'card.engineer.desc': 'Xây 1 tường thành miễn phí tại một thành phố của bạn (không tốn 2 Gạch).',
  'card.inventor.name': 'Nhà phát minh (Inventor)',
  'card.inventor.desc': 'Hoán đổi 2 đĩa số bất kỳ trên bàn chơi trừ các số đỏ/biên (2, 6, 8, 12). Tên cướp không di chuyển.',
  'card.irrigation.name': 'Thủy lợi (Irrigation)',
  'card.irrigation.desc': 'Nhận 2 Lúa cho mỗi ô Cánh đồng (Fields) kề ít nhất 1 công trình của bạn.',
  'card.medicine.name': 'Y học (Medicine)',
  'card.medicine.desc': 'Nâng cấp 1 định cư lên thành phố với giá ưu đãi: chỉ 1 Lúa + 2 Quặng.',
  'card.mining.name': 'Khai khoáng (Mining)',
  'card.mining.desc': 'Nhận 2 Quặng cho mỗi ô Núi (Mountains) kề ít nhất 1 công trình của bạn.',
  'card.printer.name': 'Máy in (Printer)',
  'card.printer.desc': '1 Điểm chiến thắng (VP). Ngửa mặt ngay lập tức khi rút được.',
  'card.road_building.name': 'Xây đường (Road Building)',
  'card.road_building.desc': 'Đặt 2 đoạn đường (hoặc tàu biển) miễn phí.',
  'card.smith.name': 'Thợ rèn (Smith)',
  'card.smith.desc': 'Thăng cấp tối đa 2 hiệp sĩ của bạn miễn phí (mỗi hiệp sĩ vẫn tuân thủ giới hạn 1 lần/lượt).',

  // Thương mại (Trade)
  'card.commercial_harbor.name': 'Cảng thương mại (Commercial Harbor)',
  'card.commercial_harbor.desc': 'Đưa 1 tài nguyên cho mỗi đối thủ; mỗi đối thủ có hàng hóa phải đưa lại 1 hàng hóa tự chọn cho bạn.',
  'card.master_merchant.name': 'Đại thương gia (Master Merchant)',
  'card.master_merchant.desc': 'Chọn 1 đối thủ có nhiều Điểm chiến thắng (VP) hơn bạn, xem bài họ và lấy 2 thẻ tài nguyên/hàng hóa tùy chọn.',
  'card.merchant.name': 'Thương nhân (Merchant)',
  'card.merchant.desc': 'Lấy quân Thương nhân đặt lên ô kề công trình của bạn (+1 VP, đổi 2:1 tài nguyên của ô đó với ngân hàng).',
  'card.merchant_fleet.name': 'Đội tàu buôn (Merchant Fleet)',
  'card.merchant_fleet.desc': 'Trong suốt lượt này, bạn được quyền đổi 2:1 với ngân hàng cho 1 loại tài nguyên hoặc hàng hóa chỉ định.',
  'card.resource_monopoly.name': 'Độc quyền tài nguyên (Resource Monopoly)',
  'card.resource_monopoly.desc': 'Đọc tên 1 tài nguyên; mỗi đối thủ phải giao nộp 2 thẻ đó (hoặc 1 nếu chỉ có 1 thẻ).',
  'card.trade_monopoly.name': 'Độc quyền hàng hóa (Trade Monopoly)',
  'card.trade_monopoly.desc': 'Đọc tên 1 hàng hóa; mỗi đối thủ phải giao nộp 1 thẻ đó (nếu có).',

  // Chính trị (Politics)
  'card.diplomat.name': 'Nhà ngoại giao (Diplomat)',
  'card.diplomat.desc': 'Gỡ 1 con đường hở của đối thủ trả về kho (nếu gỡ đường của mình, được xây lại 1 đường miễn phí).',
  'card.spy.name': 'Gián điệp (Spy)',
  'card.spy.desc': 'Xem các thẻ tiến bộ trên tay 1 đối thủ và cướp 1 thẻ (trừ thẻ VP).',
  'card.warlord.name': 'Thống soái (Warlord)',
  'card.warlord.desc': 'Kích hoạt (Active) MIỄN PHÍ toàn bộ hiệp sĩ của bạn trên bàn cờ.',
  'card.intrigue.name': 'Âm mưu (Intrigue)',
  'card.intrigue.desc': 'Đẩy lùi hiệp sĩ đối phương trên giao điểm kề đường của bạn (không cần dùng hiệp sĩ của mình).',
  'card.bishop.name': 'Giám mục (Bishop)',
  'card.bishop.desc': 'Di chuyển Tên cướp và cướp 1 thẻ từ MỖI người chơi có công trình tại ô mới (chỉ chơi khi Robber đã vào bàn).',
  'card.constitution.name': 'Hiến pháp (Constitution)',
  'card.constitution.desc': '1 Điểm chiến thắng (VP). Ngửa mặt ngay lập tức khi rút được.',
  'card.deserter.name': 'Kẻ đào ngũ (Deserter)',
  'card.deserter.desc': 'Chọn 1 đối thủ, họ phải tự chọn gỡ 1 hiệp sĩ trả về kho; bạn được đặt 1 hiệp sĩ cùng bậc hoặc thấp hơn từ kho.',
  'card.wedding.name': 'Đám cưới (Wedding)',
  'card.wedding.desc': 'Mỗi đối thủ có nhiều Điểm chiến thắng (VP) hơn bạn phải tặng bạn 2 thẻ tài nguyên/hàng hóa tự chọn.',
  'card.saboteur.name': 'Kẻ phá hoại (Saboteur)',
  'card.saboteur.desc': 'Mỗi đối thủ có bằng hoặc nhiều Điểm chiến thắng (VP) hơn bạn phải bỏ nửa số thẻ bài trên tay (làm tròn xuống).',

  // ─── Quân man rợ ─────────────────────────────────────────────────────────
  'barbarian.track': 'Hành trình Thuyền man rợ',
  'barbarian.attack': 'Quân man rợ tấn công!',
  'barbarian.defenders_won': 'Catan đẩy lùi quân man rợ!',
  'barbarian.defenders_lost': 'Thất thủ! Quân man rợ cướp phá Catan!',
  'barbarian.token_awarded': 'Nhận Huy hiệu Người bảo vệ Catan (+1 VP)',
  'barbarian.tie_reward': 'Hòa đóng góp hiệp sĩ: Mỗi người rút 1 thẻ tiến bộ',
  'barbarian.city_pillaged': 'Thành phố bị cướp phá giáng cấp thành Định cư!',
  'barbarian.metropolis_immune': 'Đại đô thị miễn nhiễm cướp phá!',
  'barbarian.wall_destroyed': 'Tường thành tại thành phố bị phá hủy!',

  // ─── Chi phí tra cứu nhanh ───────────────────────────────────────────────
  'cost.road': '1 Gỗ + 1 Gạch',
  'cost.settlement': '1 Gỗ + 1 Gạch + 1 Cừu + 1 Lúa',
  'cost.city': '3 Quặng + 2 Lúa',
  'cost.cityWall': '2 Gạch',
  'cost.recruitKnight': '1 Cừu + 1 Quặng',
  'cost.promoteKnight': '1 Cừu + 1 Quặng',
  'cost.activateKnight': '1 Lúa',
  'cost.improvement': 'N hàng hóa theo cấp độ (Cấp 1: 1, Cấp 2: 2, ... Cấp 5: 5)',
};

/**
 * Hàm dịch thuật chuẩn
 * @param {string} key
 * @param {Object} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  let str = VI[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`{${k}}`, 'g'), v);
  }
  return str;
}
