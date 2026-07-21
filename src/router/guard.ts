import type { GenerateMenuAndRoutesOptions, UserInfo } from '@vben/types';
import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行

    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();

    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) ||
            userStore.userInfo?.homePath ||
            preferences.app.defaultHomePath,
        );
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
      //明确声明忽略权限访问权限，则可以访问
      if (to.meta.ignoreAccess) {
        return true;
      }

      // accessToken is null (e.g. after F5/reload — it's in-memory only).
      // If a refreshToken is available (encrypted localStorage), attempt silent refresh first.
      if (accessStore.refreshToken) {
        try {
          const { refreshAccessToken } = await import('#/api/core/pkce');
          const result = await refreshAccessToken(accessStore.refreshToken);
          accessStore.setAccessToken(result.accessToken);
          if (result.refreshToken) {
            accessStore.setRefreshToken(result.refreshToken);
          }
          // Silent refresh succeeded — proceed to load user info and dynamic routes below
        } catch {
          // Refresh token is expired or revoked — clear it and force re-login
          accessStore.setRefreshToken(null);
        }
      }

      // Re-check accessToken after silent refresh attempt
      if (!accessStore.accessToken) {
        const { redirectToLogin } = await import('#/api/core/pkce');
        const destination =
          to.fullPath === preferences.app.defaultHomePath
            ? preferences.app.defaultHomePath
            : to.fullPath;
        await redirectToLogin(destination);
        // Trả về false để dừng navigation hiện tại (browser sẽ redirect sang backend)
        return false;
      }
    }


    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      return true;
    }

    // 生成路由表
    // 当前登录用户拥有的角色标识列表
    let userInfo: UserInfo;
    try {
      userInfo =
        (userStore.userInfo as UserInfo | null) ||
        (await authStore.fetchUserInfo());
    } catch {
      // fetchUserInfo already cleared the token and triggered PKCE redirect.
      // Return false to abort the current navigation cleanly.
      return false;
    }
    const userRoles = userInfo.roles ?? [];

    // 生成菜单和路由
    const { accessibleMenus, accessibleRoutes } = await generateAccess({
      roles: userRoles,
      router: router as unknown as GenerateMenuAndRoutesOptions['router'],
      // 则会在菜单中显示，但是访问会被重定向到403
      routes:
        accessRoutes as unknown as GenerateMenuAndRoutesOptions['routes'],
    });

    // 保存菜单信息和路由信息
    accessStore.setAccessMenus(accessibleMenus);
    accessStore.setAccessRoutes(accessibleRoutes);
    accessStore.setIsAccessChecked(true);
    const redirectPath = (from.query.redirect ??
      (to.path === preferences.app.defaultHomePath
        ? userInfo.homePath || preferences.app.defaultHomePath
        : to.fullPath)) as string;

    return {
      ...router.resolve(decodeURIComponent(redirectPath)),
      replace: true,
    };
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
