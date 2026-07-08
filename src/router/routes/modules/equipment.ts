import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:wrench',
      order: 20,
      title: $t('page.equipment.title'),
    },
    name: 'EquipmentManagement',
    path: '/equipment',
    children: [
      {
        name: 'EquipmentCategories',
        path: 'categories',
        component: () => import('#/views/equipment/categories/index.vue'),
        meta: {
          icon: 'lucide:tag',
          title: $t('page.equipment.categories'),
        },
      },
      {
        name: 'EquipmentList',
        path: 'list',
        component: () => import('#/views/equipment/list/index.vue'),
        meta: {
          icon: 'lucide:list',
          title: $t('page.equipment.list'),
        },
      },
      {
        name: 'EquipmentErrors',
        path: 'errors',
        component: () => import('#/views/equipment/errors/index.vue'),
        meta: {
          icon: 'lucide:alert-triangle',
          title: $t('page.equipment.errors'),
        },
      },
      {
        name: 'IoTLogs',
        path: 'iot-logs',
        component: () => import('#/views/equipment/iot-logs/index.vue'),
        meta: {
          icon: 'lucide:file-text',
          title: $t('page.equipment.iotLogs'),
        },
      },
    ],
  },
];

export default routes;
