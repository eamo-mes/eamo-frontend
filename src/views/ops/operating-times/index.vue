<script lang="ts" setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import {
  Table,
  Button,
  Modal,
  Form,
  FormItem,
  Select,
  InputNumber,
  DatePicker,
  Popconfirm,
  message,
  Spin,
  Tag,
  Progress,
  Input
} from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import type { EchartsUIType } from '@vben/plugins/echarts';


const RangePicker = DatePicker.RangePicker;

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  maintenance_interval_hours?: number | null;
}

interface OperatingTimeItem {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  working_time: string | number;
  planned_stop_time: string | number;
  unplanned_stop_time: string | number;
  planned_operating_time: string | number;
  actual_operating_time: string | number;
  availability_factor: string | number;
  start_time: string;
  end_time: string;
  date?: string;
}

const loading = ref(false);
const showCharts = ref(false);
const submitting = ref(false);
const items = ref<OperatingTimeItem[]>([]);
const maintenanceStatusData = ref<{ name: string; remaining: number }[]>([]);
const equipments = ref<EquipmentOption[]>([]);
const showModal = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);
const searchVal = ref('');
const activeSearch = ref('');
const filterEquipmentId = ref<string | undefined>(undefined);
const filterTimeRange = ref<any>(null);
const activeEquipmentId = ref<string | undefined>(undefined);
const activeTimeRange = ref<any>(null);
const originalEndTime = ref<Dayjs | null>(null);

const formRef = ref();
const formState = ref({
  equipment_id: undefined as string | undefined,
  planned_stop_time: 0,
  unplanned_stop_time: 0,
  start_time: undefined as Dayjs | undefined,
  end_time: undefined as Dayjs | undefined,
});

const rules = computed<Record<string, object[]>>(() => {
  const validateEndTime = async (_rule: unknown, value: Dayjs) => {
    if (!value) {
      return Promise.reject(new Error($t('page.ops.validationEndTimeAfterStartTime')));
    }
    if (formState.value.start_time && value.isBefore(formState.value.start_time)) {
      return Promise.reject(new Error($t('page.ops.validationEndTimeAfterStartTime')));
    }
    return Promise.resolve();
  };

  const validateStartTime = async (_rule: unknown, value: Dayjs) => {
    if (!value) {
      return Promise.reject(new Error($t('page.ops.validationStartTimeBeforeEndTime')));
    }
    if (formState.value.end_time && value.isAfter(formState.value.end_time)) {
      return Promise.reject(new Error($t('page.ops.validationStartTimeBeforeEndTime')));
    }
    return Promise.resolve();
  };

  return {
    equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
    planned_stop_time: [{ required: true, message: $t('page.ops.plannedStopTime') }],
    start_time: [{ required: true, validator: validateStartTime as unknown as (r: unknown, v: unknown) => Promise<void>, trigger: 'change' }],
    end_time: [{ required: true, validator: validateEndTime as unknown as (r: unknown, v: unknown) => Promise<void>, trigger: 'change' }],
  };
});

// Client-side auto-calculate fields for preview panel
const clientWorkingTime = computed(() => {
  if (!formState.value.start_time || !formState.value.end_time) return 0;
  const diff = formState.value.end_time.diff(formState.value.start_time, 'minute');
  return Math.max(0, Number((diff / 60.0).toFixed(2)));
});

const planned_operating_time = computed(() => {
  return Math.max(0, clientWorkingTime.value - (formState.value.planned_stop_time || 0));
});

const actual_operating_time = computed(() => {
  return Math.max(0, planned_operating_time.value - (formState.value.unplanned_stop_time || 0));
});

const availability_factor = computed(() => {
  if (planned_operating_time.value <= 0) return 0;
  return Number(((actual_operating_time.value / planned_operating_time.value) * 100).toFixed(2));
});

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
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
    });
    const data = res.data?.data ?? res.data ?? [];
    equipments.value = data.map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      maintenance_interval_hours: item.maintenance_interval_hours,
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

