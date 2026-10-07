# 🪝 QA TEST HOOKS

Tất cả các test hook và API hỗ trợ kiểm thử tự động:

- Mọi test hook chỉ hoạt động khi biến môi trường `ENABLE_TEST_HOOKS=1` được bật.
- Trong môi trường sản xuất (`ENABLE_TEST_HOOKS` không được set hoặc bằng 0), các endpoint / hook này hoàn toàn bị vô hiệu hóa hoặc không tồn tại.

## Danh sách Hooks:
1. `POST /api/test/reset-db`: Xóa trắng dữ liệu test và nạp lại trạng thái mặc định.
2. `POST /api/test/set-state`: Can thiệp nhanh trạng thái ván đấu (gán tài nguyên, đặt xúc xắc, vị trí man rợ, v.v.).
