# Token Security Plan: In-Memory accessToken + Encrypted refreshToken

## Tổng quan

Tài liệu này mô tả kiến trúc bảo vệ JWT token được áp dụng trong dự án EAMO, nhằm giảm thiểu nguy cơ bị đánh cắp token thông qua tấn công XSS.

| Token | Trước | Sau |
|---|---|---|
| `accessToken` | Plain-text `localStorage` (dev) | **In-memory only** — không bao giờ được ghi xuống storage |
| `refreshToken` | Plain-text `localStorage` (dev) | **AES-256 encrypted `localStorage`** — mọi môi trường |
| `accessToken TTL` | 1 ngày | **15 phút** |
| `refreshToken TTL` | 30 ngày | **30 ngày** (giữ nguyên) |

---

## Lý do

### Vấn đề trước đây

Ở môi trường **development**, cả hai token được lưu plain-text trong `localStorage`:

```
localStorage["eamo-web-antd-core-access"] = '{"accessToken":"eyJhbG...","refreshToken":"..."}'
```

Bất kỳ đoạn script XSS nào cũng có thể đọc token ngay lập tức:

```js
// Kẻ tấn công chỉ cần một dòng này:
localStorage.getItem("eamo-web-antd-core-access")
```

### Tại sao In-Memory cho accessToken?

- `accessToken` TTL ngắn (15 phút) → không có giá trị khi persist
- Sống trong RAM của tab → XSS không thể lấy qua localStorage/sessionStorage
- Khi người dùng F5 hoặc mở tab mới → `refreshToken` encrypted tự động lấy `accessToken` mới (silent refresh)

### Tại sao Encrypted localStorage cho refreshToken?

- `refreshToken` TTL 30 ngày → cần persist để tránh login lại mỗi lần reload
- Mã hóa AES-256 bằng `secure-ls` với key từ env `VITE_APP_STORE_SECURE_KEY`
- Kể cả XSS đọc được chuỗi encrypted từ localStorage, vẫn không giải mã được nếu không có secret key (nằm trong bundle, không trong DOM)

---

## Kiến trúc luồng token

### Luồng đăng nhập (PKCE Callback)

```
GET /oauth/authorize → redirect backend login
POST /oauth/token    → { access_token, refresh_token, expires_in }
         │
         ├─ accessToken ──────────────→ Pinia store (RAM only, không persist)
         └─ refreshToken ─────────────→ Pinia store → AES encrypted localStorage
```

### Luồng request API bình thường

```
Vue component / composable
   └── Axios interceptor (request.ts)
         └── đọc accessStore.accessToken (từ RAM)
               └── Header: Authorization: Bearer <accessToken>
```

### Luồng F5 / reload / tab mới (Silent Refresh)

```
guard.ts beforeEach()
   └── accessStore.accessToken === null  (bị mất vì in-memory)
         └── accessStore.refreshToken !== null  (còn trong encrypted localStorage)
               └── pkce.refreshAccessToken()
                     └── POST /oauth/token { grant_type: refresh_token, refresh_token }
                           ├── Thành công → accessToken mới → lưu vào RAM
                           │                refreshToken mới → lưu vào encrypted localStorage
                           └── Thất bại   → clear refreshToken → redirect PKCE login
```

### Luồng đăng xuất

```
logout()
   └── revokeTokenBackend(accessToken)   ← thu hồi token trên server
         └── resetAllStores()            ← xóa toàn bộ state (RAM + encrypted localStorage)
               └── redirect /oauth/logout (invalidate session backend)
```

---

## Các thay đổi đã thực hiện

### Backend: `app/Providers/AppServiceProvider.php`

```diff
- Passport::tokensExpireIn(now()->addDays(1));
+ Passport::tokensExpireIn(now()->addMinutes(15));
  Passport::refreshTokensExpireIn(now()->addDays(30));
```

**Lý do:** accessToken 1 ngày quá dài — nếu bị lấy (dù in-memory) thì kẻ tấn công có tới 24 giờ để dùng. 15 phút là chuẩn industry (OAuth 2.0 RFC 6749).

