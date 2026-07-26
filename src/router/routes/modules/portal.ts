import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      title: $t('page.portal.menuTitle'),
      icon: 'lucide:smartphone',
      order: 10,
    },
    name: 'MobilePortalGroup',
    path: '/portal-group',
    children: [
      {
        name: 'MobilePortal',
        path: '/portal',
        component: () => import('#/views/mobile-portal/index.vue'),
        meta: {
          title: $t('page.portal.mobileTitle'),
          icon: 'lucide:smartphone',
          ignoreAccess: true,
        },
      },
    ],
  },
];

export default routes;
