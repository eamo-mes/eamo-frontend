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
import WorkspaceAnalyticsWidget from './components/WorkspaceAnalyticsWidget.vue';
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
const activeTab = ref<'maintenance' | 'checklist'>('maintenance');
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
    <!-- Top Completion Analytics Widget (Above Action Bar) -->

    <!-- Workspace Navigation Tab Bar (Pill Control) -->
    <div class="w-full flex items-center justify-start gap-3">
      <!-- Segmented Pill Tab Bar Container (Equal Width 2-Tab Layout) -->
      <div class="grid grid-cols-2 p-1 bg-card border border-border rounded-xl shadow-sm gap-1 min-w-[320px] md:min-w-[400px]">
        <!-- Tab 1: Maintenance Plan -->
        <button
          type="button"
          :class="[
            'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer border-0 w-full',
            activeTab === 'maintenance'
              ? 'bg-primary/10 text-primary font-bold shadow-xs'
              : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          ]"
          @click="activeTab = 'maintenance'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="truncate">{{ $t('page.ops.visualScheduleTitle') }}</span>
        </button>

        <!-- Tab 2: Checklist -->
        <button
          type="button"
          :class="[
            'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer border-0 w-full',
            activeTab === 'checklist'
              ? 'bg-emerald-500/10 text-emerald-600 font-bold shadow-xs'
              : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          ]"
          @click="activeTab = 'checklist'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="truncate">{{ $t('page.ops.checklistCalendarTitle') }}</span>
        </button>
      </div>
    </div>

    <WorkspaceAnalyticsWidget
      :active-tab="activeTab"
      :schedules="allSchedules"
    />

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
