# EAMO - Equipment Asset Management Solution (Frontend)

Đây là kho lưu trữ mã nguồn Frontend cho dự án **EAMO (Equipment Asset Management Solution)**, được xây dựng dựa trên template Vue 3, Vite, TypeScript và Ant Design Vue.

---

## ⚡️ Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:
- **Node.js**: Phiên bản `>= 18.0.0`
- **Pnpm**: Phiên bản `>= 9.0.0` (Khuyên dùng để cài đặt các package cho cấu trúc monorepo)

---

## 🚀 Hướng dẫn cài đặt và chạy ứng dụng

### 1. Tải mã nguồn về máy
```bash
git clone https://github.com/eamo-mes/eamo-frontend.git
cd eamo-frontend
```

### 2. Cài đặt các Dependencies
Vì dự án sử dụng cấu trúc Monorepo (pnpm workspaces), bạn cần dùng `pnpm` để cài đặt:
```bash
pnpm install
```

### 3. Cấu hình Môi trường (Environment Variables)
Sao chép cấu hình môi trường phát triển (nếu chưa có) và cập nhật đường dẫn API trỏ đến Backend:
- Mở tệp `.env.development`
- Kiểm tra/Cập nhật biến `VITE_GLOB_API_URL` trỏ tới cổng Backend Laravel đang chạy (mặc định là `http://localhost:8000/api`):
```env
# Địa chỉ API cổng Backend Laravel
VITE_GLOB_API_URL=http://localhost:8000/api
```

### 4. Khởi động máy chủ phát triển (Development Server)
Chạy lệnh sau để khởi động dự án ở môi trường local:
```bash
pnpm run dev
```
Sau khi chạy thành công, mở trình duyệt truy cập: [http://localhost:5173](http://localhost:5173)

### 5. Build Production
Khi cần đóng gói ứng dụng để deploy:
```bash
pnpm run build
```

---

## 🔐 Cơ chế Đăng nhập & Xác thực (OAuth 2.0 PKCE)

Hệ thống sử dụng cơ chế xác thực bảo mật **OAuth 2.0 Authorization Code Flow với PKCE** kết hợp với Laravel Passport ở Backend để tối ưu bảo mật cho ứng dụng Single Page (SPA):

1. Khi người dùng truy cập trang chủ hoặc bất kỳ trang nào yêu cầu phân quyền mà chưa có `accessToken`, Router Guard của Frontend sẽ tự động chuyển hướng trình duyệt tới endpoint của Backend Laravel:
   `http://localhost:8000/oauth/authorize?...`
2. Backend kiểm tra phiên đăng nhập (Session). Nếu chưa đăng nhập, người dùng sẽ được chuyển tới giao diện đăng nhập của Laravel (`http://localhost:8000/login`).
3. Sau khi nhập thông tin và đăng nhập thành công ở Backend, Laravel Passport sẽ tự động cấp một mã xác thực (Authorization Code) và chuyển hướng trình duyệt quay lại trang callback của Frontend:
   `http://localhost:5173/auth/callback?code=...`
4. Trang Callback của Frontend (`callback.vue`) sẽ nhận mã code, gọi API `/oauth/token` đổi lấy `accessToken` và `refreshToken`, lưu trữ an toàn trong store và điều hướng người dùng thẳng vào trang Dashboard.

---

## 📂 Các tập lệnh hữu ích

- `pnpm run dev`: Chạy dự án ở local.
- `pnpm run build`: Đóng gói ứng dụng cho production.
- `pnpm run preview`: Xem trước bản build production ở local.
- `pnpm run typecheck`: Kiểm tra lỗi kiểu dữ liệu TypeScript.
