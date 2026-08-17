<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import {
  Table,
  Button,
  Popconfirm,
  message,
  Spin,
  Tag,
  Progress,
  Input,
  Select,
  DatePicker,
  Tooltip
} from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';
import { isSoftDeleted, softDeletedRowClass } from '#/utils/soft-delete';
import { useRoleAccess } from '#/utils/useRoleAccess';

const { isManager } = useRoleAccess();

import type { OperatingTimeItem, EquipmentOption } from './types';
import OperatingTimesCharts from './components/OperatingTimesCharts.vue';
import OperatingTimeFormModal from './components/OperatingTimeFormModal.vue';
import OperatingTimeImportModal from './components/OperatingTimeImportModal.vue';

const RangePicker = DatePicker.RangePicker;

const loading = ref(false);
const chartsLoading = ref(true);
const showCharts = ref(true);
const items = ref<OperatingTimeItem[]>([]);
const maintenanceStatusData = ref<{ name: string; remaining: number }[]>([]);
const equipments = ref<EquipmentOption[]>([]);

const showModal = ref(false);
const isEditing = ref(false);
const editRecord = ref<OperatingTimeItem | null>(null);

const showImportModal = ref(false);

const searchVal = ref('');
const activeSearch = ref('');
const filterEquipmentId = ref<string | undefined>(undefined);
const filterTimeRange = ref<any>(null);
const activeEquipmentId = ref<string | undefined>(undefined);
const activeTimeRange = ref<any>(null);

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadEquipments() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment?paginate=false`, {
      headers: getAuthHeaders(),
    });
    const data = (res.data?.data ?? res.data ?? []) as any[];
    equipments.value = data.map((item) => {
      let lm = item.last_maintenance;
      if (typeof lm === 'string') {
        try {
          lm = JSON.parse(lm);
        } catch {
          lm = null;
        }
      }
      return {
        id: item.id,
        code: item.code,
        name: item.name || item.code,
        maintenance_interval_hours: item.maintenance_interval_hours,
        last_maintenance: lm,
      };
    });
  } catch (error) {
    console.error('Failed to load equipments', error);
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times`, {
      headers: getAuthHeaders(),
      params: { with_trashed: true },
    });
    items.value = res.data?.data ?? res.data ?? [];
    await loadMaintenanceStatus();
  } catch (error) {
    message.error('Failed to load operating times');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function loadMaintenanceStatus() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times/maintenance-status`, {
      headers: getAuthHeaders(),
    });
    maintenanceStatusData.value = res.data?.data ?? [];
  } catch (error) {
    console.error('Failed to load maintenance status chart data', error);
  }
}

async function initData() {
  chartsLoading.value = true;
  try {
    await Promise.all([
      loadEquipments(),
      loadItems(),
    ]);
  } finally {
    chartsLoading.value = false;
  }
}

function getEquipmentName(id: string) {
  const equip = equipments.value.find(e => e.id === id);
  return equip ? `${equip.name} (${equip.code})` : id;
}

onMounted(() => {
  initData();
});

function handleSearch() {
  activeSearch.value = searchVal.value;
  activeEquipmentId.value = filterEquipmentId.value;
  activeTimeRange.value = filterTimeRange.value;
}

function handleReset() {
  searchVal.value = '';
  filterEquipmentId.value = undefined;
  filterTimeRange.value = null;
  activeSearch.value = '';
  activeEquipmentId.value = undefined;
  activeTimeRange.value = null;
}

// Table filtered items
const filteredItems = computed(() => {
  let result = items.value.filter(item => item.equipment || equipments.value.some(e => e.id === item.equipment_id));

  if (activeSearch.value) {
    const q = activeSearch.value.toLowerCase();
    result = result.filter(item => {
      const nameFromRelation = item.equipment ? `${item.equipment.name} (${item.equipment.code})`.toLowerCase() : '';
      const equipName = nameFromRelation || getEquipmentName(item.equipment_id).toLowerCase();
      return equipName.includes(q);
    });
  }

  if (activeEquipmentId.value) {
    result = result.filter(item => item.equipment_id === activeEquipmentId.value);
  }

  if (activeTimeRange.value && activeTimeRange.value.length === 2) {
    const start = activeTimeRange.value[0];
    const end = activeTimeRange.value[1];
    result = result.filter(item => {
      if (!item.start_time) return false;
      const itemStart = dayjs(item.start_time);
      return (itemStart.isAfter(start) || itemStart.isSame(start)) &&
             (itemStart.isBefore(end) || itemStart.isSame(end));
    });
  }

  return result;
});

// Chart filtered items (default 1 month OR filtered by filterTimeRange if specified)
const chartFilteredItems = computed(() => {
  let result = items.value.filter(item => item.equipment || equipments.value.some(e => e.id === item.equipment_id));

  if (activeSearch.value) {
    const q = activeSearch.value.toLowerCase();
    result = result.filter(item => {
      const nameFromRelation = item.equipment ? `${item.equipment.name} (${item.equipment.code})`.toLowerCase() : '';
      const equipName = nameFromRelation || getEquipmentName(item.equipment_id).toLowerCase();
      return equipName.includes(q);
    });
  }

  if (activeEquipmentId.value) {
    result = result.filter(item => item.equipment_id === activeEquipmentId.value);
  }

  // If filterTimeRange is specified, use it; otherwise default to last 1 month
  if (filterTimeRange.value && filterTimeRange.value.length === 2) {
    const start = dayjs(filterTimeRange.value[0]);
    const end = dayjs(filterTimeRange.value[1]);
    result = result.filter(item => {
      if (!item.start_time) return false;
      const itemStart = dayjs(item.start_time);
      return (itemStart.isAfter(start) || itemStart.isSame(start)) &&
             (itemStart.isBefore(end) || itemStart.isSame(end));
    });
  } else {
    // Default limit to 1 month
    const startOfOneMonthAgo = dayjs().subtract(1, 'month').startOf('day');
    const endOfToday = dayjs().endOf('day');
    result = result.filter(item => {
      if (!item.start_time) return false;
      const itemStart = dayjs(item.start_time);
      return (itemStart.isAfter(startOfOneMonthAgo) || itemStart.isSame(startOfOneMonthAgo)) &&
             (itemStart.isBefore(endOfToday) || itemStart.isSame(endOfToday));
    });
  }

  return result;
});

function openAddModal() {
  isEditing.value = false;
  editRecord.value = null;
  showModal.value = true;
}

function openEditModal(record: OperatingTimeItem) {
  isEditing.value = true;
  editRecord.value = record;
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times/${id}`, {
      headers: getAuthHeaders(),
    });
    message.success($t('page.ops.successDelete'));
    loadItems();
  } catch (error) {
    message.error($t('page.ops.deleteFailed'));
    console.error(error);
  }
}

