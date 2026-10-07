/**
 * CKRulesPanel.js — Bảng tra cứu luật chơi Cities & Knights (5th Edition) tích hợp
 *
 * Tính năng:
 * - Nút "Luật chơi" có thể mở bất cứ lúc nào, hỗ trợ ESC / đóng panel mà không làm gián đoạn ván đấu.
 * - Cheat sheet (Bảng tra cứu nhanh): Bảng chi phí xây dựng, bảng sản xuất City, dải xúc xắc đỏ.
 * - Các tab chi tiết:
 *   1. Bảng tra cứu nhanh (Cheat Sheet)
 *   2. Mục tiêu & Vòng chơi (13 VP, 3 Phase)
 *   3. Sản xuất & Hàng hóa (City Production & Discard on 7)
 *   4. Giao dịch & Thương nhân (Trade House 2:1, Merchant)
 *   5. Nâng cấp thành phố & Đại đô thị (3 Tracks, Metropolis, Walls)
 *   6. Hiệp sĩ (Knights: Sức mạnh, hành động, chặn đường)
 *   7. Quân man rợ (Barbarians: Tính điểm, cướp phá, hồi sinh Robber)
 *   8. 54 Thẻ tiến bộ (Toàn bộ 26 loại thẻ phân loại theo màu)
 */

import { VI, t } from '../../shared/i18n/vi.js';
import { CK_CONFIG } from '../gameplay/CKRulesConfig.js';

export class CKRulesPanel {
  constructor() {
    this.isOpen = false;
    this.activeTab = 'cheat_sheet';
    this._build();
  }

  _build() {
    // Tạo container modal
    const panelEl = document.createElement('div');
    panelEl.id = 'ck-rules-modal';
    panelEl.className = 'dialog-overlay hidden';
    panelEl.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 99999;
      display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);
    `;

    panelEl.innerHTML = `
      <div class="rules-dialog-box" style="
        background: #0d2340; color: #fff; width: 92%; max-width: 900px; max-height: 88vh;
        border-radius: 12px; border: 1px solid #0284c7; display: flex; flex-direction: column;
        box-shadow: 0 10px 30px rgba(0,0,0,0.7); overflow: hidden; font-family: inherit;
      ">
        <!-- Header -->
        <div style="padding: 16px 20px; background: #07192f; border-bottom: 1px solid #1e3a5f; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 1.25rem; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
            📜 Luật Chơi: CATAN - Thành phố & Hiệp sĩ (5th Edition)
          </h2>
          <button id="btn-close-rules" style="background: transparent; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; padding: 4px 8px;">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div id="rules-tab-bar" style="display: flex; gap: 4px; padding: 8px 16px; background: #091e36; border-bottom: 1px solid #1e3a5f; overflow-x: auto;">
          <button class="rules-tab-btn active" data-tab="cheat_sheet">Tra cứu nhanh</button>
          <button class="rules-tab-btn" data-tab="overview">Tổng quan (13 VP)</button>
          <button class="rules-tab-btn" data-tab="production">Sản xuất & Hàng hóa</button>
          <button class="rules-tab-btn" data-tab="trading">Giao dịch</button>
          <button class="rules-tab-btn" data-tab="improvements">Nâng cấp & Metropolis</button>
          <button class="rules-tab-btn" data-tab="knights">Hiệp sĩ</button>
          <button class="rules-tab-btn" data-tab="barbarians">Quân man rợ</button>
          <button class="rules-tab-btn" data-tab="cards">54 Thẻ tiến bộ</button>
        </div>

