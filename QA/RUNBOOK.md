# 📖 QA RUNBOOK

## Kiến trúc hệ thống
- **Server:** Node.js + Express + Socket.IO (`server/server.js`), lắng nghe cổng 3000.
- **Database:** JSON database `server/db/data.json` qua `schema.js`.
- **Client:** HTML/CSS/JS (Vanilla + Three.js) phục vụ tĩnh từ thư mục `client/`.

## Lệnh khởi động server
```bash
# Cài đặt dependencies (nếu chưa cài)
npm install
cd server && npm install && cd ..

# Khởi động server
node server/server.js
# Hoặc với dev reload
cd server && npm run dev
```

## Chạy bộ kiểm thử tự động (QA Test Suite)
```bash
# Kiểm thử toàn diện tất cả các giai đoạn
npm run qa:full

# Hoặc chạy trực tiếp qua Playwright:
npx playwright test QA/e2e/
```
