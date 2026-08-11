import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['admin', 'manager', 'engineer'],
      icon: 'lucide:wrench',
      order: 20,
      title: $t('page.equipment.title'),
    },
    name: 'EquipmentManagement',
    path: '/equipment',
    children: [
      {
        name: 'EquipmentGroup',
        path: 'equipment-group',
        meta: {
          authority: ['admin', 'manager', 'engineer'],
          icon: 'lucide:box',
          title: $t('page.equipment.navEquipment'),
          isGroup: true,
        },
        children: [
          {
            name: 'EquipmentList',
            path: 'list',
            component: () => import('#/views/equipment/list/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:list',
              title: $t('page.equipment.list'),
            },
          },
          {
            name: 'EquipmentDetail',
            path: 'list/detail',
            component: () => import('#/views/equipment/list/detail.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              hideInMenu: true,
              title: $t('page.equipment.detail'),
            },
          },
          {
            name: 'EquipmentCategories',
            path: 'categories',
            component: () => import('#/views/equipment/categories/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:tag',
              title: $t('page.equipment.categories'),
            },
          },
          {
            name: 'EquipmentUnits',
            path: 'units',
            component: () => import('#/views/equipment/units/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:box',
              title: $t('page.equipment.units'),
            },
          },
        ],
      },
      {
        name: 'MaintenanceGroup',
        path: 'maintenance-group',
        meta: {
          authority: ['admin', 'manager', 'engineer'],
          icon: 'lucide:wrench',
          title: $t('page.ops.maintenance'),
          isGroup: true,
        },
        children: [
          {
            name: 'OpsMaintenanceCategories',
            path: '/maintenance/maintenance-categories',
            component: () => import('#/views/ops/maintenance-categories/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:wrench',
              title: $t('page.ops.maintenanceCategories'),
            },
          },
          {
            name: 'OpsMaintenanceCategoryDetail',
            path: '/maintenance/maintenance-categories/detail',
            component: () => import('#/views/ops/maintenance-categories/detail.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              hideInMenu: true,
              title: $t('page.ops.maintenanceCategoryDetail'),
            },
          },
          {
            name: 'OpsMaintenancePlans',
            path: '/maintenance/maintenance-plans',
            component: () => import('#/views/ops/maintenance-plans/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:clipboard-check',
              title: $t('page.ops.maintenancePlans'),
            },
          },
          {
            name: 'OpsMaintenancePlanDetail',
            path: '/maintenance/maintenance-plans/detail',
            component: () => import('#/views/ops/maintenance-plans/detail.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              hideInMenu: true,
              title: $t('page.ops.maintenancePlanDetail'),
            },
          },
          {
            name: 'OpsCheckList',
            path: '/maintenance/checklist',
            component: () => import('#/views/ops/checklist/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:clipboard-list',
              title: $t('page.ops.checklist'),
            },
          },
          {
            name: 'OpsCheckListDetail',
            path: '/maintenance/checklist/detail',
            component: () => import('#/views/ops/checklist/detail.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              hideInMenu: true,
              title: $t('page.ops.checklistDetail'),
            },
          },
        ],
      },
      {
        name: 'ErrorGroup',
        path: 'error-group',
        meta: {
          authority: ['admin', 'manager', 'engineer'],
          icon: 'lucide:alert-triangle',
          title: $t('page.equipment.navError'),
          isGroup: true,
        },
        children: [
          {
            name: 'EquipmentErrors',
            path: 'errors',
            component: () => import('#/views/equipment/errors/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:alert-triangle',
              title: $t('page.equipment.errors'),
            },
          },
          {
            name: 'OpsErrorMonitoring',
            path: '/maintenance/error-monitoring',
            component: () => import('#/views/ops/error-monitoring/index.vue'),
            meta: {
              authority: ['admin', 'manager', 'engineer'],
              icon: 'lucide:activity',
              title: $t('page.ops.errorMonitoring'),
            },
          },
        ],
      },
    ],
  },
];

export default routes;