function getEquipmentCode(id: string) {
  const equip = equipments.value.find(e => e.id === id);
  return equip ? equip.code : id;
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
  let result = items.value.filter(item => equipments.value.some(e => e.id === item.equipment_id));

  if (activeSearch.value) {
    const q = activeSearch.value.toLowerCase();
    result = result.filter(item => {
      const equipName = getEquipmentName(item.equipment_id).toLowerCase();
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
  editId.value = null;
  originalEndTime.value = null;
  formState.value = {
    equipment_id: undefined,
    planned_stop_time: 0,
    unplanned_stop_time: 0,
    start_time: dayjs().startOf('day'),
    end_time: dayjs().endOf('day'),
  };
  showModal.value = true;
}

function openEditModal(record: OperatingTimeItem) {
  isEditing.value = true;
  editId.value = record.id;
  originalEndTime.value = record.end_time ? dayjs(record.end_time) : null;
  formState.value = {
    equipment_id: record.equipment_id,
    planned_stop_time: Number(record.planned_stop_time),
    unplanned_stop_time: Number(record.unplanned_stop_time),
    start_time: record.start_time ? dayjs(record.start_time) : undefined,
    end_time: record.end_time ? dayjs(record.end_time) : undefined,
  };
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

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const selectedEquipment = equipments.value.find(e => e.id === formState.value.equipment_id);
    const payload = {
      equipment_id: formState.value.equipment_id,
      equipment_name: selectedEquipment?.name || '',
      planned_stop_time: formState.value.planned_stop_time,
      unplanned_stop_time: formState.value.unplanned_stop_time,
      start_time: formState.value.start_time ? formState.value.start_time.format('YYYY-MM-DD HH:mm:ss') : null,
      end_time: formState.value.end_time ? formState.value.end_time.format('YYYY-MM-DD HH:mm:ss') : null,
    };

    if (isEditing.value && editId.value) {
      await axios.put(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
    } else {
      await axios.post(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times`, payload, {
        headers: getAuthHeaders(),
      });
    }
    message.success($t('page.ops.successSave'));
    showModal.value = false;
    loadItems();
  } catch (err: any) {
    if (!err?.errorFields) {
      const msg = err?.response?.data?.message || $t('page.ops.saveFailed');
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
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

// Charts
const avgAvailabilityChartRef = ref<EchartsUIType>();
const longestOperatingChartRef = ref<EchartsUIType>();
const maintenanceStatusChartRef = ref<EchartsUIType>();

const { renderEcharts: renderAvgAvailabilityChart } = useEcharts(avgAvailabilityChartRef);
const { renderEcharts: renderLongestOperatingChart } = useEcharts(longestOperatingChartRef);
const { renderEcharts: renderMaintenanceStatusChart } = useEcharts(maintenanceStatusChartRef);

async function renderCharts() {
  await nextTick();
  if (!avgAvailabilityChartRef.value || !longestOperatingChartRef.value || !maintenanceStatusChartRef.value) {
    return;
  }

  const list = filteredItems.value;
  
  // Group by equipment
  const eqMap: Record<string, { id: string; name: string; actualOp: number; unplannedStop: number; factors: number[] }> = {};
  
  list.forEach(item => {
    const eqId = item.equipment_id;
    const eqCode = getEquipmentCode(eqId);
    if (!eqMap[eqId]) {
      eqMap[eqId] = {
        id: eqId,
        name: eqCode,
        actualOp: 0,
        unplannedStop: 0,
        factors: []
      };
    }
    
    const workingTime = Number(item.working_time) || 0;
    const plannedStop = Number(item.planned_stop_time) || 0;
    const unplannedStop = Number(item.unplanned_stop_time) || 0;

    const plannedOp = Math.max(0, workingTime - plannedStop);
    const actualOp = Math.max(0, plannedOp - unplannedStop);
    const factor = plannedOp > 0 ? (actualOp / plannedOp) * 100 : 0;

    eqMap[eqId].actualOp += actualOp;
    eqMap[eqId].unplannedStop += unplannedStop;
    eqMap[eqId].factors.push(factor);
  });

  const eqData = Object.values(eqMap);

  // 1. Average Availability Factor (A) - Donut/Pie Chart representing overall average of all equipment
  const totalRecords = list.length;
  const overallAvg = totalRecords > 0 
    ? list.reduce((sum, item) => sum + calculateRowAvailabilityFactor(item as OperatingTimeItem), 0) / totalRecords 
    : 0;
  
  const avgValue = Number(overallAvg.toFixed(2));
  const remainingValue = Number((100 - avgValue).toFixed(2));

  renderAvgAvailabilityChart({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}%'
    },
    legend: {
      bottom: '5%',
      left: 'center',
      textStyle: { fontSize: 11 }
    },
    series: [
      {
        name: $t('page.ops.availabilityFactor'),
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: `${avgValue}%`,
          fontSize: 22,
          fontWeight: 'bold',
          color: '#1e293b'
        },
        labelLine: {
          show: false
        },
        color: ['#5ab1ef', '#b6a2de'], // Theme colors: sky blue & lavender
        data: [
          { value: avgValue, name: $t('page.ops.chartAvailable') },
          { value: remainingValue, name: $t('page.ops.chartUnavailable') }
        ]
      }
    ]
  });

  // 2. Longest operating time (Horizontal bar chart)
  const sortedOperatingData = [...eqData].sort((a, b) => b.actualOp - a.actualOp);
  const topOperatingData = sortedOperatingData.slice(0, 10);
  const horizontalData = [...topOperatingData].reverse();

  renderLongestOperatingChart({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let res = `${params[0].name}<br/>`;
        params.forEach((p: any) => {
          res += `${p.marker} ${p.seriesName}: ${p.value} hrs<br/>`;
        });
        return res;
      }
    },
    legend: {
      bottom: '0',
      left: 'center',
      textStyle: { fontSize: 10 }
    },
    grid: { left: '3%', right: '8%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: '{value} hrs', fontSize: 10 }
    },
    yAxis: {
      type: 'category',
      data: horizontalData.map(item => item.name),
      axisLabel: { fontSize: 10 }
    },
    series: [
      {
        name: $t('page.ops.actualOperatingTime'),
        type: 'bar',
        stack: 'total',
        color: '#5ab1ef', // Theme sky blue
        barWidth: '45%',
        data: horizontalData.map(item => Number(item.actualOp.toFixed(2)))
      },
      {
        name: $t('page.ops.unplannedStopTime'),
        type: 'bar',
        stack: 'total',
        color: '#cbd5e1', // Theme soft slate/gray
        barWidth: '45%',
        data: horizontalData.map(item => Number(item.unplannedStop.toFixed(2)))
      }
    ]
  });

  // 3. Maintenance Status Chart: Loaded from backend
  let finalData = maintenanceStatusData.value;
  if (activeEquipmentId.value) {
    const activeEquip = equipments.value.find(e => e.id === activeEquipmentId.value);
    if (activeEquip) {
      finalData = finalData.filter(item => item.name === activeEquip.code);
    }
  }

  const topMaintenanceData = finalData.slice(0, 10);
  const finalMaintenanceData = [...topMaintenanceData].reverse();

  renderMaintenanceStatusChart({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        return `${params[0].name}<br/>${params[0].marker} ${params[0].seriesName}: ${params[0].value} hrs`;
      }
    },
    grid: { left: '3%', right: '8%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: '{value} hrs', fontSize: 10 }
    },
    yAxis: {
      type: 'category',
      data: finalMaintenanceData.map(item => item.name),
      axisLabel: { fontSize: 10 }
    },
    series: [
      {
        name: $t('page.ops.chartRemainingHours') || 'Thời gian còn lại',
        type: 'bar',
        color: '#ef4444', // Red color
        barWidth: '45%',
        data: finalMaintenanceData.map(item => item.remaining)
      }
    ]
  });
}

watch([filteredItems, showCharts], () => {
  if (showCharts.value) {
    renderCharts();
  }
}, { deep: true, immediate: true });
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Dashboard Charts -->
    <div v-if="showCharts" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
        <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
          {{ $t('page.ops.chartAvgAvailabilityTitle') }}
        </h3>
        <EchartsUI ref="avgAvailabilityChartRef" />
      </div>
      <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
        <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
          {{ $t('page.ops.chartLongestOperatingTitle') }}
        </h3>
        <EchartsUI ref="longestOperatingChartRef" />
      </div>
      <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
        <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
          {{ $t('page.ops.chartMaintenanceStatusTitle') }}
        </h3>
        <EchartsUI ref="maintenanceStatusChartRef" />
      </div>
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
      <div class="ml-auto flex-shrink-0">
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
              <span>{{ getEquipmentName(record.equipment_id as string) }}</span>
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
              <span>{{ formatCellHours(record[column.key as keyof typeof record]) }}</span>
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

    <!-- Add/Edit Modal -->
    <Modal
      v-model:open="showModal"
      :title="isEditing ? $t('page.ops.btnEditRecord') : $t('page.ops.btnAddRecord')"
      :confirm-loading="submitting"
      :ok-text="$t('page.ops.btnOk')"
      :cancel-text="$t('page.ops.btnCancel')"
      width="1000px"
      @ok="handleOk"
      @cancel="showModal = false"
    >
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id">
          <Select
            v-model:value="formState.equipment_id"
            :options="equipments"
            :fieldNames="{ label: 'name', value: 'id' }"
            :placeholder="$t('page.ops.selectEquipment')"
            class="w-full"
          />
        </FormItem>

        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.plannedStopTime')" name="planned_stop_time">
            <InputNumber v-model:value="formState.planned_stop_time" :min="0" style="width: 100%" />
          </FormItem>
          <FormItem :label="$t('page.ops.unplannedStopTime')" name="unplanned_stop_time">
            <InputNumber
              v-model:value="formState.unplanned_stop_time"
              :min="0"
              style="width: 100%"
            />
          </FormItem>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.startTime')" name="start_time">
            <DatePicker v-model:value="formState.start_time" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
          </FormItem>
          <FormItem :label="$t('page.ops.endTime')" name="end_time">
            <DatePicker v-model:value="formState.end_time" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
          </FormItem>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 grid grid-cols-4 gap-4 mt-6">
          <div class="flex flex-col items-center">
            <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.workingTime') }}</span>
            <span class="text-base font-semibold text-gray-700 dark:text-gray-200">{{ clientWorkingTime }} hrs</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.plannedOperatingTime') }}</span>
            <span class="text-base font-semibold text-gray-700 dark:text-gray-200">{{ planned_operating_time }} hrs</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.actualOperatingTime') }}</span>
            <span class="text-base font-semibold text-gray-700 dark:text-gray-200">{{ actual_operating_time }} hrs</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.availabilityFactor') }}</span>
            <Tag :color="availability_factor >= 90 ? '#2ec7c9' : availability_factor >= 75 ? '#5ab1ef' : '#b6a2de'">
              {{ availability_factor }}%
            </Tag>
          </div>
        </div>
      </Form>
    </Modal>
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
