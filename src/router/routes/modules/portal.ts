import type { RouteRecordRaw } from 'vue-router';

// Route for Mobile Portal is registered in coreRoutes (src/router/routes/core.ts)
// as a standalone top-level route with MobileLayout, bypassing BasicLayout & Multitab bar.
const routes: RouteRecordRaw[] = [];

export default routes;
