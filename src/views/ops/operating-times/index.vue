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
  DatePicker
} from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';

import type { OperatingTimeItem, EquipmentOption } from './types';
import OperatingTimesCharts from './components/OperatingTimesCharts.vue';
import OperatingTimeFormModal from './components/OperatingTimeFormModal.vue';
import OperatingTimeImportModal from './components/OperatingTimeImportModal.vue';

const RangePicker = DatePicker.RangePicker;

const loading = ref(false);
const showCharts = ref(false);
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
    equipments.value = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      maintenance_interval_hours: item.maintenance_interval_hours,
      last_maintenance: item.last_maintenance,
    }));
  } catch (error) {
    console.error('Failed to load equipments', error);
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times`, {
      headers: getAuthHeaders(),
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

function getEquipmentName(id: string) {
  const equip = equipments.value.find(e => e.id === id);
  return equip ? `${equip.name} (${equip.code})` : id;
}

onMounted(() => {
  loadEquipments();
  loadItems();
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
  },
  {
    title: $t('page.ops.date'),
    dataIndex: 'date',
    key: 'date',
  },
  {
    title: $t('page.ops.workingTime'),
    dataIndex: 'working_time',
    key: 'working_time',
    align: 'right' as const
  },
  {
    title: $t('page.ops.plannedStopTime'),
    dataIndex: 'planned_stop_time',
    key: 'planned_stop_time',
    align: 'right' as const
  },
  {
    title: $t('page.ops.unplannedStopTime'),
    dataIndex: 'unplanned_stop_time',
    key: 'unplanned_stop_time',
    align: 'right' as const
  },
  {
    title: $t('page.ops.plannedOperatingTime'),
    dataIndex: 'planned_operating_time',
    key: 'planned_operating_time',
    align: 'right' as const
  },
  {
    title: $t('page.ops.actualOperatingTime'),
    dataIndex: 'actual_operating_time',
    key: 'actual_operating_time',
    align: 'right' as const
  },
  {
    title: $t('page.ops.availabilityFactor'),
    dataIndex: 'availability_factor',
    key: 'availability_factor',
    align: 'center' as const,
    width: 150,
    fixed: 'right' as const,
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
        :filteredItems="filteredItems"
        :equipments="equipments"
        :maintenanceStatusData="maintenanceStatusData"
        :activeEquipmentId="activeEquipmentId"
      />
    </div>

    <!-- Action Bar -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full no-scrollbar">
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
        class="min-w-[320px] flex-shrink-0"
      />
      <Button type="default" class="flex-shrink-0" @click="handleSearch">
        {{ $t('page.company.btnFilter') }}
      </Button>
      <Button type="default" class="flex-shrink-0" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>
      <Button type="default" class="flex-shrink-0" @click="showCharts = !showCharts">
        {{ showCharts ? $t('page.ops.btnHideCharts') : $t('page.ops.btnShowCharts') }}
      </Button>
      <div class="ml-auto flex-shrink-0 flex items-center gap-2">
        <Button
          type="default"
          class="border-[#5c3e35] text-[#5c3e35] hover:text-[#4b332b] hover:border-[#4b332b] rounded-md font-medium h-full"
          @click="showImportModal = true"
        >
          {{ $t('page.ops.btnImport') }}
        </Button>
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full"
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
          :scroll="{ x: 'max-content' }"
          :pagination="{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (tot: number) => `Tổng ${tot} bản ghi`,
          }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'equipment_name'">
              <span v-if="record.equipment">
                {{ record.equipment.name }} ({{ record.equipment.code }})
              </span>
              <span v-else>
                {{ getEquipmentName(record.equipment_id) }}
              </span>
            </template>
            <template v-else-if="column.key === 'date'">
              <span>{{ record.date ? dayjs(record.date).format('YYYY-MM-DD') : '-' }}</span>
            </template>
            <template v-else-if="column.key === 'availability_factor'">
              <div class="flex flex-col items-center gap-1 min-w-[120px]">
                <Progress
                  :percent="calculateRowAvailabilityFactor(record as OperatingTimeItem)"
                  size="small"
                  :strokeColor="calculateRowAvailabilityFactor(record as OperatingTimeItem) >= 90 ? '#2ec7c9' : calculateRowAvailabilityFactor(record as OperatingTimeItem) >= 75 ? '#5ab1ef' : '#b6a2de'"
                />
                <Tag :color="calculateRowAvailabilityFactor(record as OperatingTimeItem) >= 90 ? '#2ec7c9' : calculateRowAvailabilityFactor(record as OperatingTimeItem) >= 75 ? '#5ab1ef' : '#b6a2de'">
                  {{ calculateRowAvailabilityFactor(record as OperatingTimeItem).toFixed(2) }}%
                </Tag>
              </div>
            </template>
            <template v-else-if="['working_time', 'planned_stop_time', 'unplanned_stop_time', 'planned_operating_time', 'actual_operating_time'].includes(column.key as string)">
              <span>{{ formatCellHours(record[column.key as keyof OperatingTimeItem]) }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as OperatingTimeItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  ok-text="Yes"
                  cancel-text="No"
                  @confirm="handleDelete(record.id)"
                >
                  <Button
                    size="small"
                    danger
                    class="rounded bg-red-50/50 hover:bg-red-500 hover:text-white border-red-200"
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
.no-scrollbar::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}
.no-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>
