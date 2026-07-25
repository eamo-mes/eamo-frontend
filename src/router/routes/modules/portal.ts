import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      title: 'Portal Vận hành',
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
          title: 'Portal Mobile',
          icon: 'lucide:smartphone',
          ignoreAccess: true,
        },
      },
    ],
  },
];

export default routes;
