# Hướng dẫn Vị trí Đặt Code trong Dự án

Tài liệu này hướng dẫn cách đặt mã nguồn (code) cho các tính năng mới trong dự án để đảm bảo tính nhất quán và dễ bảo trì cho các lập trình viên khác.


---

## Cấu trúc Thư mục `src/`

Thư mục `src` chứa toàn bộ mã nguồn của ứng dụng chính. Dưới đây là chi tiết chức năng của từng thư mục con:

```bash
src/
├── adapter/      # Bộ chuyển đổi để kết nối các package lõi (Core packages) với ứng dụng
│   ├── component/# Cấu hình chuyển đổi cho các component dùng chung (form, table...)
│   ├── form.ts   # Cấu hình bộ adapter cho Form
│   └── vxe-table.ts # Cấu hình bộ adapter cho Bảng vxe-table
├── api/          # Định nghĩa và quản lý các hàm gọi API tới Backend
│   ├── core/     # Các API hệ thống cốt lõi
│   ├── request.ts# Cấu hình tuỳ biến Axios / HTTP client
│   └── index.ts  # Cổng xuất bản dịch vụ API
├── layouts/      # Định nghĩa các Layout cục bộ cho ứng dụng (Auth, Basic...)
├── locales/      # Tài nguyên dịch thuật và cấu hình đa ngôn ngữ dành riêng cho ứng dụng
├── preferences.ts# Định nghĩa các cấu hình tuỳ chỉnh giao diện mặc định (theme, sidebar...)
├── router/       # Quản lý định tuyến và cấu hình Menu điều hướng
│   ├── routes/   # Các modules khai báo đường dẫn trang (route modules)
│   └── guard/    # Các bộ bảo vệ / chắn định tuyến (auth guards, permission guards)
├── store/        # Quản lý trạng thái Pinia toàn cục (Auth, Company...)
├── views/        # Chứa toàn bộ các trang giao diện hiển thị người dùng (Pages/Views)
├── app.vue       # Component gốc (Root Component) của ứng dụng Vue
├── bootstrap.ts  # Logic khởi tạo ứng dụng khi bắt đầu chạy (khởi tạo store, router...)
└── main.ts       # Điểm khởi chạy ứng dụng (Entry point) chính
```

---

## 1. Định tuyến & Menu (Routing & Sidebar)

Khi thêm các trang hoặc nhóm tính năng mới hiển thị trên thanh điều hướng sườn (Sidebar):
* **Vị trí đặt file**: `src/router/routes/modules/`
* **Cách thực hiện**: Tạo một tệp TypeScript cấu hình route mới (ví dụ: `company.ts`). Hệ thống Monorepo sẽ tự động quét và đăng ký định tuyến này.
* **Quy tắc**: Mỗi phân hệ lớn cần kế thừa giao diện từ `BasicLayout` (thông qua hệ thống quản lý quyền truy cập tự động).

---

## 2. Giao diện & Trang con (Views / Pages)

Các thành phần giao diện người dùng tương ứng với mỗi tuyến đường (route):
* **Vị trí đặt file**: `src/views/`
* **Cách thực hiện**: Tạo thư mục tương ứng với phân hệ (ví dụ: `src/views/company/info/` và `src/views/company/department/`) và viết tệp `index.vue` chính.
* **Quy tắc**: Ưu tiên sử dụng tối đa các thành phần từ thư viện **Ant Design Vue** thay vì xây dựng thủ công bằng HTML/Tailwind CSS cơ bản.

---

## 3. Quản lý trạng thái (Pinia State Management)

Khi các trang cần chia sẻ trạng thái dữ liệu với nhau (hoặc quản lý dữ liệu toàn cục):
* **Vị trí đặt file**: `src/store/`
* **Cách thực hiện**: Định nghĩa store Pinia mới (ví dụ: `src/store/company.ts`) và export các hook tương ứng.

---

## 4. Bản dịch & Đa ngôn ngữ (Locales/Internationalization)

Dự án bắt buộc phải hỗ trợ song ngữ hoàn chỉnh cho tất cả nội dung giao diện mới:

### A. Bản dịch riêng của Trang (App-Specific Locales)
Dùng cho nhãn, thông báo, cột của các trang con nghiệp vụ cụ thể.
* **Vị trí**: `src/locales/langs/`
  * Tiếng Việt: [src/locales/langs/zh-CN/page.json](file:///c:/Users/khanh/Projects/eamo/frontend/src/locales/langs/zh-CN/page.json)
  * Tiếng Anh: [src/locales/langs/en-US/page.json](file:///c:/Users/khanh/Projects/eamo/frontend/src/locales/langs/en-US/page.json)
* **Cách gọi**: Sử dụng `$t('page.company.colName')` trong tệp `.vue` của trang.

### B. Bản dịch hệ thống dùng chung (Core Locales)
Dùng cho các từ khóa chung (Xác thực, Cài đặt hệ thống, Lỗi mạng...).
* **Vị trí**: `packages/locales/src/langs/`
  * Tiếng Việt: [packages/locales/src/langs/zh-CN/](file:///c:/Users/khanh/Projects/eamo/frontend/packages/locales/src/langs/zh-CN/)
  * Tiếng Anh: [packages/locales/src/langs/en-US/](file:///c:/Users/khanh/Projects/eamo/frontend/packages/locales/src/langs/en-US/)

---

## 5. Hằng số & Kiểu dữ liệu (Constants & Core Configs)

* **Hằng số chung**: Đặt trong [core.ts](file:///c:/Users/khanh/Projects/eamo/frontend/packages/constants/src/core.ts).
* **Cấu hình quốc tế hóa thư viện**: Đặt trong [src/locales/index.ts](file:///c:/Users/khanh/Projects/eamo/frontend/src/locales/index.ts) để liên kết tiếng Việt cho các thư viện bên thứ ba (như `dayjs`, `Ant Design Vue`).
