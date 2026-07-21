<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { $t } from '#/locales';

import {
  Button,
  Input,
  Select,
  Table,
  Popconfirm,
  message,
  Spin,
} from 'ant-design-vue';
import axios from 'axios';
import { listUsersApi, type UserItem } from '#/api/core/users';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { isSoftDeleted, softDeletedRowClass, sortBySoftDeleted } from '#/utils/soft-delete';
import VisualMaintenanceCalendar from './components/VisualMaintenanceCalendar.vue';

interface EquipmentInfo {
  id: string;
  code: string;
  name: string | null;
}

interface MaintenanceCategoryInfo {
  id: string;
  name: string;
}

interface MaintenancePlanItem {
  id: string;
  plan_code: string | null;
  equipment_id: string;
  equipment: EquipmentInfo | null;
  maintenance_category_id: string | null;
  maintenance_category: MaintenanceCategoryInfo | null;
  maintenance_type: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  cycle_type: string | null;
  cycle_interval: number | null;
  notes: string | null;
  deleted_at?: string | null;
}

interface EquipmentOption {
  id: string;
  code: string;
  name: string | null;
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

interface AxiosErrorResponse {
  response?: { data?: { message?: string } };
}

interface TablePagination {
  current?: number;
  pageSize?: number;
}

const router = useRouter();

const loading = ref(false);
const plans = ref<MaintenancePlanItem[]>([]);
const searchVal = ref('');
const activeSearch = ref('');
const selectedEquipmentId = ref<string | undefined>(undefined);
const selectedCategoryId = ref<string | undefined>(undefined);
const equipments = ref<EquipmentOption[]>([]);
const categories = ref<MaintenanceCategoryOption[]>([]);

const showCalendar = ref(false);
const allSchedules = ref<any[]>([]);
const users = ref<UserItem[]>([]);
const maintenanceItems = ref<MaintenanceItemOption[]>([]);
const loadingSchedules = ref(false);

const currentPage = ref(1);
const pageSize = ref(15);
const total = ref(0);

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

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

async function loadPlans(page = currentPage.value, size = pageSize.value): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, boolean | number | string> = { page, per_page: size, with_trashed: true };
    if (activeSearch.value) params.q = activeSearch.value;
    if (selectedEquipmentId.value) params.equipment_id = selectedEquipmentId.value;
    if (selectedCategoryId.value) params.maintenance_category_id = selectedCategoryId.value;

    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-plans`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    plans.value = Array.isArray(raw) ? (raw as MaintenancePlanItem[]) : [];
    total.value = typeof res.data?.total === 'number' ? res.data.total : plans.value.length;
    currentPage.value = typeof res.data?.current_page === 'number' ? res.data.current_page : page;
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    message.error(apiError || $t('page.ops.planLoadError'));
  } finally {
    loading.value = false;
  }
}

function handleSearch(): void {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadPlans(1);
}

function handleReset(): void {
  searchVal.value = '';
  activeSearch.value = '';
  selectedEquipmentId.value = undefined;
  selectedCategoryId.value = undefined;
  currentPage.value = 1;
  loadPlans(1);
}

function handleEquipmentFilter(val: unknown): void {
  selectedEquipmentId.value = typeof val === 'string' ? val : undefined;
  currentPage.value = 1;
  loadPlans(1);
}

function handleCategoryFilter(val: unknown): void {
  selectedCategoryId.value = typeof val === 'string' ? val : undefined;
  currentPage.value = 1;
  loadPlans(1);
}

const columns = computed(() => [
  {
    title: $t('page.ops.colPlanCode'),
    dataIndex: 'plan_code',
    key: 'plan_code',
  },
  {
    title: $t('page.ops.placeholderEquipment'),
    key: 'equipment',
  },
  {
    title: $t('page.ops.maintenanceCategories'),
    key: 'maintenance_category',
  },
  {
    title: $t('page.ops.colMaintenanceType'),
    dataIndex: 'maintenance_type',
    key: 'maintenance_type',
  },
  {
    title: $t('page.ops.startDate'),
    dataIndex: 'date',
    key: 'date',
  },
  {
    title: $t('page.ops.colCycleType'),
    dataIndex: 'cycle_type',
    key: 'cycle_type',
  },
  {
    title: $t('page.company.colActions'),
    key: 'actions',
    width: 180,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]);

function handleTableChange(pagination: TablePagination): void {
  const current = pagination.current ?? 1;
  const size = pagination.pageSize ?? 15;
  currentPage.value = current;
  pageSize.value = size;
  loadPlans(current, size);
}

/*
function handleTableChange(pagination: TablePagination): void {
  const current = pagination.current ?? 1;
  const size = pagination.pageSize ?? 15;
  currentPage.value = current;
  pageSize.value = size;
  loadPlans(current, size);
}

const columns = computed(() => [
  {
    title: $t('page.ops.colPlanCode'),
    dataIndex: 'plan_code',
    key: 'plan_code',
    width: 140,
  },
  {
    title: $t('page.ops.placeholderEquipment'),
    key: 'equipment',
    width: 180,
  },
  {
    title: $t('page.ops.maintenanceCategories'),
    dataIndex: ['maintenance_category', 'name'],
    key: 'maintenance_category',
    width: 180,
  },
  {
    title: $t('page.ops.colMaintenanceType'),
    dataIndex: 'maintenance_type',
    key: 'maintenance_type',
    width: 150,
  },
  {
    title: $t('page.ops.startDate'),
    dataIndex: 'date',
    key: 'date',
    width: 120,
  },
  {
    title: $t('page.ops.colCycleType'),
    dataIndex: 'cycle_type',
    key: 'cycle_type',
    width: 110,
  },
  {
    title: $t('page.company.colActions'),
    key: 'actions',
    width: 160,
    align: 'right' as const,
    fixed: 'right' as const,
  },
]);
*/

const categoryOptions = computed(() =>
  categories.value.map(cat => ({
    label: cat.name,
    value: cat.id,
  }))
);

const userOptions = computed(() =>
  users.value.map((u) => ({
    label: u.name,
    value: u.id,
  }))
);

async function loadAllSchedules(startDate?: string, endDate?: string): Promise<void> {
  try {
    const params: any = { per_page: 1000, with_logs: true };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-schedules`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    allSchedules.value = (Array.isArray(raw) ? raw : []).map((s: any) => ({
      id: s.id,
      maintenance_item_id: s.maintenance_item_id,
      maintenance_plan_id: s.maintenance_plan_id,
      date: s.date,
      user_ids: (s.users ?? []).map((u: any) => u.id),
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

const calendarRange = ref<{ start_date: string; end_date: string } | null>(null);

async function handleCalendarRangeChange(range: { start_date: string; end_date: string }): Promise<void> {
  calendarRange.value = range;
  if (showCalendar.value) {
    loadingSchedules.value = true;
    try {
      await loadAllSchedules(range.start_date, range.end_date);
    } finally {
      loadingSchedules.value = false;
    }
  }
}

async function toggleCalendarView(): Promise<void> {
  showCalendar.value = !showCalendar.value;
  if (showCalendar.value && !calendarRange.value) {
    loadingSchedules.value = true;
    try {
      await Promise.all([loadMaintenanceItems(), loadUsers()]);
    } finally {
      loadingSchedules.value = false;
    }
  }
}

/*
async function toggleCalendarView(): Promise<void> {
  showCalendar.value = !showCalendar.value;
  if (showCalendar.value) {
    loadingSchedules.value = true;
    try {
      await Promise.all([loadMaintenanceItems(), loadUsers()]);
      // If we already have a range, load schedules for it immediately
      if (calendarRange.value) {
        await loadAllSchedules(calendarRange.value.start_date, calendarRange.value.end_date);
      }
    } finally {
      loadingSchedules.value = false;
    }
  }
}
*/

function openAdd(): void {
  router.push({ name: 'OpsMaintenancePlanDetail' });
}

function openEdit(id: string): void {
  router.push({ name: 'OpsMaintenancePlanDetail', query: { id } });
}

async function handleDelete(id: string): Promise<void> {
  try {
    await axios.delete(`${API_BASE_URL}/v1/maintenance-plans/${id}`, {
      headers: getAuthHeaders(),
    });
    message.success($t('page.ops.planDeleteSuccess'));
    await loadPlans();
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    message.error(apiError || $t('page.ops.planDeleteError'));
  }
}

/*
function openEdit(id: string): void {
  router.push({ name: 'OpsMaintenancePlanDetail', query: { id } });
}

async function handleDelete(id: string): Promise<void> {
  try {
    await axios.delete(`${API_BASE_URL}/v1/maintenance-plans/${id}`, {
      headers: getAuthHeaders(),
    });
    plans.value = plans.value.filter(p => p.id !== id);
    if (plans.value.length === 0 && currentPage.value > 1) currentPage.value -= 1;
    message.success($t('page.ops.planDeleteSuccess'));
    loadPlans();
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    message.error(apiError || $t('page.ops.planDeleteError'));
  }
}
*/


onMounted(() => {
  loadEquipments();
  loadCategories();
  loadPlans();
  loadUsers();
  loadMaintenanceItems();
});
</script>

<template>
  <div>
    <div class="p-6 space-y-4">
      <!-- Action Bar -->
      <div class="action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
        <Input
          v-model:value="searchVal"
          :placeholder="$t('page.ops.placeholderPlanCode')"
          class="w-[200px]"
          allow-clear
          @press-enter="handleSearch"
        />
        <Select
          v-model:value="selectedEquipmentId"
          :placeholder="$t('page.ops.placeholderEquipment')"
          show-search
          option-filter-prop="searchText"
          option-label-prop="label"
          class="w-[180px]"
          allow-clear
          @change="handleEquipmentFilter"
          @clear="handleEquipmentFilter(undefined)"
        >
          <Select.Option
            v-for="eq in equipments"
            :key="eq.id"
            :value="eq.id"
            :label="eq.code"
            :searchText="`${eq.code} ${eq.name ?? ''}`"
          >
            <div class="flex justify-between items-center w-full">
              <span>{{ eq.code }}</span>
              <span class="text-xs text-gray-400 ml-2">{{ eq.name }}</span>
            </div>
          </Select.Option>
        </Select>
        <Select
          v-model:value="selectedCategoryId"
          :placeholder="$t('page.ops.maintenanceCategories')"
          :options="categoryOptions"
          class="w-[220px]"
          allow-clear
          show-search
          option-filter-prop="label"
          @change="handleCategoryFilter"
          @clear="handleCategoryFilter(undefined)"
        />
        <Button type="default" @click="handleSearch">
          {{ $t('page.company.btnFilter') }}
        </Button>
        <Button type="default" @click="handleReset">
          {{ $t('page.company.btnReset') }}
        </Button>
        <div class="ml-auto flex gap-2">
          <Button type="default" @click="toggleCalendarView">
            {{ showCalendar ? $t('page.ops.btnListView') : $t('page.ops.btnCalendarView') }}
          </Button>
          <Button
            type="primary"
            class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md text-white h-full"
            @click="openAdd"
          >
            {{ $t('page.ops.btnAddPlan') }}
          </Button>
        </div>
      </div>

      <!-- Calendar View -->
      <div v-if="showCalendar" class="bg-card border border-border rounded-xl p-6 shadow-sm">
        <Spin :spinning="loadingSchedules">
          <VisualMaintenanceCalendar
            v-model:schedules="allSchedules"
            :maintenance-items="maintenanceItems"
            :categories="categories"
            :equipments="equipments"
            :user-options="userOptions"
            :read-only="true"
            @range-change="handleCalendarRangeChange"
          />
        </Spin>
      </div>

      <!-- Table View -->
      <div v-else class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Spin :spinning="loading">
          <Table
            :columns="columns"
            :data-source="plans"
            row-key="id"
            :row-class-name="softDeletedRowClass"
            :scroll="{ x: 'max-content' }"
            :pagination="{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
            }"
            class="table-nowrap w-full"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'equipment'">
                {{ record.equipment ? `${record.equipment.code} - ${record.equipment.name || ''}` : '—' }}
              </template>

              <template v-else-if="column.key === 'maintenance_category'">
                {{ record.maintenance_category?.name || '—' }}
              </template>

              <template v-else-if="column.key === 'actions'">
                <div class="flex items-center justify-center gap-2">
                  <Button size="small" class="rounded hover:border-primary hover:text-primary" :disabled="isSoftDeleted(record as MaintenancePlanItem)" @click="openEdit(record.id)">
                    {{ $t('page.company.btnEdit') }}
                  </Button>
                  <Popconfirm
                    :title="$t('page.company.deleteConfirm')"
                    :ok-text="$t('page.ops.btnConfirm')"
                    :cancel-text="$t('page.ops.btnCancel')"
                    @confirm="handleDelete(record.id)"
                  >
                    <Button size="small" danger class="rounded bg-red-50/50 border-red-200 hover:bg-red-500 hover:text-white" :disabled="isSoftDeleted(record as MaintenancePlanItem)">
                      {{ $t('page.company.btnDelete') }}
                    </Button>
                  </Popconfirm>
                </div>
              </template>
            </template>
          </Table>
        </Spin>
      </div>
    </div>
  </div>
</template>