        <!-- Tab Content Body -->
        <div id="rules-content-body" style="padding: 20px; overflow-y: auto; flex: 1; font-size: 0.92rem; line-height: 1.6;">
          ${this._getCheatSheetHTML()}
        </div>
      </div>
    `;

    document.body.appendChild(panelEl);
    this.panelEl = panelEl;
    this._bindEvents();
  }

  _bindEvents() {
    // Đóng panel
    const closeBtn = this.panelEl.querySelector('#btn-close-rules');
    if (closeBtn) closeBtn.onclick = () => this.toggle(false);

    // Bấm ra ngoài backdrop để đóng
    this.panelEl.onclick = (e) => {
      if (e.target === this.panelEl) this.toggle(false);
    };

    // Phím ESC đóng panel
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.toggle(false);
      }
    });

    // Chuyển tab
    const tabs = this.panelEl.querySelectorAll('.rules-tab-btn');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.style.background = 'transparent';
          t.style.color = '#94a3b8';
        });
        tab.classList.add('active');
        tab.style.background = '#0284c7';
        tab.style.color = '#fff';
        this._renderTab(tab.dataset.tab);
      };
    });
  }

  toggle(show = null) {
    this.isOpen = (show !== null) ? show : !this.isOpen;
    this.panelEl.classList.toggle('hidden', !this.isOpen);
    this.panelEl.style.display = this.isOpen ? 'flex' : 'none';
  }

  _renderTab(tabKey) {
    this.activeTab = tabKey;
    const body = this.panelEl.querySelector('#rules-content-body');
    if (!body) return;

    switch (tabKey) {
      case 'cheat_sheet':
        body.innerHTML = this._getCheatSheetHTML();
        break;
      case 'overview':
        body.innerHTML = this._getOverviewHTML();
        break;
      case 'production':
        body.innerHTML = this._getProductionHTML();
        break;
      case 'trading':
        body.innerHTML = this._getTradingHTML();
        break;
      case 'improvements':
        body.innerHTML = this._getImprovementsHTML();
        break;
      case 'knights':
        body.innerHTML = this._getKnightsHTML();
        break;
      case 'barbarians':
        body.innerHTML = this._getBarbariansHTML();
        break;
      case 'cards':
        body.innerHTML = this._getCardsHTML();
        break;
    }
  }

  _getCheatSheetHTML() {
    return `
      <div style="background:#091b30; padding:16px; border-radius:8px; border:1px solid #1e3a5f; margin-bottom:16px;">
        <h3 style="color:#38bdf8; margin-top:0;">⚡ Bảng Chi Phí Xây Dựng & Hành Động</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:8px;">
          <tr style="border-bottom:1px solid #1e3a5f; text-align:left;">
            <th style="padding:6px;">Mục</th><th style="padding:6px;">Chi phí</th>
          </tr>
          <tr><td style="padding:6px;">Đường bộ (Road)</td><td>1 Gỗ + 1 Gạch</td></tr>
          <tr><td style="padding:6px;">Định cư (Settlement)</td><td>1 Gỗ + 1 Gạch + 1 Cừu + 1 Lúa</td></tr>
          <tr><td style="padding:6px;">Thành phố (City)</td><td>3 Quặng + 2 Lúa</td></tr>
          <tr><td style="padding:6px;">Tường thành (City Wall)</td><td>2 Gạch (Tối đa 3 tường, +2 giới hạn bài/tường)</td></tr>
          <tr><td style="padding:6px;">Chiêu mộ Hiệp sĩ</td><td>1 Cừu + 1 Quặng (Inactive ban đầu)</td></tr>
          <tr><td style="padding:6px;">Thăng cấp Hiệp sĩ</td><td>1 Cừu + 1 Quặng (Tối đa 1 lần/lượt)</td></tr>
          <tr><td style="padding:6px;">Kích hoạt Hiệp sĩ</td><td>1 Lúa (Active)</td></tr>
          <tr><td style="padding:6px;">Nâng cấp Thành phố Cấp N</td><td>N hàng hóa tương ứng (Cấp 1: 1, Cấp 2: 2, ... Cấp 5: 5)</td></tr>
        </table>
      </div>

      <div style="background:#091b30; padding:16px; border-radius:8px; border:1px solid #1e3a5f;">
        <h3 style="color:#38bdf8; margin-top:0;">🏭 Bảng Sản Xuất Của Thành Phố (City)</h3>
        <p>• Rừng (Forest): <strong>1 Gỗ + 1 Giấy (Paper)</strong><br>
        • Đồng cỏ (Pasture): <strong>1 Cừu + 1 Vải (Cloth)</strong><br>
        • Núi (Mountains): <strong>1 Quặng + 1 Đồng xu (Coin)</strong><br>
        • Đồi (Hills): <strong>2 Gạch</strong><br>
        • Cánh đồng (Fields): <strong>2 Lúa</strong></p>
      </div>
    `;
  }

  _getOverviewHTML() {
    return `
      <h3 style="color:#38bdf8;">🎯 Mục Tiêu & Cấu Trúc Lượt Chơi</h3>
      <p>• <strong>Mục tiêu:</strong> Người chơi đầu tiên đạt <strong>13 Điểm chiến thắng (VP)</strong> trong lượt của mình sẽ chiến thắng ngay lập tức.<br>
      • <strong>Cơ cấu điểm:</strong><br>
      - Định cư = 1 VP<br>
      - Thành phố = 2 VP<br>
      - Đại đô thị (Metropolis) = +2 VP (thành phố có Metropolis = 4 VP)<br>
      - Tuyến đường dài nhất = 2 VP<br>
      - Huy hiệu Người bảo vệ Catan = 1 VP / huy hiệu<br>
      - Kiểm soát Thương nhân = 1 VP<br>
      - Thẻ tiến bộ VP (Máy in, Hiến pháp) = 1 VP / thẻ (ngửa mặt ngay khi rút)</p>

