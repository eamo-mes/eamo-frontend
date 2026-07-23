<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Spin, Tabs, Table, Tag, Card, Badge, Popconfirm, message } from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { listUsersApi, type UserItem } from '#/api/core/users';
import { useAccessStore, useUserStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import ChecklistCalendar from '#/views/ops/checklist/components/ChecklistCalendar.vue';
import VisualMaintenanceCalendar from '#/views/ops/maintenance-plans/components/VisualMaintenanceCalendar.vue';
import AssignedTasks from './components/AssignedTasks.vue';

const TabPane = Tabs.TabPane;
const router = useRouter();
const userStore = useUserStore();

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
}

interface MaintenanceCategoryOption {
  id: string;
  name: string;
}

interface MaintenanceItemOption {
  id: string;
  name: string;
  description: string | null;
  maintenance_category_id: string;
}

interface ErrorLogItem {
  id: string;
  equipment_id: string;
  equipment_error_id: string;
  occurred_at: string;
  restarted_at?: string;
  handled_at?: string;
  is_synced?: boolean;
  equipment?: { name: string; code: string };
  equipment_error?: { name: string };
  handlers?: Array<{ id: string; name: string }>;
}

interface ScheduleRow {
  id?: string;
  maintenance_item_id: string;
  maintenance_plan_id?: string;
  date: string;
  user_ids: string[];
  result?: string | null;
  _key: string;
  plan_code?: string;
  equipment_id?: string;
  maintenance_type?: string;
  equipment_name?: string;
  category_name?: string;
  item_name?: string;
  item_description?: string;
  users?: Array<{ id: string }>;
  maintenance_logs?: Array<{ result?: string }>;
  maintenance_plan?: {
    plan_code?: string;
    equipment_id?: string;
    maintenance_type?: string;
    equipment?: { code?: string; name?: string };
    maintenance_category?: { name?: string };
  };
  maintenance_item?: {
    name?: string;
    description?: string;
  };
}

const equipments = ref<EquipmentOption[]>([]);
const categories = ref<MaintenanceCategoryOption[]>([]);
const allSchedules = ref<ScheduleRow[]>([]);
const users = ref<UserItem[]>([]);
const maintenanceItems = ref<MaintenanceItemOption[]>([]);
const myErrorLogs = ref<ErrorLogItem[]>([]);
const loadingSchedules = ref(false);
const loadingErrorLogs = ref(false);
const activeTab = ref<'maintenance' | 'checklist' | 'error-monitoring'>('maintenance');
const notificationsOpen = ref(false);

const pendingErrorCount = computed(() => myErrorLogs.value.filter((e) => !e.handled_at).length);

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

const userOptions = computed(() =>
  users.value.map((u) => ({
    label: u.name,
    value: u.id,
  }))
);

async function loadEquipments(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? (raw as EquipmentOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadCategories(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-categories`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? (raw as MaintenanceCategoryOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadAllSchedules(startDate?: string, endDate?: string): Promise<void> {
  try {
    const params: Record<string, string | number | boolean> = { per_page: 1000, with_logs: true };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-schedules`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    const scheduleArray = Array.isArray(raw) ? (raw as ScheduleRow[]) : [];
    allSchedules.value = scheduleArray.map((s) => ({
      id: s.id,
      maintenance_item_id: s.maintenance_item_id,
      maintenance_plan_id: s.maintenance_plan_id,
      date: s.date,
      user_ids: (s.users ?? []).map((u) => u.id),
      result: s.maintenance_logs?.[0]?.result || null,
      _key: Math.random().toString(36).slice(2) + Date.now().toString(36),
      plan_code: s.maintenance_plan?.plan_code || '—',
      equipment_id: s.maintenance_plan?.equipment_id || '',
      maintenance_type: s.maintenance_plan?.maintenance_type || '—',
      equipment_name: s.maintenance_plan?.equipment
        ? `${s.maintenance_plan.equipment.code}${s.maintenance_plan.equipment.name ? ` — ${s.maintenance_plan.equipment.name}` : ''}`
        : '—',
      category_name: s.maintenance_plan?.maintenance_category?.name || '—',
      item_name: s.maintenance_item?.name || '—',
      item_description: s.maintenance_item?.description || '',
    }));
  } catch {
    // silently fail
  }
}

async function loadMaintenanceItems(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-items`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    maintenanceItems.value = Array.isArray(raw) ? (raw as MaintenanceItemOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadUsers(): Promise<void> {
  try {
    users.value = await listUsersApi({ per_page: 1000 });
  } catch {
    // silently fail
  }
}

async function loadMyErrorLogs(): Promise<void> {
  loadingErrorLogs.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`, {
      headers: getAuthHeaders(),
    });
    const rawLogs: ErrorLogItem[] = res.data?.data ?? res.data ?? [];

    const currentUserId = userStore.userInfo?.userId || (userStore.userInfo as { id?: string } | null)?.id;

    myErrorLogs.value = rawLogs.filter((log) => {
      if (!log.handlers || log.handlers.length === 0 || !currentUserId) return false;
      return log.handlers.some((h) => h.id === currentUserId);
    });
  } catch (error: unknown) {
    console.error('Failed to load my error logs:', error);
  } finally {
    loadingErrorLogs.value = false;
  }
}

