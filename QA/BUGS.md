# 🐛 QA BUGS LOG

Danh sách lỗi phát hiện trong quá trình Autonomous QA theo thứ tự ưu tiên (P0, P1, P2, P3).

| Bug ID | Severity | Phase | Tóm tắt lỗi | Nguyên nhân gốc rễ (Root Cause) | Trạng thái | Commit / Regression Test |
|---|---|---|---|---|---|---|
| BUG-000 | - | - | Khởi tạo bảng theo dõi lỗi | - | CLOSED | - |
| BUG-001 | P0 | Phase C | Trình duyệt ném SyntaxError thiếu export `ImprovementTrack` từ `ck_constants.js` làm crash `main3d.js` | `shared/ck_constants.js` chỉ dùng `module.exports` trong khối CommonJS mà không có cú pháp `export { ... }` ES Module cho Browser module loader | CLOSED | `QA/e2e/phaseC_lobby.test.js` |
| BUG-002 | P0 | Phase E | Ván chơi C&K bị treo cứng ở Phase DISCARD khi đổ ra số 7 | `renderDiscardControls` trong `client/js/game/main3d.js` chỉ đếm `totalResources()` bỏ qua `commodities` và thiếu UI chọn hàng hóa, dẫn đến số thẻ bỏ bị sai và bị server từ chối | CLOSED | `QA/e2e/phaseE_gameplay.test.js` |
| BUG-003 | P0 | Phase F | F5 Reload trình duyệt giữa ván đấu khôi phục nhầm kịch bản gốc (Base game) thay vì Cities & Knights | `saveGameProgress` không lưu `scenario` trong `startPayload`, và `tryRestoreRoomGame` phục hồi từ cache trước khi fetch `/api/rooms` hoàn tất (`roomData` là null), dẫn đến khởi tạo `GameState` gốc thay vì `CKGameState` | CLOSED | `QA/e2e/phaseF_reconnect.test.js` |
| BUG-004 | P0 | Gameplay / AI | Khi đổ ra 7 có Bot cần bỏ bài, game bị kẹt cứng trong vòng lặp vô tận "Đang chờ [Bot] bỏ bớt thẻ bài" | `triggerBotIfNeeded()` chỉ tính `totalResources()` (bỏ qua hàng hóa `commodities`) và không có cơ chế bỏ hàng hóa cho Bot. Hành động bỏ bài gửi lên server bị thiếu số lượng và bị `CKGameState.discardResources` từ chối, dẫn đến gọi lại `performAction` liên tục không ngừng | CLOSED | `client/js/game/main3d.js` |
| BUG-005 | P1 | UI / UX | Giao diện phòng C&K không hiển thị hàng hóa, thuyền man rợ, xúc xắc sự kiện hay các nút chức năng Đô thị, Hiệp sĩ, Tường thành | Logic engine C&K đã hoàn thiện nhưng HTML trong `client/game.html` và HUD trong `client/js/game/main3d.js` chỉ có thành phần của bản gốc; thiếu 3 thẻ hàng hóa (`PAPER`, `CLOTH`, `COIN`), tracker thuyền man rợ, xúc xắc sự kiện, các modal Đô Thị, Hiệp Sĩ, Thẻ Tiến Bộ và 3D pieces đồng bộ | CLOSED | `QA/e2e/phaseJ_ck_ui_integration.test.js` |
| BUG-006 | P2 | Cluster 2.2 | Thiếu chức năng xóa bạn bè trong danh sách bạn bè và thiếu phát socket `friend:update` khi hủy kết bạn | `client/js/lobby.js` không render nút hủy bạn bè và `server/routes/friends.js` không emit event `friend:update` qua WebSocket cho cả 2 người khi xóa bạn | CLOSED | `QA/e2e/cluster2_friends_rooms.test.js` |
| BUG-007 | P2 | Cluster 2.3 | Thiếu xử lý sự kiện socket thay đổi cài đặt phòng (`room:update_settings`) và chuyển quyền chủ phòng (`room:transfer_host`) | `server/socket/lobbySocket.js` thiếu listener xử lý 2 sự kiện cập nhật cấu hình phòng và chuyển host theo thời gian thực | CLOSED | `QA/e2e/cluster3_lobby.test.js` |
| BUG-008 | P2 | Cluster 2.7 | Thoát phòng sau khi kết thúc trận có hộp thoại confirm trình duyệt chặn luồng điều hướng nếu không xử lý | `client/js/game/main3d.js` yêu cầu xác nhận `confirm(...)` khi bấm nút rời phòng về sảnh, cần được xử lý tự động trong luồng người dùng | CLOSED | `QA/e2e/cluster7_endgame_rematch.test.js` |