      <h4 style="color:#38bdf8;">🔄 Thứ Tự Lượt Chơi</h4>
      <p>1. <strong>Giai đoạn gieo xúc xắc (Roll Phase):</strong> Tung 3 viên (Xúc xắc Sự kiện giải quyết TRƯỚC, sau đó đến Đỏ + Vàng).<br>
      2. <strong>Giai đoạn sản xuất (Production Phase):</strong> Phân phối tài nguyên & hàng hóa hoặc giải quyết số 7.<br>
      3. <strong>Giai đoạn hành động (Action/Build Phase):</strong> Xây dựng, chiêu mộ/thăng cấp/di chuyển hiệp sĩ, mua nâng cấp, đánh thẻ tiến bộ, giao dịch.</p>
    `;
  }

  _getProductionHTML() {
    return `
      <h3 style="color:#38bdf8;">🌾 Sản Xuất & Hàng Hóa (Commodities)</h3>
      <p>• Có 3 loại hàng hóa: <strong>Giấy (Paper)</strong>, <strong>Vải (Cloth)</strong>, <strong>Đồng xu (Coin)</strong>.<br>
      • Định cư chỉ sản xuất 1 tài nguyên cơ bản. Thành phố sản xuất 1 tài nguyên + 1 hàng hóa (trên ô Đồi & Cánh đồng nhận 2 tài nguyên).<br>
      • Nguồn cung hàng hóa: Tối đa 12 thẻ cho mỗi loại hàng hóa.</p>