const calendarRange = ref<{ start_date: string; end_date: string } | null>(null);

async function handleCalendarRangeChange(range: { start_date: string; end_date: string }): Promise<void> {
  calendarRange.value = range;
  loadingSchedules.value = true;
  try {
    await loadAllSchedules(range.start_date, range.end_date);
  } finally {
    loadingSchedules.value = false;
  }
}

interface AssignedTasksInstance {
  loadAllData: () => void;
}

const assignedTasksRef = ref<AssignedTasksInstance | null>(null);

function handleMaintenanceSchedulesUpdate(newSchedules: ScheduleRow[]): void {
  allSchedules.value = newSchedules;
  assignedTasksRef.value?.loadAllData();
}

function handleChecklistRefresh(): void {
  assignedTasksRef.value?.loadAllData();
}

function handleTaskCompletedInDashboard(): void {
  if (calendarRange.value) {
    loadAllSchedules(calendarRange.value.start_date, calendarRange.value.end_date);
  }
  loadMyErrorLogs();
}

const syncingId = ref<string | null>(null);

async function handleSyncResolvedOne(id: string) {
  syncingId.value = id;
  try {
    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/${id}/sync-resolved`,
      {},
      { headers: getAuthHeaders() },
    );
    message.success($t('page.ops.syncSuccessOne'));
    await loadMyErrorLogs();
    assignedTasksRef.value?.loadAllData();
  } catch (error: unknown) {
    const apiErr = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiErr || 'Failed to sync error log');
  } finally {
    syncingId.value = null;
  }
}

const errorColumns = computed(() => [
  {
    title: $t('page.ops.colEquipment'),
    key: 'equipment',
  },
  {
    title: $t('page.ops.error'),
    key: 'error',
  },
  {
    title: $t('page.ops.status'),
    key: 'status',
    align: 'center' as const,
  },
  {
    title: $t('page.ops.occurredAt'),
    dataIndex: 'occurred_at',
    key: 'occurred_at',
  },
  {
    title: $t('page.ops.handledAt'),
    dataIndex: 'handled_at',
    key: 'handled_at',
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    align: 'center' as const,
    width: 200,
  },
]);

function goToErrorDetail(errorId?: string): void {
  if (errorId) {
    router.push({ path: '/equipment/errors', query: { id: errorId } });
  } else {
    router.push('/equipment/errors');
  }
}

onMounted(() => {
  loadEquipments();
  loadCategories();
  loadUsers();
  loadMaintenanceItems();
  loadMyErrorLogs();
});
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Ant Design Vben Tabs Bar Container -->
    <div class="w-full flex justify-center items-center py-2 px-4 rounded-xl border border-border bg-card shadow-sm">
      <Tabs v-model:activeKey="activeTab" centered class="vben-workspace-tabs">
        <TabPane key="maintenance">
          <template #tab>
            <span class="inline-flex items-center gap-2 px-2 py-0.5 text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ $t('page.ops.visualScheduleTitle') }}
            </span>
          </template>
        </TabPane>

        <TabPane key="checklist">
          <template #tab>
            <span class="inline-flex items-center gap-2 px-2 py-0.5 text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ $t('page.ops.checklistCalendarTitle') }}
            </span>
          </template>
        </TabPane>

        <TabPane key="error-monitoring">
          <template #tab>
            <span class="inline-flex items-center gap-2 px-2 py-0.5 text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ $t('page.dashboard.errorMonitoringTab') }}
              <Badge v-if="pendingErrorCount > 0" :count="pendingErrorCount" :overflow-count="99" class="ml-1" />
            </span>
          </template>
        </TabPane>
      </Tabs>
    </div>

    <!-- Top Summary / Task Overview Card -->
    <div class="assigned-tasks-wrapper">
      <AssignedTasks
        ref="assignedTasksRef"
        :active-tab="activeTab"
        v-model:notification-open="notificationsOpen"
        @task-completed="handleTaskCompletedInDashboard"
      />
    </div>

    <!-- Tab Content: Maintenance Calendar -->
    <div v-if="activeTab === 'maintenance'">
      <div class="rounded-xl bg-white p-6 shadow-sm dark:bg-card">
        <Spin :spinning="loadingSchedules">
          <VisualMaintenanceCalendar
            :schedules="allSchedules"
            @update:schedules="handleMaintenanceSchedulesUpdate"
            :maintenance-items="maintenanceItems"
            :categories="categories"
            :equipments="equipments"
            :user-options="userOptions"
            :read-only="true"
            @range-change="handleCalendarRangeChange"
          />
        </Spin>
      </div>
    </div>

    <!-- Tab Content: Checklist Calendar -->
    <ChecklistCalendar v-else-if="activeTab === 'checklist'" :equipments="equipments" @refresh-list="handleChecklistRefresh" />

    <!-- Tab Content: Error Monitoring (Following /equipment/units UI Pattern) -->
    <div v-else-if="activeTab === 'error-monitoring'">
      <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-foreground m-0">
            {{ $t('page.dashboard.todayErrorList') }}
          </h3>
          <Button
            type="primary"
            class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white"
            @click="router.push('/maintenance/error-monitoring')"
          >
            {{ $t('page.dashboard.viewErrorMonitoring') }}
          </Button>
        </div>

        <Spin :spinning="loadingErrorLogs">
          <Table
            :columns="errorColumns"
            :data-source="myErrorLogs"
            row-key="id"
            :scroll="{ x: 'max-content' }"
            :pagination="{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (tot: number) => `Tổng ${tot} bản ghi`,
            }"
            class="w-full"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'equipment'">
                <span class="text-foreground">
                  {{ record.equipment ? `${record.equipment.name} (${record.equipment.code})` : record.equipment_id }}
                </span>
              </template>
              <template v-else-if="column.key === 'error'">
                <Tag
                  color="red"
                  class="cursor-pointer hover:opacity-80 transition-opacity font-medium m-0"
                  @click="goToErrorDetail(record.equipment_error_id || record.equipment_error?.id)"
                >
                  {{ record.equipment_error?.name || record.equipment_error_id }}
                </Tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <Tag v-if="record.handled_at" color="green">{{ $t('page.dashboard.statusCompleted') }}</Tag>
                <Tag v-else-if="record.restarted_at" color="orange">Restarted</Tag>
                <Tag v-else color="red">Active Error</Tag>
              </template>
              <template v-else-if="column.key === 'occurred_at'">
                <span>{{ record.occurred_at ? dayjs(record.occurred_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}</span>
              </template>
              <template v-else-if="column.key === 'handled_at'">
                <span>{{ record.handled_at ? dayjs(record.handled_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <div class="flex items-center justify-center gap-2">
                  <Popconfirm
                    :title="$t('page.ops.syncConfirmOne')"
                    ok-text="Yes"
                    cancel-text="No"
                    @confirm="handleSyncResolvedOne(record.id)"
                  >
                    <Button
                      size="small"
                      :disabled="record.is_synced"
                      :loading="syncingId === record.id"
                      class="rounded border-blue-400 text-blue-600 hover:bg-blue-50"
                    >
                      {{ $t('page.ops.syncResolvedOne') }}
                    </Button>
                  </Popconfirm>
                  <Button
                    size="small"
                    class="rounded hover:border-primary hover:text-primary"
                    @click="router.push('/maintenance/error-monitoring')"
                  >
                    {{ $t('page.dashboard.viewTask') }}
                  </Button>
                </div>
              </template>
            </template>
          </Table>
        </Spin>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assigned-tasks-wrapper {
  margin-top: 1rem !important;
  margin-bottom: 1.5rem !important;
}

:deep(.vben-workspace-tabs .ant-tabs-nav) {
  margin-bottom: 0 !important;
}

:deep(.vben-workspace-tabs .ant-tabs-nav::before) {
  border-bottom: none !important;
}

:deep(.vben-workspace-tabs .ant-tabs-tab) {
  width: 210px;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

:deep(.vben-workspace-tabs .ant-tabs-tab-btn) {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

:deep(.vben-workspace-tabs .ant-tabs-tab-active) {
  font-weight: 600;
}
</style>
