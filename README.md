# 🚀 Catan Seafarers 3D — Hướng Dẫn Cài Đặt

## Yêu cầu

- **Node.js v20+** — [Tải tại nodejs.org](https://nodejs.org) *(bắt buộc)*
- Trình duyệt Chrome / Edge / Firefox mới nhất
- Kết nối mạng (để load Three.js từ CDN)

---

## Cài đặt & Chạy

### Cách nhanh nhất (sau khi cài Node.js):
```
Double-click: start-server.bat
```

### Cách thủ công:
```bash
cd server
npm install
node server.js
```

Sau đó mở trình duyệt: **http://localhost:3000**

---

## Tính năng

### 👤 Tài khoản
- Đăng ký / Đăng nhập với username + password
- Lưu thống kê: ELO, thắng/thua, số game đã chơi
- Avatar emoji tuỳ chọn

### 🏠 Lobby
- Tạo phòng (tên, số người, công khai/riêng tư)
- Tham gia phòng bằng mã 6 ký tự
- Danh sách phòng đang mở
- Chat lobby

### 👫 Kết bạn
- Tìm kiếm người chơi khác
- Gửi / chấp nhận / từ chối lời mời kết bạn
- Xem bạn bè đang online

### 🎮 Game 3D (Three.js)
- Bàn cờ hex 3D với lighting đẹp
- Fog of war cho đảo chưa khám phá
- Animations: tung xúc xắc, đặt công trình, khám phá đảo
- Camera: zoom, xoay, pan

### 📜 Luật chơi (đúng nguyên tắc Catan: Seafarers)
- Setup 2 vòng (thuận + ngược)
- Xúc xắc, phân phối tài nguyên
- Gold Field (chọn tài nguyên tuỳ ý)
- Tàu + di chuyển tàu (1/lượt, open-end)
- Robber (đất) + Pirate (biển)
- Thẻ phát triển: Knight, Monopoly, Year of Plenty, Road Building
- Tuyến đường dài nhất (đường + tàu qua DFS)
- Quân đội lớn nhất (≥ 3 Knight)
- Khám phá đảo mới → +1 VP
- Thương lượng với ngân hàng (4:1 / 3:1 / 2:1 theo cảng)
- Điều kiện thắng: 13 VP (Voyages of Discovery)

---

## Cấu trúc dự án

```
Game/
├── start-server.bat     ← Chạy game (double-click)
├── server/              ← Node.js backend
│   ├── server.js        ← Express + Socket.io
│   ├── package.json
│   ├── db/schema.js     ← SQLite database
│   ├── routes/          ← REST API
│   └── socket/          ← Real-time handlers
├── client/              ← Frontend
│   ├── index.html       ← Trang đăng nhập
│   ├── lobby.html       ← Lobby + bạn bè
│   ├── game.html        ← Game 3D
│   └── js/game/         ← Three.js game code
└── shared/              ← Constants dùng chung
```

---

## Tech Stack

| | |
|---|---|
| Backend | Node.js + Express + Socket.io |
| Database | SQLite (better-sqlite3) — không cần cài thêm |
| Auth | JWT + bcrypt |
| 3D Graphics | Three.js v0.160 (CDN) |
| Frontend | HTML/CSS/JS thuần |
