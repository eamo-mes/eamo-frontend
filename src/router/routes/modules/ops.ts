import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings',
      order: 30,
      title: $t('page.ops.title'),
    },
    name: 'OpsManagement',
    path: '/ops',
    children: [
      {
        name: 'OpsCheckList',
        path: 'checklist',
        component: () => import('#/views/ops/checklist/index.vue'),
        meta: {
          icon: 'lucide:clipboard-list',
          title: $t('page.ops.checklist'),
        },
      },
      {
        name: 'OpsCheckListDetail',
        path: 'checklist/detail',
        component: () => import('#/views/ops/checklist/detail.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.ops.checklistDetail'),
        },
      },
      {
        name: 'OpsMaintenance',
        path: 'maintenance',
        component: () => import('#/views/ops/maintenance/index.vue'),
        meta: {
          icon: 'lucide:wrench',
          title: $t('page.ops.maintenance'),
        },
      },
      {
        name: 'OpsParameterLog',
        path: 'parameter-log',
        component: () => import('#/views/ops/parameter-log/index.vue'),
        meta: {
          icon: 'lucide:database',
          title: $t('page.ops.parameterLog'),
        },
      },
      {
        name: 'OpsErrorMonitoring',
        path: 'error-monitoring',
        component: () => import('#/views/ops/error-monitoring/index.vue'),
        meta: {
          icon: 'lucide:alert-triangle',
          title: $t('page.ops.errorMonitoring'),
        },
      },
    ],
  },
];

export default routes;
