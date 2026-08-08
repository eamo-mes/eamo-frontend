# Tài liệu Hướng dẫn Lưu trữ Token và Cấu hình Vai trò (Role) trong JWT

Tài liệu này mô tả chi tiết vị trí lưu trữ Access Token ở phía Client (Frontend) và cách cấu hình để JWT Access Token do Backend cấp có chứa thông tin vai trò (Role), cũng như cách Frontend trích xuất thông tin này để phân quyền.

---

## 1. Vị trí lưu trữ Access Token ở Frontend

### 1.1. Nơi lưu trữ thực tế
Access Token và Refresh Token được lưu trữ trong **`localStorage`** của trình duyệt web dưới một khóa (key) trạng thái của Pinia Store.

### 1.2. Vị trí mã nguồn quản lý việc lưu trữ
- **Định nghĩa Store**: Tệp [access.ts](file:///C:/Users/khanh/Projects/eamo/frontend/packages/stores/src/modules/access.ts) chứa định nghĩa store `useAccessStore`.
- **Cơ chế tự động lưu (Persistence)**: Store sử dụng thuộc tính `persist` để tự động đồng bộ trạng thái xuống `localStorage`:
  ```typescript
  persist: {
    pick: [
      'accessToken',
      'refreshToken',
      'accessCodes',
      'isLockScreen',
      'lockScreenPassword',
    ],
  }
  ```

### 1.3. Cơ chế mã hóa bảo mật
Để tăng cường bảo mật, toàn bộ dữ liệu lưu xuống `localStorage` sẽ được mã hóa bằng khóa bảo mật được cấu hình tại tệp [`.env`](file:///C:/Users/khanh/Projects/eamo/frontend/.env#L8) của frontend:
```env
VITE_APP_STORE_SECURE_KEY=please-replace-me-with-your-own-key
```

---

## 2. Cách cấu hình đưa Role vào JWT Access Token (Backend Laravel)

Mặc định, Laravel Passport tạo ra Access Token dưới dạng JWT nhưng không đính kèm thông tin Role của user. Để đính kèm, chúng ta tùy chỉnh lớp khởi tạo JWT của Passport.

### 2.1. Tùy chỉnh AccessToken Entity
Tạo tệp [AccessToken.php](file:///C:/Users/khanh/Projects/eamo/backend/app/Bridge/AccessToken.php) để ghi đè phương thức `convertToJWT()`. Lớp này sẽ tìm thông tin User từ ID và đưa thuộc tính `role` vào JWT dưới dạng claim `roles` (mảng):
```php
$builder = $builder->withClaim('roles', [$user->role]);
```

### 2.2. Tùy chỉnh AccessTokenRepository
Tạo tệp [AccessTokenRepository.php](file:///C:/Users/khanh/Projects/eamo/backend/app/Bridge/AccessTokenRepository.php) để trả về lớp `AccessToken` tùy chỉnh trên khi tạo mới token:
```php
public function getNewToken(ClientEntityInterface $clientEntity, array $scopes, $userIdentifier = null)
{
    return new AccessToken($userIdentifier, $scopes, $clientEntity);
}
```

### 2.3. Đăng ký trong Service Provider
Ghi đè liên kết `AccessTokenRepositoryInterface` mặc định bằng Repository tùy chỉnh của chúng ta trong [AppServiceProvider.php](file:///C:/Users/khanh/Projects/eamo/backend/app/Providers/AppServiceProvider.php#L35):
```php
$this->app->singleton(
    \League\OAuth2\Server\Repositories\AccessTokenRepositoryInterface::class,
    function ($app) {
        return new \App\Bridge\AccessTokenRepository(
            $app->make(\Laravel\Passport\TokenRepository::class),
            $app->make(\Illuminate\Contracts\Events\Dispatcher::class)
        );
    }
);
```

---

## 3. Cách Frontend nhận diện Role từ JWT Access Token

### 3.1. Viết hàm giải mã JWT (JWT Decoder)
Trong tệp quản lý store xác thực [auth.ts](file:///C:/Users/khanh/Projects/eamo/frontend/src/store/auth.ts#L97), chúng ta thêm hàm `getRolesFromToken` để giải mã phần Payload của JWT mà không cần thư viện ngoài (sử dụng `atob` và xử lý ký tự đặc biệt UTF-8):
```typescript
function getRolesFromToken(token: string): string[] {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return [];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const payload = JSON.parse(jsonPayload);
    return payload.roles || (payload.role ? [payload.role] : []);
  } catch (e) {
    console.error('Failed to parse roles from JWT:', e);
    return [];
  }
}
```

### 3.2. Đồng bộ hóa vai trò vào User Store
Trong hàm `fetchUserInfo()` của tệp [auth.ts](file:///C:/Users/khanh/Projects/eamo/frontend/src/store/auth.ts), sau khi lấy thông tin người dùng từ API `/user`, chúng ta giải mã token hiện tại để trích xuất `roles` và gán vào `userInfo.roles`:
```typescript
async function fetchUserInfo() {
  const userInfo = await getUserInfoApi();
  const token = accessStore.accessToken;
  if (token) {
    const roles = getRolesFromToken(token);
    userInfo.roles = roles; // Gán roles lấy từ JWT vào thông tin người dùng
    console.log('Detected roles from JWT:', roles);
  }
  userStore.setUserInfo(userInfo);
  return userInfo;
}
```

Từ đây, Router Guard của Frontend (`guard.ts`) sẽ đọc `userInfo.roles` đã được gán để tạo lập bảng phân quyền truy cập menu tương ứng.

---

## 4. Cơ chế Tự động Hẹn giờ Refresh Token (Proactive & Silent Token Refresh)

Để đảm bảo người dùng không bao giờ gặp lỗi `HTTP 401 Unauthorized` hay gián đoạn khi đang sử dụng hệ thống, ứng dụng triển khai cơ chế làm mới Token thầm lặng tự động (Proactive Background Refresh).

### 4.1. Hẹn giờ chủ động (Timer Scheduler)
- **Vị trí cấu hình**: Tệp [pkce.ts](file:///C:/Users/khanh/Projects/eamo/frontend/src/api/core/pkce.ts) với hàm `scheduleProactiveTokenRefresh(expiresInSeconds)`.
- **Cơ chế hoạt động**:
  - Khi đăng nhập thành công (`handleCallback`) hoặc sau mỗi lần refresh thầm lặng (`refreshAccessToken`), hệ thống trích xuất `expires_in` từ phản hồi của Backend OAuth 2.0.
  - Tính toán khoảng thời gian an toàn: Hẹn giờ refresh trước khi Token hết hạn **5 phút (300 giây)** hoặc 20% thời lượng Token.
  - Sử dụng `setTimeout` chạy ngầm để chủ động xin `accessToken` mới và cập nhật lại vào `accessStore`.

### 4.2. Khôi phục Token khi quay lại Tab (`visibilitychange` Listener)
- **Cơ chế hoạt động**:
  - Khi trình duyệt bị ẩn (Inactive/Sleep) hoặc người dùng chuyển tab lâu, các bộ đếm `setTimeout` có thể bị trình duyệt trì hoãn.
  - Hàm lắng nghe sự kiện `document.addEventListener('visibilitychange')` kiểm tra ngay khi tab hiển thị lại (`document.visibilityState === 'visible'`).
  - Nếu thời gian đã trôi qua vượt mốc an toàn, hệ thống tự động làm mới Token ngay lập tức trước khi người dùng thực hiện bất kỳ thao tác nào.

### 4.3. Quản lý vòng đời Timer (Cleanup Lifecycle)
- Khi người dùng đăng xuất (`logout()`), hàm `clearProactiveRefreshTimer()` được gọi để hủy bỏ toàn bộ bộ đếm timer đang chạy ngầm, tránh rò rỉ bộ nhớ (Memory Leak).