      <h4 style="color:#38bdf8;">🎲 Quy Tắc Số 7 & Tường Thành</h4>
      <p>• Giới hạn bài cơ bản là <strong>7 thẻ</strong>.<br>
      • Mỗi Tường thành tăng giới hạn thêm <strong>+2 thẻ</strong> (Tối đa 3 tường = 13 thẻ).<br>
      • Tổng bài tính gộp cả <strong>Tài nguyên và Hàng hóa</strong> (không tính thẻ tiến bộ). Ai vượt quá giới hạn phải bỏ 1/2 số thẻ.<br>
      • <strong>Tên cướp (Robber):</strong> KHÔNG di chuyển hay cướp bài trước khi quân man rợ tấn công lần đầu tiên.</p>
    `;
  }

  _getTradingHTML() {
    return `
      <h3 style="color:#38bdf8;">🤝 Giao Dịch Mở Rộng</h3>
      <p>• <strong>Ngân hàng:</strong> Hàng hóa có thể đổi lấy Tài nguyên hoặc Hàng hóa khác với tỷ lệ 4:1 (hoặc 3:1 nếu có Cảng chung). Cảng 2:1 chuyên dụng chỉ áp dụng cho tài nguyên.<br>
      • <strong>Đặc quyền Hội thương nhân (Trade L3):</strong> Đổi 2 hàng hóa cùng loại lấy bất kỳ 1 thẻ hàng hóa hoặc tài nguyên nào.<br>
      • <strong>Thương nhân (Merchant):</strong> Người nắm giữ Thương nhân được đổi 2:1 tài nguyên của ô có thương nhân đóng giữ.<br>
      • <strong>Giữa người chơi:</strong> Được phép tự do trao đổi cả Tài nguyên và Hàng hóa. Cấm trao đổi thẻ Tiến bộ.</p>
    `;
  }

  _getImprovementsHTML() {
    return `
      <h3 style="color:#38bdf8;">🏛️ Nâng Cấp Thành Phố & Đại Đô Thị</h3>
      <p>• Có 3 nhánh nâng cấp: <strong>Khoa học (Giấy)</strong>, <strong>Thương mại (Vải)</strong>, <strong>Chính trị (Đồng xu)</strong>.<br>
      • Mỗi nhánh có 5 cấp, chi phí Cấp N = N hàng hóa tương ứng.<br>
      • <strong>Điều kiện:</strong> Phải có ít nhất 1 thành phố trên bàn mới được nâng cấp.<br>
      • <strong>Đại đô thị (Metropolis):</strong><br>
      - Người đầu tiên đạt Cấp 4 nhận Đại đô thị (+2 VP).<br>
      - Người đạt Cấp 5 sẽ cướp Đại đô thị từ người chỉ ở Cấp 4.<br>
      - Nếu người giữ cũng đạt Cấp 5, Đại đô thị vĩnh viễn không bị cướp.<br>
      - Thành phố có Đại đô thị <strong>miễn nhiễm cướp phá</strong> khi quân man rợ thắng.<br>
      - Mỗi thành phố chỉ gắn được tối đa 1 Đại đô thị.</p>
    `;
  }

  _getKnightsHTML() {
    return `
      <h3 style="color:#38bdf8;">🛡️ Hiệp Sĩ (Knights)</h3>
      <p>• <strong>Sức mạnh:</strong> Thường (1) ➔ Mạnh (2) ➔ Tinh nhuệ (3). Kho quân mỗi người: 2/2/2.<br>
      • <strong>Chiêu mộ:</strong> 1 Cừu + 1 Quặng trên giao điểm kề đường/tàu. Không áp dụng luật khoảng cách. Ban đầu Inactive.<br>
      • <strong>Kích hoạt:</strong> 1 Lúa. <em>Cấm kích hoạt rồi hành động ngay trong cùng lượt!</em><br>
      • <strong>Thăng cấp:</strong> 1 Cừu + 1 Quặng. Tối đa 1 lần/lượt. Lên Tinh nhuệ (Mighty) cần Chính trị Cấp 3.<br>
      • <strong>Hành động (Chỉ hiệp sĩ Active):</strong><br>
      - <em>Di chuyển:</em> Đi dọc theo tuyến đường của mình đến điểm trống.<br>
      - <em>Đẩy lùi:</em> Đi vào vị trí có hiệp sĩ đối thủ yếu hơn. Đối thủ phải chạy trốn hoặc bị loại về kho.<br>
      - <em>Xua đuổi Tên cướp:</em> Đứng kề ô tên cướp để xua đuổi sang ô khác.<br>
      - <em>Chặn đường:</em> Hiệp sĩ đối phương ngắt tuyến đường dài nhất (Longest Road).</p>
    `;
  }

  _getBarbariansHTML() {
    return `
      <h3 style="color:#38bdf8;">⛵ Quân Man Rợ Tấn Công</h3>
      <p>• <strong>Sức mạnh Man rợ:</strong> Tổng số Thành phố của tất cả người chơi.<br>
      • <strong>Sức phòng thủ Catan:</strong> Tổng sức mạnh của TẤT CẢ Hiệp sĩ đang Active trên bàn.<br>
      • <strong>Nếu Phòng thủ Thắng (Phòng thủ >= Man rợ):</strong><br>
      - Người đóng góp sức mạnh hiệp sĩ active lớn nhất nhận <strong>Huy hiệu Người bảo vệ (+1 VP)</strong>.<br>
      - Nếu hòa ở mức cao nhất: Mỗi người hòa được rút 1 thẻ tiến bộ.<br>
      • <strong>Nếu Man rợ Thắng:</strong><br>
      - Người đóng góp thấp nhất bị giáng cấp 1 Thành phố thành Định cư và mất Tường thành.<br>
      - Thành phố có Đại đô thị được miễn nhiễm cướp phá.<br>
      • <strong>Sau mỗi đợt tấn công:</strong> Thuyền về 0, TOÀN BỘ hiệp sĩ chuyển về trạng thái Inactive.<br>
      • <strong>Đợt đầu tiên:</strong> Tên cướp chính thức xuất hiện tại Sa mạc.</p>
    `;
  }

  _getCardsHTML() {
    return `
      <h3 style="color:#38bdf8;">✨ 54 Thẻ Tiến Bộ (Progress Cards)</h3>
      <div style="display:grid; grid-template-columns:1fr; gap:12px;">
        <div style="background:#064e3b; padding:12px; border-radius:8px;">
          <h4 style="margin:0 0 6px 0; color:#34d399;">📗 Nhánh Khoa Học (Science - 18 thẻ)</h4>
          <p style="margin:0; font-size:0.88rem;">
            • <strong>Nhà giả kim (2):</strong> Chọn trước kết quả 2 xúc xắc sản xuất.<br>
            • <strong>Cần cẩu (2):</strong> Giảm 1 hàng hóa cho nâng cấp thành phố.<br>
            • <strong>Kỹ sư (1):</strong> Xây tường thành miễn phí.<br>
            • <strong>Nhà phát minh (2):</strong> Đổi 2 đĩa số trừ 2, 6, 8, 12.<br>
            • <strong>Thủy lợi (2):</strong> Nhận 2 Lúa cho mỗi ô Cánh đồng kề công trình.<br>
            • <strong>Y học (2):</strong> Nâng cấp thành phố chỉ với 1 Lúa + 2 Quặng.<br>
            • <strong>Khai khoáng (2):</strong> Nhận 2 Quặng cho mỗi ô Núi kề công trình.<br>
            • <strong>Máy in (1):</strong> +1 VP (ngửa mặt ngay lập tức).<br>
            • <strong>Xây đường (2):</strong> Đặt 2 đoạn đường/tàu miễn phí.<br>
            • <strong>Thợ rèn (2):</strong> Thăng cấp tối đa 2 hiệp sĩ miễn phí.
          </p>
        </div>

