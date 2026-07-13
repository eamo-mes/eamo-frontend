import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:activity',
      order: 30,
      title: $t('page.ops.operationTitle'),
    },
    name: 'OperationManagement',
    path: '/operation',
    children: [
      {
        name: 'OpsOperatingTimes',
        path: 'operating-times',
        component: () => import('#/views/ops/operating-times/index.vue'),
        meta: {
          icon: 'lucide:clock',
          title: $t('page.ops.operatingTimes'),
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
    ],
  },
];

export default routes;
