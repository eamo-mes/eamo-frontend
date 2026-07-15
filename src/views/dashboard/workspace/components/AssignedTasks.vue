<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Card, List, Modal, Spin } from 'ant-design-vue';
import { useUserStore, useAccessStore } from '@vben/stores';
import { $t } from '#/locales';
import dayjs from 'dayjs';
import axios from 'axios';
import { API_BASE_URL } from '#/api/config';
import {
  getUserNotificationsApi,
  markNotificationReadApi,
  type BackendNotification
} from '#/api/core/notification';

const ListItem = List.Item;
const ListItemMeta = List.Item.Meta;

const props = defineProps<{
  notificationOpen?: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:notificationOpen', value: boolean): void;
}>();

const router = useRouter();
const userStore = useUserStore();

const notifications = ref<BackendNotification[]>([]);
const unreadCount = ref(0);
const loading = ref(false);
const notificationsLoading = ref(false);

const plansCount = ref(0);
const tasksCount = ref(0);
const pendingChecklistsCount = ref(0);
const equipmentErrorsCount = ref(0);
const overdueTasksCount = ref(0);

const currentPage = ref(1);
const totalItems = ref(0);
const pageSize = 5;

const userId = computed(() => userStore.userInfo?.userId || '');

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadSummaryStats() {
  try {
    const headers = getAuthHeaders();
    const todayStr = dayjs().format('YYYY-MM-DD');

    const plansRes = await axios.get(`${API_BASE_URL}/v1/maintenance-plans`, { headers });
    plansCount.value = plansRes.data?.total ?? plansRes.data?.data?.length ?? 0;

    const schedulesRes = await axios.get(`${API_BASE_URL}/v1/maintenance-schedules`, {
      headers,
      params: { start_date: todayStr, end_date: todayStr }
    });
    tasksCount.value = schedulesRes.data?.total ?? schedulesRes.data?.data?.length ?? 0;

    const checklistRes = await axios.get(`${API_BASE_URL}/v1/checklist-sessions`, {
      headers,
      params: { include_details: 'true', per_page: 1000 }
    });
    const sessions = checklistRes.data?.data ?? checklistRes.data ?? [];
    pendingChecklistsCount.value = sessions.filter(
      (s: any) => !s.details || s.details.length === 0
    ).length;

    const errorsRes = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, { headers });
    const errorsList = errorsRes.data?.data ?? errorsRes.data ?? [];
    equipmentErrorsCount.value = errorsList.filter(
      (e: any) => e.status !== 'resolved' && e.status !== 'Resolved'
    ).length;

    const overdueRes = await axios.get(`${API_BASE_URL}/v1/maintenance-schedules`, {
      headers,
      params: { end_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), per_page: 1000 }
    });
    const overdueList = overdueRes.data?.data ?? overdueRes.data ?? [];
    overdueTasksCount.value = overdueList.filter(
      (s: any) => !s.maintenance_logs || s.maintenance_logs.length === 0
    ).length;
  } catch (error) {
    console.error('Failed to load summary statistics:', error);
  }
}

async function fetchNotifications() {
  if (!userId.value) return;
  notificationsLoading.value = true;
  try {
    const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day');
    const params = {
      page: currentPage.value,
      per_page: pageSize,
      start_date: sevenDaysAgo.format('YYYY-MM-DD HH:mm:ss')
    };
    
    const res = await getUserNotificationsApi(userId.value, params);
    const list = res.notifications?.data ?? [];
    notifications.value = list;
    
    totalItems.value = res.notifications?.total ?? list.length;
    unreadCount.value = res.unread_count ?? 0;
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
  } finally {
    notificationsLoading.value = false;
  }
}

async function loadAllData() {
  loading.value = true;
  try {
    await Promise.all([loadSummaryStats(), fetchNotifications()]);
  } finally {
    loading.value = false;
  }
}

const paginationConfig = computed(() => ({
  onChange: (page: number) => {
    currentPage.value = page;
    fetchNotifications();
  },
  current: currentPage.value,
  pageSize: pageSize,
  total: totalItems.value,
  showSizeChanger: false,
  class: 'mt-4 flex justify-end',
}));

onMounted(() => {
  loadAllData();
});

