import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['admin'],
      icon: 'lucide:building-2',
      order: 50,
      title: $t('page.company.title'),
    },
    name: 'Company',
    path: '/company',
    children: [
      {
        name: 'CompanyInfo',
        path: 'info',
        component: () => import('#/views/company/info/index.vue'),
        meta: {
          authority: ['admin'],
          icon: 'lucide:info',
          title: $t('page.company.info'),
        },
      },
      {
        name: 'CompanyDepartment',
        path: 'department',
        component: () => import('#/views/company/department/index.vue'),
        meta: {
          authority: ['admin'],
          icon: 'lucide:building',
          title: $t('page.company.department'),
        },
      },
      {
        name: 'CompanyUsers',
        path: 'users',
        component: () => import('#/views/company/users/index.vue'),
        meta: {
          authority: ['admin'],
          icon: 'lucide:users',
          title: $t('page.company.users.title'),
        },
      },
    ],
  },
];

export default routes;
