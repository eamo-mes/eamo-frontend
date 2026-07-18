# EAMO Frontend System Integration Report

This repository contains the frontend application for the EAMO (Equipment Asset Management Solution) project. The application is built using Vue 3, Vite, TypeScript, and the Ant Design Vue components library.

---

## 1. System Requirements

Before setting up the project, ensure that the host machine satisfies the following prerequisites:
- Node.js: Version 18.0.0 or higher
- Pnpm: Version 9.0.0 or higher (required for resolving dependencies within the pnpm workspaces)

---

## 2. Installation and Deployment Procedure

### 2.1. Clone the Repository
Retrieve the source files from the remote server:
```bash
git clone https://github.com/eamo-mes/eamo-frontend.git
cd eamo-frontend
```

### 2.2. Environment Configuration
The project uses Vite's layered environment file system. Files are loaded in the following order of priority (higher overrides lower):

| File | Committed | Purpose |
|---|---|---|
| `.env` | ❌ No (gitignored) | Local secrets — copy from `.env.example` |
| `.env.example` | ✅ Yes | Template with placeholder values |
| `.env.development` | ✅ Yes | Dev-specific overrides (ports, mock flags) |
| `.env.production` | ✅ Yes | Production-specific overrides |

**Setup steps:**
1. Copy the example file to create your local env:
```bash
cp .env.example .env
```
2. Open `.env` and fill in the required values:
```env
# Tiêu đề ứng dụng
VITE_APP_TITLE=EAMO

# Namespace ứng dụng
VITE_APP_NAMESPACE=eamo-web-antd

# Khóa bảo mật mã hóa localStorage store
VITE_APP_STORE_SECURE_KEY=please-replace-me-with-your-own-key

# OAuth Public Client ID — lấy từ bảng oauth_clients trên backend
VITE_AUTH_CLIENT_ID=019f3598-1773-73aa-b922-377675fd2b7f
```

> **Note:** All variables exposed to the browser **must** be prefixed with `VITE_`. Variables without this prefix are only available on the build server and will be `undefined` at runtime.

The following optional variables can override defaults defined in `pkce.ts`:
```env
VITE_AUTH_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_AUTH_AUTHORIZE_URL=http://localhost:8000/oauth/authorize
VITE_AUTH_TOKEN_URL=http://localhost:8000/oauth/token
```

### 2.3. Dependency Installation & Build Internal Packages

This project is a **pnpm monorepo**. It contains several internal packages (e.g. `@vben/vite-config`, `@vben/node-utils`) whose compiled output (`dist/`) is **not committed to Git**. You must build them locally before the dev server can start.

**Option A (Recommended) — One-liner setup:**
```bash
pnpm setup
```
This command installs all dependencies **and** compiles all internal packages in one step.

**Option B — Manual steps:**
```bash
# Step 1: Install all dependencies
pnpm install

# Step 2: Build all internal workspace packages
pnpm stub
```

> **Why is this needed?** The dev server's `vite.config.ts` imports from `@vben/vite-config`, which is an internal workspace package. If this package has not been compiled yet, Vite cannot resolve it and will throw:
> `Failed to resolve entry for package "@vben/vite-config"`

### 2.4. Execution of the Development Server
Initiate the local development environment server:
```bash
pnpm dev
```
Upon successful compilation, the application will be accessible at: [http://localhost:5173](http://localhost:5173)

### 2.5. Production Compilation
To compile and optimize the application assets for production deployments:
```bash
pnpm build
```

---

## 3. Authentication and Integration Flow (OAuth 2.0 PKCE)

The application utilizes OAuth 2.0 Authorization Code Flow with Proof Key for Code Exchange (PKCE) coupled with Laravel Passport at the backend to secure token distribution for the Single Page Application:

1. When a user requests access to a protected route without a valid `accessToken`, the frontend Router Guard intercepts the request and redirects the browser to the backend authorization URL:
   `http://localhost:8000/oauth/authorize?...`
2. The backend verifies the session status. If unauthenticated, the user is redirected to the Laravel login page (`http://localhost:8000/login`).
3. Upon successful credential validation, the authorization server redirects back to the frontend callback URL with an authorization code parameter:
   `http://localhost:5173/auth/callback?code=...`
4. The callback handler page (`callback.vue`) extracts the code, requests tokens via the `/oauth/token` endpoint, persists the returned `accessToken` and `refreshToken` securely in the application store, and forwards the user to the dashboard landing page.

---

## 4. Development Command Directory

The following scripts are defined in the workspace:
- `pnpm setup`: **First-time setup** — installs all dependencies and compiles all internal workspace packages. Run this once after cloning.
- `pnpm stub`: Compiles all internal workspace packages (e.g. `@vben/vite-config`). Re-run this if internal packages are updated.
- `pnpm dev`: Boots the local hot-reloading development server.
- `pnpm build`: Packages and optimizes the source code into production assets.
- `pnpm preview`: Launches a local web server to preview production builds.
- `pnpm typecheck`: Evaluates the project files for TypeScript compilation errors.
