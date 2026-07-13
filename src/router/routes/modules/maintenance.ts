import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:wrench',
      order: 40,
      title: $t('page.ops.maintenanceTitle'),
    },
    name: 'MaintenanceManagement',
    path: '/maintenance',
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
        name: 'OpsMaintenanceCategories',
        path: 'maintenance-categories',
        component: () => import('#/views/ops/maintenance-categories/index.vue'),
        meta: {
          icon: 'lucide:wrench',
          title: $t('page.ops.maintenanceCategories'),
        },
      },
      {
        name: 'OpsMaintenancePlans',
        path: 'maintenance-plans',
        component: () => import('#/views/ops/maintenance-plans/index.vue'),
        meta: {
          icon: 'lucide:clipboard-check',
          title: $t('page.ops.maintenancePlans'),
        },
      },
      {
        name: 'OpsMaintenancePlanDetail',
        path: 'maintenance-plans/detail',
        component: () => import('#/views/ops/maintenance-plans/detail.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.ops.maintenancePlanDetail'),
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