async function handleMarkRead(id: string) {
  try {
    await markNotificationReadApi(id);
    const item = notifications.value.find((n) => n.id === id);
    if (item && item.read_at === null) {
      item.read_at = new Date().toISOString();
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

async function handleTaskAction(item: BackendNotification) {
  const entityType = item.data?.entity_type;
  const entityId = item.data?.entity_id;

  if (item.read_at === null) {
    await handleMarkRead(item.id);
  }

  if (entityType === 'checklist_session') {
    router.push({ name: 'OpsCheckListDetail', query: { id: entityId } });
  } else if (entityType === 'maintenance_schedule') {
    router.push({ name: 'OpsMaintenancePlans' });
  } else if (entityType === 'error_log') {
    router.push({ name: 'OpsErrorMonitoring' });
  } else if (entityType === 'maintenance_item') {
    router.push({ name: 'OpsMaintenancePlans' });
  }
}

const statItems = computed(() => [
  { label: $t('page.dashboard.assignedTasksTitle'), value: unreadCount.value, accent: unreadCount.value > 0 },
  { label: $t('page.dashboard.mPlans'), value: plansCount.value, accent: false },
  { label: $t('page.dashboard.mTasks'), value: tasksCount.value, accent: false },
  { label: $t('page.dashboard.chkPending'), value: pendingChecklistsCount.value, accent: false },
  { label: $t('page.dashboard.eqErrors'), value: equipmentErrorsCount.value, accent: false },
  { label: $t('page.dashboard.overdueTasks'), value: overdueTasksCount.value, accent: true },
]);
</script>

<template>
  <Card :bordered="false" class="workspace-panel shadow-sm rounded-xl border border-slate-100 dark:border-slate-800 w-full overflow-hidden">
    <!-- Card Header -->
    <template #title>
      <div class="flex items-center justify-between">
        <span class="font-semibold text-slate-800 dark:text-slate-100 text-sm tracking-tight">
          {{ $t('page.dashboard.overview') }}
        </span>
      </div>
    </template>

    <Spin :spinning="loading" size="small">
      <!-- ── Stats Grid ── -->
      <div class="stats-grid mb-5">
        <div
          v-for="stat in statItems"
          :key="stat.label"
          class="stat-item"
          :class="{ 'stat-item--alert': stat.accent && stat.value > 0 }"
        >
          <span class="stat-value" :class="stat.accent && stat.value > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-100'">
            {{ stat.value }}
          </span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>

      <!-- ── Divider ── -->
      <Modal
        :open="props.notificationOpen"
        :title="$t('page.dashboard.assignedTasksTitle')"
        :footer="null"
        width="640px"
        @update:open="emit('update:notificationOpen', $event)"
      >
      <Spin :spinning="notificationsLoading" size="small">
        <div class="section-divider">
        <span class="section-divider__label">{{ $t('page.dashboard.assignedTasksTitle') }}</span>
        </div>

      <!-- ── Empty State ── -->
      <div v-if="notifications.length === 0" class="empty-state">
        <p class="text-xs text-slate-400 dark:text-slate-500 m-0 leading-relaxed text-center">
          {{ $t('page.dashboard.noTasks') }}
        </p>
      </div>

      <!-- ── Notifications List ── -->
      <List v-else :data-source="notifications" :pagination="paginationConfig" class="w-full">
        <template #renderItem="{ item }">
          <ListItem
            class="notification-item"
            :class="{ 'notification-item--unread': item.read_at === null }"
            @click="handleTaskAction(item)"
          >
            <ListItemMeta class="flex-1 min-w-0">
              <template #title>
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span v-if="item.read_at === null" class="unread-dot" />
                    <span class="notification-title" :class="item.read_at === null ? 'font-semibold text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'">
                      {{ item.data?.entity_label || 'Task' }}
                    </span>
                  </div>
                  <span class="notification-date">
                    {{ item.created_at ? dayjs(item.created_at).format('DD/MM') : '' }}
                  </span>
                </div>
              </template>
              <template #description>
                <p class="notification-message" :class="item.read_at === null ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'">
                  {{ item.data?.message }}
                </p>
              </template>
            </ListItemMeta>
          </ListItem>
        </template>
      </List>
      </Spin>
      </Modal>
    </Spin>
  </Card>
</template>

<style scoped>
/* ── Stats Grid ─────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 6px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  transition: background 0.15s;
}

:global(.dark) .stat-item {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.06);
}

.stat-item--alert {
  background: #fff5f5;
  border-color: #fee2e2;
}

:global(.dark) .stat-item--alert {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.15);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.stat-label {
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.3;
  font-weight: 500;
}

/* ── Section Divider ────────────────────────────── */
.section-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

:global(.dark) .section-divider::before,
:global(.dark) .section-divider::after {
  background: rgba(255, 255, 255, 0.08);
}

.section-divider__label {
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  white-space: nowrap;
}

/* ── Empty State ────────────────────────────────── */
.empty-state {
  padding: 28px 0 16px;
  display: flex;
  justify-content: center;
}

/* ── Notification Items ─────────────────────────── */
.notification-item {
  padding: 10px 12px !important;
  margin-bottom: 6px;
  border-radius: 8px !important;
  border: 1px solid #f1f5f9 !important;
  cursor: pointer;
  transition: all 0.15s ease;
  background: transparent;
}

.notification-item:last-child {
  margin-bottom: 0;
}

.notification-item:hover {
  background: #f8fafc !important;
  border-color: #e2e8f0 !important;
}

:global(.dark) .notification-item {
  border-color: rgba(255, 255, 255, 0.07) !important;
}

:global(.dark) .notification-item:hover {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

.notification-item--unread {
  background: #f0f7ff !important;
  border-color: #bfdbfe !important;
}

:global(.dark) .notification-item--unread {
  background: rgba(59, 130, 246, 0.06) !important;
  border-color: rgba(59, 130, 246, 0.2) !important;
}

.notification-item--unread:hover {
  background: #e8f2ff !important;
}

.unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
  flex-shrink: 0;
  margin-top: 1px;
}

.notification-title {
  font-size: 12.5px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-date {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 400;
  flex-shrink: 0;
  margin-top: 1px;
}

.notification-message {
  font-size: 11.5px;
  margin: 4px 0 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Ant Design overrides */
:deep(.ant-list-item-meta-title) {
  margin-bottom: 0 !important;
}

:deep(.ant-list-item-meta) {
  align-items: flex-start;
}

:deep(.ant-card-head) {
  border-bottom: 1px solid #f1f5f9;
  min-height: 48px;
  padding: 0 16px;
}

:deep(.ant-card-body) {
  padding: 16px;
}
</style>
