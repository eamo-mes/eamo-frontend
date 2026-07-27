import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';

import { $t } from '#/locales';

const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
const MobileLayout = () => import('#/layouts/mobile.vue');

/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/_core/fallback/not-found.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/',
    redirect: preferences.app.defaultHomePath,
    children: [],
  },
  {
    name: 'AuthCallback',
    path: '/auth/callback',
    component: () => import('#/views/_core/authentication/callback.vue'),
    meta: {
      title: 'Auth Callback',
      ignoreAccess: true,
    },
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: '/',
    children: [
      {
        name: 'CodeLogin',
        path: 'code-login',
        component: () => import('#/views/_core/authentication/code-login.vue'),
        meta: {
          title: $t('page.auth.codeLogin'),
        },
      },
      {
        name: 'QrCodeLogin',
        path: 'qrcode-login',
        component: () =>
          import('#/views/_core/authentication/qrcode-login.vue'),
        meta: {
          title: $t('page.auth.qrcodeLogin'),
        },
      },
      {
        name: 'ForgetPassword',
        path: 'forget-password',
        component: () =>
          import('#/views/_core/authentication/forget-password.vue'),
        meta: {
          title: $t('page.auth.forgetPassword'),
        },
      },
      {
        name: 'Register',
        path: 'register',
        component: () => import('#/views/_core/authentication/register.vue'),
        meta: {
          title: $t('page.auth.register'),
        },
      },
    ],
  },
  {
    component: MobileLayout,
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      title: 'Mobile Portal',
    },
    name: 'MobilePortalGroup',
    path: '/portal-group',
    children: [
      {
        name: 'MobilePortal',
        path: '/portal',
        component: () => import('#/views/mobile/portal/index.vue'),
        meta: {
          title: $t('page.portal.mobileTitle'),
          ignoreAccess: true,
          hideInMenu: true,
          hideInTab: true,
        },
      },
      {
        name: 'MobilePortalEquipment',
        path: '/portal/equipment',
        component: () => import('#/views/mobile/portal/equipment/index.vue'),
        meta: {
          title: 'Equipment',
          ignoreAccess: true,
          hideInMenu: true,
          hideInTab: true,
        },
      },
      {
        name: 'MobilePortalDashboard',
        path: '/portal/dashboard',
        component: () => import('#/views/mobile/portal/dashboard/index.vue'),
        meta: {
          title: 'Dashboard',
          ignoreAccess: true,
          hideInMenu: true,
          hideInTab: true,
        },
      },
      {
        name: 'MobilePortalChecklist',
        path: '/portal/checklist',
        component: () => import('#/views/mobile/portal/checklist/index.vue'),
        meta: {
          title: 'Checklist',
          ignoreAccess: true,
          hideInMenu: true,
          hideInTab: true,
        },
      },
      {
        name: 'MobilePortalMaintainPlan',
        path: '/portal/maintain-plan',
        component: () => import('#/views/mobile/portal/maintain-plan/index.vue'),
        meta: {
          title: 'Maintain Plan',
          ignoreAccess: true,
          hideInMenu: true,
          hideInTab: true,
        },
      },
      {
        name: 'MobilePortalProfile',
        path: '/portal/profile',
        component: () => import('#/views/mobile/profile/index.vue'),
        meta: {
          title: 'Thông tin cá nhân',
          ignoreAccess: true,
          hideInMenu: true,
          hideInTab: true,
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