        <div style="background:#78350f; padding:12px; border-radius:8px;">
          <h4 style="margin:0 0 6px 0; color:#fbbf24;">📙 Nhánh Thương Mại (Trade - 18 thẻ)</h4>
          <p style="margin:0; font-size:0.88rem;">
            • <strong>Cảng thương mại (2):</strong> Đưa 1 tài nguyên, đối thủ đưa lại 1 hàng hóa.<br>
            • <strong>Đại thương gia (2):</strong> Xem bài người nhiều VP hơn và lấy 2 thẻ.<br>
            • <strong>Thương nhân (6):</strong> Lấy thương nhân (+1 VP, đổi 2:1 tài nguyên của ô đó).<br>
            • <strong>Đội tàu buôn (2):</strong> Đổi 2:1 tại ngân hàng với 1 loại thẻ suốt lượt.<br>
            • <strong>Độc quyền tài nguyên (4):</strong> Mỗi đối thủ phải nộp 2 tài nguyên chỉ định.<br>
            • <strong>Độc quyền hàng hóa (2):</strong> Mỗi đối thủ phải nộp 1 hàng hóa chỉ định.
          </p>
        </div>

        <div style="background:#1e3a8a; padding:12px; border-radius:8px;">
          <h4 style="margin:0 0 6px 0; color:#60a5fa;">📘 Nhánh Chính Trị (Politics - 18 thẻ)</h4>
          <p style="margin:0; font-size:0.88rem;">
            • <strong>Nhà ngoại giao (2):</strong> Gỡ 1 con đường hở của đối thủ.<br>
            • <strong>Gián điệp (3):</strong> Xem và cướp 1 thẻ tiến bộ của đối thủ.<br>
            • <strong>Thống soái (2):</strong> Kích hoạt miễn phí toàn bộ hiệp sĩ của bạn.<br>
            • <strong>Âm mưu (2):</strong> Đẩy lùi hiệp sĩ đối phương không cần dùng hiệp sĩ.<br>
            • <strong>Giám mục (2):</strong> Di chuyển Tên cướp và cướp bài từ tất cả người chơi kề bên.<br>
            • <strong>Hiến pháp (1):</strong> +1 VP (ngửa mặt ngay lập tức).<br>
            • <strong>Kẻ đào ngũ (2):</strong> Đối thủ tự chọn gỡ 1 hiệp sĩ, bạn đặt 1 hiệp sĩ tương ứng.<br>
            • <strong>Đám cưới (2):</strong> Mỗi người nhiều VP hơn phải tặng bạn 2 thẻ.<br>
            • <strong>Kẻ phá hoại (2):</strong> Người bằng hoặc nhiều VP hơn phải bỏ nửa số thẻ bài.
          </p>
        </div>
      </div>
    `;
  }
}
