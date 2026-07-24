<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Spin, Tabs, Table, Tag, Badge, Popconfirm, message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { requestClient } from '#/api/request';
import { listUsersApi } from '#/api/core/users';
import { useUserStore } from '@vben/stores';
import { $t } from '#/locales';
import ChecklistCalendar from './components/ChecklistCalendar.vue';
import VisualMaintenanceCalendar from './components/VisualMaintenanceCalendar.vue';
import type {
  EquipmentOption,
  MaintenanceCategoryOption,
  MaintenanceItemOption,
  ErrorLogItem,
  ScheduleRow,
  UserOption,
} from './types';

const TabPane = Tabs.TabPane;
const router = useRouter();
const userStore = useUserStore();

const equipments = ref<EquipmentOption[]>([]);
const categories = ref<MaintenanceCategoryOption[]>([]);
const allSchedules = ref<ScheduleRow[]>([]);
const users = ref<UserOption[]>([]);
const maintenanceItems = ref<MaintenanceItemOption[]>([]);
const myErrorLogs = ref<ErrorLogItem[]>([]);

const loadingSchedules = ref(false);
const loadingErrorLogs = ref(false);
const activeTab = ref<'maintenance' | 'checklist' | 'error-monitoring'>('maintenance');
const calendarRange = ref<{ start_date: string; end_date: string } | null>(null);
const syncingId = ref<string | null>(null);

const pendingErrorCount = computed(() => myErrorLogs.value.filter((e) => !e.handled_at).length);

const userOptions = computed(() =>
  users.value.map((u) => ({
    label: u.name,
    value: u.id,
  }))
);

async function loadEquipments(): Promise<void> {
  try {
    const raw = await requestClient.get('/v1/equipment', {
      params: { per_page: 1000 },
    });
    equipments.value = Array.isArray(raw) ? (raw as EquipmentOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadCategories(): Promise<void> {
  try {
    const raw = await requestClient.get('/v1/maintenance-categories', {
      params: { per_page: 1000 },
    });
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

    const raw = await requestClient.get('/v1/maintenance-schedules', { params });
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
    const raw = await requestClient.get('/v1/maintenance-items', {
      params: { per_page: 1000 },
    });
    maintenanceItems.value = Array.isArray(raw) ? (raw as MaintenanceItemOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadUsers(): Promise<void> {
  try {
    const raw = await listUsersApi({ per_page: 1000 });
    users.value = Array.isArray(raw) ? (raw as UserOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadMyErrorLogs(): Promise<void> {
  loadingErrorLogs.value = true;
  try {
    const rawLogs = await requestClient.get('/v1/equipment/error-monitoring/equipment-error-logs');
    const logsArray: ErrorLogItem[] = Array.isArray(rawLogs) ? (rawLogs as ErrorLogItem[]) : [];

    const currentUserId = userStore.userInfo?.userId || (userStore.userInfo as { id?: string } | null)?.id;

    myErrorLogs.value = logsArray.filter((log) => {
      if (!log.handlers || log.handlers.length === 0 || !currentUserId) return false;
      return log.handlers.some((h) => h.id === currentUserId);
    });
  } catch (error: unknown) {
    console.error('Failed to load error logs:', error);
  } finally {
    loadingErrorLogs.value = false;
  }
}

async function handleCalendarRangeChange(range: { start_date: string; end_date: string }): Promise<void> {
  calendarRange.value = range;
  loadingSchedules.value = true;
  try {
    await loadAllSchedules(range.start_date, range.end_date);
  } finally {
    loadingSchedules.value = false;
  }
}

function handleMaintenanceSchedulesUpdate(newSchedules: ScheduleRow[]): void {
  allSchedules.value = newSchedules;
}

function handleChecklistRefresh(): void {
  loadEquipments();
}

async function handleSyncResolvedOne(id: string): Promise<void> {
  syncingId.value = id;
  try {
    await requestClient.post(`/v1/equipment/error-monitoring/equipment-error-logs/${id}/sync-resolved`);
    message.success($t('page.ops.syncSuccessOne'));
    await loadMyErrorLogs();
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

const visualMaintenanceCalendarRef = ref();
const checklistCalendarRef = ref();

function handleTopActionClick(): void {
  if (activeTab.value === 'maintenance') {
    if (visualMaintenanceCalendarRef.value?.openCreateDrawer) {
      visualMaintenanceCalendarRef.value.openCreateDrawer();
    } else {
      router.push({ name: 'OpsMaintenancePlanDetail' });
    }
  } else if (activeTab.value === 'checklist') {
    if (checklistCalendarRef.value?.openCreateDrawer) {
      checklistCalendarRef.value.openCreateDrawer();
    }
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
    <!-- Workspace Navigation & Action Bar -->
    <div class="w-full flex items-center justify-between py-2 px-4 rounded-xl border border-border bg-card shadow-sm gap-4">
      <!-- Tabs aligned to the left corner -->
      <div class="min-w-0 flex-1">
        <Tabs v-model:activeKey="activeTab" class="vben-workspace-tabs !mb-0">
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

      <!-- Action Button on top right corner -->
      <div class="shrink-0">
        <Button
          v-if="activeTab === 'maintenance'"
          type="primary"
          class="flex items-center gap-1.5 font-medium"
          @click="handleTopActionClick"
        >
          <span> {{ $t('page.ops.btnAddPlanShort') }}</span>
        </Button>

        <Button
          v-else-if="activeTab === 'checklist'"
          type="primary"
          class="flex items-center gap-1.5 font-medium bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
          @click="handleTopActionClick"
        >
          <span>{{ $t('page.ops.checklistDrawer.btnCreateSession') || 'Thêm phiên kiểm tra' }}</span>
        </Button>
      </div>
    </div>

    <!-- Tab Content: Maintenance Calendar -->
    <div v-if="activeTab === 'maintenance'">
      <div class="rounded-xl bg-card p-6 shadow-sm border border-border">
        <Spin :spinning="loadingSchedules">
          <VisualMaintenanceCalendar
            ref="visualMaintenanceCalendarRef"
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
    <div v-else-if="activeTab === 'checklist'">
      <div class="rounded-xl bg-card p-6 shadow-sm border border-border">
        <ChecklistCalendar
          ref="checklistCalendarRef"
          :equipments="equipments"
          @refresh-list="handleChecklistRefresh"
        />
      </div>
    </div>

    <!-- Tab Content: Error Monitoring -->
    <div v-else-if="activeTab === 'error-monitoring'">
      <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-foreground m-0">
            {{ $t('page.dashboard.todayErrorList') }}
          </h3>
          <Button
            type="primary"
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
