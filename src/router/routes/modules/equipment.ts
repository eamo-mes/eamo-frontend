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
        name: 'EquipmentDetail',
        path: 'list/detail',
        component: () => import('#/views/equipment/list/detail.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.equipment.detail'),
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
        name: 'EquipmentUnits',
        path: 'units',
        component: () => import('#/views/equipment/units/index.vue'),
        meta: {
          icon: 'lucide:box',
          title: $t('page.equipment.units'),
        },
      },
    ],
  },
];

export default routes;