---

### Frontend: `packages/stores/src/setup.ts`

```diff
- storage: import.meta.env.DEV
-   ? localStorage          // plain-text ở dev!
-   : {
-       getItem(key) { return ls.get(key); },
-       setItem(key, value) { ls.set(key, value); },
-     },
+ storage: {
+   getItem(key) { return ls.get(key); },   // AES encrypted mọi môi trường
+   setItem(key, value) { ls.set(key, value); },
+ },
```

---

### Frontend: `packages/stores/src/modules/access.ts`

```diff
  persist: {
    pick: [
-     'accessToken',   // accessToken không được persist nữa
      'refreshToken',
      'accessCodes',
      'isLockScreen',
      'lockScreenPassword',
    ],
  },
```

---

### Frontend: `src/api/core/pkce.ts`

Bổ sung:
1. `handleCallback` trả về `{ accessToken, refreshToken }` thay vì chỉ `string`
2. Hàm mới `refreshAccessToken(refreshToken)` dùng `grant_type=refresh_token`

---

### Frontend: `src/views/_core/authentication/callback.vue`

```diff
- const token = await handleCallback(code);
- accessStore.setAccessToken(token);
+ const { accessToken, refreshToken } = await handleCallback(code);
+ accessStore.setAccessToken(accessToken);
+ if (refreshToken) {
+   accessStore.setRefreshToken(refreshToken);
+ }
```

---

### Frontend: `src/router/guard.ts`

Bổ sung silent refresh trước khi redirect PKCE:

```diff
  if (!accessStore.accessToken) {
+   if (accessStore.refreshToken) {
+     try {
+       const { refreshAccessToken } = await import('#/api/core/pkce');
+       const { accessToken, refreshToken } = await refreshAccessToken(accessStore.refreshToken);
+       accessStore.setAccessToken(accessToken);
+       if (refreshToken) accessStore.setRefreshToken(refreshToken);
+       return true;
+     } catch {
+       accessStore.setRefreshToken(null);
+     }
+   }
    await redirectToLogin(destination);
    return false;
  }
```

---

## Cấu hình bắt buộc

### `.env.local`

```env
# Thay bằng chuỗi ngẫu nhiên mạnh (32+ ký tự), không commit lên git
VITE_APP_STORE_SECURE_KEY=your-strong-random-secret-key-here
```

> ⚠️ Nếu dùng key mặc định `please-replace-me-with-your-own-key`, encryption vẫn hoạt động nhưng key bị lộ vì nằm trong repo. Hãy thay bằng key riêng của từng môi trường.

---

## Kiểm tra sau khi deploy

| Kiểm tra | Kỳ vọng |
|---|---|
| DevTools → Application → Local Storage | Giá trị là chuỗi AES encoded, không đọc được bằng mắt |
| `accessToken` xuất hiện trong localStorage | ❌ Không bao giờ |
| F5 → có bị logout không? | ❌ Không — silent refresh tự động |
| Đóng tab, mở tab mới | ✅ Session được restore qua refresh flow |
| Token hết hạn 15 phút | ✅ Tự refresh trong nền qua request interceptor |
| Logout → localStorage | ✅ Bị xóa sạch |

---

## Giới hạn & Bảo mật nâng cao trong tương lai

| Giải pháp | Mô tả | Độ phức tạp |
|---|---|---|
| HttpOnly Cookie cho refreshToken | Server set cookie, JS không đọc được → XSS proof hoàn toàn | Cao — cần backend thay đổi |
| Token Binding | Gắn token với browser fingerprint | Rất cao |
| Short-lived refresh token rotation | Mỗi lần refresh sẽ có refreshToken mới, cái cũ bị thu hồi | Trung bình — backend hỗ trợ |

Hiện tại **Passport đã cấu hình refresh token rotation** (`refreshTokensExpireIn`), nhưng chưa bật one-time use. Có thể bật bằng `Passport::revokeOtherTokens()` nếu cần.