function calculateRowAvailabilityFactor(record: OperatingTimeItem) {
  const workingTime = Number(record.working_time) || 0;
  const plannedStop = Number(record.planned_stop_time) || 0;
  const unplannedStop = Number(record.unplanned_stop_time) || 0;

  const plannedOp = Math.max(0, workingTime - plannedStop);
  const actualOp = Math.max(0, plannedOp - unplannedStop);

  if (plannedOp <= 0) return 0;
  return Number(((actualOp / plannedOp) * 100).toFixed(2));
}

function formatCellHours(val: string | number | undefined | null) {
  const num = Number(val);
  return isNaN(num) ? val : `${Number(num.toFixed(3))} hrs`;
}

const columns = computed(() => [
  {
    title: $t('page.ops.colEquipment'),
    dataIndex: 'equipment_name',
    key: 'equipment_name',
    width: 260,
    ellipsis: true,
    sorter: (a: OperatingTimeItem, b: OperatingTimeItem) => {
      const nameA = a.equipment ? `${a.equipment.name} (${a.equipment.code})` : getEquipmentName(a.equipment_id);
      const nameB = b.equipment ? `${b.equipment.name} (${b.equipment.code})` : getEquipmentName(b.equipment_id);
      return nameA.localeCompare(nameB);
    },
  },
  {
    title: $t('page.ops.workingTime'),
    dataIndex: 'working_time',
    key: 'working_time',
    align: 'right' as const,
    width: 140,
    sorter: (a: OperatingTimeItem, b: OperatingTimeItem) => (Number(a.working_time) || 0) - (Number(b.working_time) || 0),
  },
  {
    title: $t('page.ops.operatingTimeCompact'),
    key: 'operating_time',
    align: 'right' as const,
    width: 170,
    sorter: (a: OperatingTimeItem, b: OperatingTimeItem) => (Number(a.actual_operating_time) || 0) - (Number(b.actual_operating_time) || 0),
  },
  {
    title: $t('page.ops.stopTime'),
    key: 'stop_time',
    align: 'right' as const,
    width: 190,
    sorter: (a: OperatingTimeItem, b: OperatingTimeItem) => {
      const totalStopA = (Number(a.planned_stop_time) || 0) + (Number(a.unplanned_stop_time) || 0);
      const totalStopB = (Number(b.planned_stop_time) || 0) + (Number(b.unplanned_stop_time) || 0);
      return totalStopA - totalStopB;
    },
  },
  {
    title: $t('page.ops.date'),
    dataIndex: 'date',
    key: 'date',
    align: 'center' as const,
    width: 130,
    sorter: (a: OperatingTimeItem, b: OperatingTimeItem) => {
      const valA = a.date ? dayjs(a.date).valueOf() : (a.start_time ? dayjs(a.start_time).valueOf() : 0);
      const valB = b.date ? dayjs(b.date).valueOf() : (b.start_time ? dayjs(b.start_time).valueOf() : 0);
      return valA - valB;
    },
  },
  {
    title: $t('page.ops.availabilityFactor'),
    dataIndex: 'availability_factor',
    key: 'availability_factor',
    align: 'center' as const,
    width: 150,
    fixed: 'right' as const,
    sorter: (a: OperatingTimeItem, b: OperatingTimeItem) => calculateRowAvailabilityFactor(a) - calculateRowAvailabilityFactor(b),
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    align: 'center' as const,
    width: 160,
    fixed: 'right' as const,
  }
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Dashboard Charts Component -->
    <div v-if="showCharts">
      <OperatingTimesCharts
        :filteredItems="chartFilteredItems"
        :equipments="equipments"
        :maintenanceStatusData="maintenanceStatusData"
        :activeEquipmentId="activeEquipmentId"
        :loading="chartsLoading"
      />
    </div>

    <!-- Action Bar -->
    <div class="action-bar operating-times-action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.equipment.placeholderName')"
        class="max-w-[200px] flex-shrink-0"
        allow-clear
        @press-enter="handleSearch"
      />
      <Select
        v-model:value="filterEquipmentId"
        :placeholder="$t('page.ops.selectEquipment')"
        class="min-w-[200px] flex-shrink-0"
        allow-clear
        :options="equipments"
        :fieldNames="{ label: 'name', value: 'id' }"
      />
      <RangePicker
        v-model:value="filterTimeRange"
        show-time
        format="YYYY-MM-DD HH:mm"
        class="operating-times-range-picker min-w-[320px] flex-shrink-0"
      />
      <Button type="default" class="flex-shrink-0 font-medium" @click="handleSearch">
        {{ $t('page.company.btnFilter') }}
      </Button>
      <Button type="default" class="flex-shrink-0 font-medium" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>
      <Button type="default" class="flex-shrink-0 font-medium" @click="showCharts = !showCharts">
        {{ showCharts ? $t('page.ops.btnHideCharts') : $t('page.ops.btnShowCharts') }}
      </Button>
      <div class="ml-auto flex-shrink-0 flex items-center gap-2.5">
        <Button
          v-if="isManager"
          type="default"
          class="font-medium rounded-lg"
          @click="showImportModal = true"
        >
          {{ $t('page.ops.btnImport') }}
        </Button>
        <Button
          v-if="isManager"
          type="primary"
          class="font-medium rounded-lg shadow-sm"
          @click="openAddModal"
        >
          {{ $t('page.ops.btnAddRecord') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredItems"
          row-key="id"
          :row-class-name="softDeletedRowClass"
          :scroll="{ x: 'max-content' }"
          :pagination="{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (tot: number) => $t('page.ops.totalRecords', { total: tot }),
          }"
          class="w-full"
        >
          <template #headerCell="{ column }">
            <template v-if="column.key === 'operating_time'">
              <Tooltip placement="top">
                <template #title>
                  <div>
                    {{ $t('page.ops.plannedOperatingTime') }} ({{ $t('page.ops.plannedShort') }}) / {{ $t('page.ops.actualOperatingTime') }} ({{ $t('page.ops.actualShort') }})
                  </div>
                </template>
                <span class="cursor-help inline-flex items-center select-none text-foreground font-semibold">
                  {{ column.title }}
                </span>
              </Tooltip>
            </template>
            <template v-else-if="column.key === 'stop_time'">
              <Tooltip placement="top">
                <template #title>
                  <div>
                    {{ $t('page.ops.stopTime') }}: {{ $t('page.ops.totalStopTime') }} = {{ $t('page.ops.plannedStopTime') }} + {{ $t('page.ops.unplannedStopTime') }}
                  </div>
                </template>
                <span class="cursor-help inline-flex items-center select-none text-foreground font-semibold">
                  {{ $t('page.ops.stopTime') }}
                </span>
              </Tooltip>
            </template>
            <template v-else>
              <span class="text-foreground font-semibold">
                {{ column.title }}
              </span>
            </template>
          </template>

          <template #bodyCell="{ column, record }">
            <!-- Equipment Name: fixed width with clean truncation -->
            <template v-if="column.key === 'equipment_name'">
              <span
                v-if="record.equipment"
                class="text-foreground font-normal truncate block"
                :title="`${record.equipment.name} (${record.equipment.code})`"
              >
                {{ record.equipment.name }} <span class="text-muted-foreground">({{ record.equipment.code }})</span>
              </span>
              <span
                v-else
                class="text-foreground font-normal truncate block"
                :title="getEquipmentName(record.equipment_id)"
              >
                {{ getEquipmentName(record.equipment_id) }}
              </span>
            </template>

            <!-- Working Time -->
            <template v-else-if="column.key === 'working_time'">
              <span class="text-foreground font-semibold">
                {{ formatCellHours((record as OperatingTimeItem).working_time) }}
              </span>
            </template>

            <!-- Operating Time: Planned (Gray) / Actual (Black) side by side -->
            <template v-else-if="column.key === 'operating_time'">
              <Tooltip placement="top">
                <template #title>
                  <div class="space-y-1 py-0.5 min-w-[200px]">
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-slate-300">{{ $t('page.ops.plannedOperatingTime') }}</span>
                      <span class="text-white">{{ formatCellHours((record as OperatingTimeItem).planned_operating_time) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-slate-100">{{ $t('page.ops.actualOperatingTime') }}</span>
                      <span class="text-white">{{ formatCellHours((record as OperatingTimeItem).actual_operating_time) }}</span>
                    </div>
                  </div>
                </template>
                <div class="flex items-center justify-end gap-1.5 cursor-default font-normal">
                  <span class="text-slate-500 dark:text-zinc-400" :title="$t('page.ops.plannedOperatingTime')">
                    {{ formatCellHours((record as OperatingTimeItem).planned_operating_time) }}
                  </span>
                  <span class="text-muted-foreground/40">/</span>
                  <span class="text-slate-900 dark:text-zinc-100 font-medium" :title="$t('page.ops.actualOperatingTime')">
                    {{ formatCellHours((record as OperatingTimeItem).actual_operating_time) }}
                  </span>
                </div>
              </Tooltip>
            </template>

            <!-- Stop Time: total + breakdown badges -->
            <template v-else-if="column.key === 'stop_time'">
              <Tooltip placement="top">
                <template #title>
                  <div class="space-y-1 py-0.5 min-w-[200px]">
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-slate-300">{{ $t('page.ops.totalStopTime') }}</span>
                      <span class="text-white">
                        {{ formatCellHours((Number((record as OperatingTimeItem).planned_stop_time) || 0) + (Number((record as OperatingTimeItem).unplanned_stop_time) || 0)) }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-slate-300">{{ $t('page.ops.plannedStopTime') }}</span>
                      <span class="text-white">{{ formatCellHours((record as OperatingTimeItem).planned_stop_time) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-rose-300">{{ $t('page.ops.unplannedStopTime') }}</span>
                      <span class="text-white">{{ formatCellHours((record as OperatingTimeItem).unplanned_stop_time) }}</span>
                    </div>
                  </div>
                </template>
                <div class="flex items-center justify-end gap-1.5 cursor-default font-normal">
                  <!-- Planned stop -->
                  <span class="text-slate-500 dark:text-zinc-400" :title="$t('page.ops.plannedStopTime')">
                    {{ formatCellHours((record as OperatingTimeItem).planned_stop_time) }}
                  </span>
                  <span class="text-muted-foreground/40">/</span>
                  <!-- Unplanned stop -->
                  <span class="text-rose-600 dark:text-rose-400" :title="$t('page.ops.unplannedStopTime')">
                    {{ formatCellHours((record as OperatingTimeItem).unplanned_stop_time) }}
                  </span>
                </div>
              </Tooltip>
            </template>

            <!-- Date -->
            <template v-else-if="column.key === 'date'">
              <span class="text-foreground font-normal">
                {{ record.date ? dayjs(record.date).format('YYYY-MM-DD') : '-' }}
              </span>
            </template>

            <!-- Availability Factor -->
            <template v-else-if="column.key === 'availability_factor'">
              <div class="flex items-center gap-2">
                <div class="flex-1 min-w-[60px]">
                  <Progress
                    :percent="calculateRowAvailabilityFactor(record as OperatingTimeItem)"
                    size="small"
                    :show-info="false"
                    :disabled="isSoftDeleted(record as OperatingTimeItem)"
                    :strokeColor="calculateRowAvailabilityFactor(record as OperatingTimeItem) >= 90 ? '#2ec7c9' : calculateRowAvailabilityFactor(record as OperatingTimeItem) >= 75 ? '#5ab1ef' : '#b6a2de'"
                  />
                </div>
                <span
                  class="font-normal w-12 text-right text-semibold">
                  {{ calculateRowAvailabilityFactor(record as OperatingTimeItem).toFixed(1) }}%
                </span>
              </div>
            </template>

            <!-- Actions -->
            <template v-else-if="column.key === 'actions'">
              <div class="flex items-center justify-center gap-1.5">
                <Button
                  v-if="isManager"
                  size="small"
                  class="rounded-md font-normal"
                  @click="openEditModal(record as OperatingTimeItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  v-if="isManager"
                  :title="$t('page.company.deleteConfirm')"
                  :ok-text="$t('page.ops.btnOk')"
                  :cancel-text="$t('page.ops.btnCancel')"
                  @confirm="handleDelete(record.id)"
                >
                  <Button
                    size="small"
                    danger
                    :disabled="isSoftDeleted(record as OperatingTimeItem)"
                    class="rounded-md font-normal"
                  >
                    {{ $t('page.company.btnDelete') }}
                  </Button>
                </Popconfirm>
              </div>
            </template>
          </template>
        </Table>
      </Spin>
    </div>

    <!-- Modular Add/Edit Form Modal -->
    <OperatingTimeFormModal
      v-model:open="showModal"
      :isEditing="isEditing"
      :editRecord="editRecord"
      :equipments="equipments"
      :getAuthHeaders="getAuthHeaders"
      @success="loadItems"
    />

    <!-- Modular Import Excel/CSV Modal -->
    <OperatingTimeImportModal
      v-model:open="showImportModal"
      :getAuthHeaders="getAuthHeaders"
      :getEquipmentName="getEquipmentName"
      :equipments="equipments"
      @success="loadItems"
    />
  </div>
</template>

<style scoped>
.operating-times-action-bar :deep(.operating-times-range-picker) {
  flex: 0 0 320px;
  width: 320px !important;
}
</style>
