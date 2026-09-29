# 🌐 Hướng Dẫn Deploy Catan Seafarers 3D Lên Host

Để chơi cùng bạn bè qua mạng Internet, bạn có **2 cách phổ biến và dễ nhất**:

---

## ⚡ CÁCH 1: Chơi Ngay Lập Tức (Không cần thuê Host, 1 click là có link)

Nếu bạn chỉ muốn mở game để bạn bè vào chơi cùng ngay lúc rảnh mà không muốn đăng ký tài khoản hosting hay thẻ ngân hàng:

1. Double-click vào file **`share-online.bat`** trong thư mục game.
2. Cửa sổ dòng lệnh sẽ tự động khởi động server và sinh ra một đường link công khai dạng:
   ```
   your url is: https://funny-otter-42.loca.lt
   ```
3. Copy link đó gửi cho bạn bè qua Messenger/Zalo/Discord.
4. Cả bạn và bạn bè đều mở link đó trên trình duyệt (máy tính hoặc điện thoại) là có thể tạo phòng và chơi cùng nhau ngay!

*(Lưu ý: Bạn bè có thể cần bấm nút "Click to Continue" trong lần đầu tiên mở link localtunnel).*

---

## ☁️ CÁCH 2: Deploy Lên Cloud 24/7 Miễn Phí (Khuyên dùng: Render.com)

Game sẽ chạy trên máy chủ đám mây vĩnh viễn, bạn bè có thể vào chơi bất kỳ lúc nào kể cả khi bạn đã tắt máy tính.

### Bước 1: Đưa code lên GitHub
1. Mở PowerShell hoặc Git Bash tại thư mục dự án và chạy các lệnh:
   ```bash
   git init
   git add .
   git commit -m "Deploy Catan Seafarers 3D"
   ```
2. Lên [github.com](https://github.com), tạo một repository mới (ví dụ: `catan-seafarers`).
3. Đẩy code lên GitHub:
   ```bash
   git remote add origin https://github.com/TÊN_GITHUB_CỦA_BẠN/catan-seafarers.git
   git branch -M main
   git push -u origin main
   ```

### Bước 2: Tạo Web Service trên Render.com (Hoàn toàn miễn phí)
1. Đăng ký/Đăng nhập tại [render.com](https://render.com) (chọn Login with GitHub).
2. Bấm nút **New +** ở góc trên bên phải → chọn **Web Service**.
3. Chọn repository `catan-seafarers` của bạn.
4. Điền cấu hình như sau:
   - **Name**: `catan-seafarers` (hoặc tên tuỳ thích)
   - **Region**: Singapore (hoặc Oregon/Frankfurt)
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Bấm **Create Web Service**.

Render sẽ tự động tải thư viện và build game trong khoảng 1-2 phút. Khi xong, bạn sẽ nhận được một đường link miễn phí dạng:
👉 **`https://catan-seafarers.onrender.com`**

Bạn chỉ cần gửi link này cho bạn bè là chơi thoải mái!

---

## 🐳 CÁCH 3: Deploy Bằng Docker (Nếu có VPS hoặc dùng Railway/Fly.io)

Dự án đã có sẵn file [`Dockerfile`](file:///Dockerfile). Bạn có thể build và chạy ngay:

```bash
docker build -t catan-seafarers .
docker run -p 3000:3000 -d catan-seafarers
```
