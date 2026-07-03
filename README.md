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

### 2.2. Dependency Installation
Since the project utilizes a monorepo workspace architecture, install all necessary dependencies using the pnpm package manager:
```bash
pnpm install
```

### 2.3. Environment Configuration
Verify and update the environment settings for development:
- Open the `.env.development` file located in the root directory.
- Ensure that the `VITE_GLOB_API_URL` variable correctly references the local Laravel backend API endpoint (default path: `http://localhost:8000/api`):
```env
VITE_GLOB_API_URL=http://localhost:8000/api
```

### 2.4. Execution of the Development Server
Initiate the local development environment server:
```bash
pnpm run dev
```
Upon successful compilation, the application will be accessible at: [http://localhost:5173](http://localhost:5173)

### 2.5. Production Compilation
To compile and optimize the application assets for production deployments:
```bash
pnpm run build
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
- `pnpm run dev`: Boots the local hot-reloading development server.
- `pnpm run build`: Packages and optimizes the source code into production assets.
- `pnpm run preview`: Launches a local web server to preview production builds.
- `pnpm run typecheck`: Evaluates the project files for TypeScript compilation errors.
