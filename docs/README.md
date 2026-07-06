# Tài liệu Phát triển EAMO Frontend

Chào mừng đến với thư mục tài liệu của dự án **EAMO Frontend**. Thư mục này chứa các tài liệu hướng dẫn thiết kế hệ thống, cấu trúc mã nguồn và quy trình làm việc dành cho lập trình viên.

---

## 📂 Danh mục Tài liệu (`docs/dev/`)

Dưới đây là các tài liệu hướng dẫn chi tiết dành cho nhà phát triển:

1. 📂 **[Hướng dẫn Cấu trúc Thư mục và Vị trí Đặt Code](./dev/code-placement.md)**
   * Giải thích chi tiết cấu trúc của thư mục `src/` (`layouts`, `router`, `store`, `views`, `adapter`, `api`...).
   * Quy định vị trí đặt mã nguồn khi lập trình thêm tính năng mới (routes, views, pinia store, locales, constants).

2. 🔑 **[Quản lý Token và Phân quyền Tài khoản](./dev/token_storage_and_role.md)**
   * Hướng dẫn cơ chế lưu trữ Token bảo mật ở Client.
   * Cách thiết lập phân quyền truy cập, hiển thị menu động dựa trên vai trò (roles) của tài khoản người dùng.

---

## 🛠️ Cấu trúc Thư mục Tài liệu (`docs/`)

Thư mục tài liệu của dự án được tổ chức như sau:

* **`.vitepress/`**: Chứa toàn bộ cấu hình, cài đặt giao diện (theme) và các plugin của VitePress (công cụ xây dựng trang web tài liệu tĩnh).
* **`dev/`**: Nơi lưu trữ trực tiếp các tệp tài liệu phát triển nghiệp vụ chính bằng tiếng Việt dành cho lập trình viên (đọc trực tiếp trên GitHub hoặc local IDE).
* **`src/`**: Chứa nội dung trang nguồn (các file `.md` gốc) dùng để biên dịch thành trang web tài liệu chính thức.
* **`README.md`**: Tệp tin này, đóng vai trò là bản đồ chỉ đường và giải thích cấu trúc tài liệu.
