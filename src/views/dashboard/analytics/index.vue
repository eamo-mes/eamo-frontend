<script lang="ts" setup>
import { onMounted, ref, computed, watch } from 'vue';
import axios from 'axios';
import { Select, Switch } from 'ant-design-vue';
import dayjs from 'dayjs';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';

import EquipmentSummaryWidgets from '#/views/equipment/list/components/EquipmentSummaryWidgets.vue';
import OperatingTimesCharts from '#/views/ops/operating-times/components/OperatingTimesCharts.vue';
import type {
  EquipmentOption as OperatingEquipmentOption,
  OperatingTimeItem,
} from '#/views/ops/operating-times/types';

import {
  fetchParameterLogsApi,
  fetchEquipmentsApi,
  fetchUnitsApi,
} from '#/views/ops/parameter-log/api';
import type {
  ParameterLogItem,
  EquipmentOption as ParameterEquipmentOption,
  UnitOption,
  ParameterOption,
} from '#/views/ops/parameter-log/types';

import AnalyticsTrends from './analytics-trends.vue';

interface SummaryItem {
  active?: number;
  description: string;
  icon: string;
  inactive?: number;
  overdue?: number;
  title: string;
  upcoming?: number;
  value: number | string;
}

interface DashboardSummary {
  active_inactive: SummaryItem;
  maintenance: SummaryItem;
  total_assets: SummaryItem;
  with_errors: SummaryItem;
}

const summary = ref<DashboardSummary | null>(null);
const summaryLoading = ref(false);
const operatingItems = ref<OperatingTimeItem[]>([]);
const operatingEquipments = ref<OperatingEquipmentOption[]>([]);
const maintenanceStatusData = ref<{ name: string; remaining: number }[]>([]);
const operatingLoading = ref(false);

// Parameter Logs Chart State
const paramLogs = ref<ParameterLogItem[]>([]);
const paramEquipments = ref<ParameterEquipmentOption[]>([]);
const paramUnits = ref<UnitOption[]>([]);
const paramLogsLoading = ref(false);

const selectedEquipmentId = ref<string | undefined>(undefined);
const selectedParameterId = ref<string | undefined>(undefined);
const showLimits = ref<boolean>(false);

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadEquipmentSummary(): Promise<void> {
  summaryLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/dashboard/summary`, {
      headers: getAuthHeaders(),
    });
    summary.value = res.data?.data ?? res.data ?? null;
  } finally {
    summaryLoading.value = false;
  }
}

async function loadOperatingTimesData(): Promise<void> {
  operatingLoading.value = true;
  try {
    const headers = getAuthHeaders();
    const [itemsRes, equipmentsRes, maintenanceRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times`, { headers }),
      axios.get(`${API_BASE_URL}/v1/equipment?paginate=false`, { headers }),
      axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times/maintenance-status`, { headers }),
    ]);

    operatingItems.value = itemsRes.data?.data ?? itemsRes.data ?? [];
    const equipments = equipmentsRes.data?.data ?? equipmentsRes.data ?? [];
    operatingEquipments.value = equipments.map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      maintenance_interval_hours: item.maintenance_interval_hours,
      last_maintenance: item.last_maintenance,
    }));
    maintenanceStatusData.value = maintenanceRes.data?.data ?? maintenanceRes.data ?? [];
  } catch {
    operatingItems.value = [];
    operatingEquipments.value = [];
    maintenanceStatusData.value = [];
  } finally {
    operatingLoading.value = false;
  }
}

async function loadParameterLogsData(): Promise<void> {
  paramLogsLoading.value = true;
  try {
    const [equipRes, unitRes, logsRes] = await Promise.all([
      fetchEquipmentsApi(),
      fetchUnitsApi(),
      fetchParameterLogsApi(false),
    ]);

    paramEquipments.value = equipRes.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      equipment_parameters: item.equipment_parameters || [],
    }));
    paramUnits.value = unitRes;
    // Lọc bỏ các log của thiết bị hoặc thông số đã bị xóa mềm (không có trong paramEquipments)
    const activeEquipMap = new Map(
      paramEquipments.value.map((e) => [e.id, new Set((e.equipment_parameters || []).map((p) => p.id))])
    );
    const activeLogs = logsRes.filter((log) => {
      const paramSet = activeEquipMap.get(log.equipment_id);
      return paramSet && paramSet.has(log.equipment_parameter_id);
    });
    paramLogs.value = activeLogs;

    // Tự động chọn thiết bị và thông số có log mới nhất
    if (activeLogs.length > 0) {
      let newestItem: ParameterLogItem = activeLogs[0]!;
      let newestTime = dayjs(newestItem.recorded_at || newestItem.created_at).valueOf();

      for (let i = 1; i < activeLogs.length; i++) {
        const item = activeLogs[i]!;
        const itemTime = dayjs(item.recorded_at || item.created_at).valueOf();
        if (itemTime > newestTime) {
          newestTime = itemTime;
          newestItem = item;
        }
      }

      selectedEquipmentId.value = newestItem.equipment_id;
      selectedParameterId.value = newestItem.equipment_parameter_id;
    } else if (paramEquipments.value.length > 0) {
      const firstEquip = paramEquipments.value[0];
      selectedEquipmentId.value = firstEquip?.id;
      if (firstEquip?.equipment_parameters && firstEquip.equipment_parameters.length > 0) {
        selectedParameterId.value = firstEquip.equipment_parameters[0]?.id;
      }
    }
  } catch (error) {
    console.error('Failed to load parameter logs data for dashboard chart', error);
  } finally {
    paramLogsLoading.value = false;
  }
}

watch(selectedEquipmentId, (newEquipId) => {
  if (!newEquipId) return;
  const equip = paramEquipments.value.find((e) => e.id === newEquipId);
  const params = equip?.equipment_parameters ?? [];
  const exists = params.some((p) => p.id === selectedParameterId.value);
  if (!exists) {
    selectedParameterId.value = params.length > 0 ? params[0]?.id : undefined;
  }
});

const equipmentSelectOptions = computed(() => {
  return paramEquipments.value.map((e) => ({
    value: e.id,
    label: `${e.name} (${e.code})`,
  }));
});

const parameterSelectOptions = computed(() => {
  if (!selectedEquipmentId.value) return [];
  const equip = paramEquipments.value.find((e) => e.id === selectedEquipmentId.value);
  return (equip?.equipment_parameters ?? []).map((p) => ({
    value: p.id,
    label: p.name ? (p.code ? `${p.name} (${p.code})` : p.name) : p.code || p.id,
  }));
});

const selectedParameterDetails = computed<ParameterOption | null>(() => {
  if (!selectedEquipmentId.value || !selectedParameterId.value) return null;
  const equip = paramEquipments.value.find((e) => e.id === selectedEquipmentId.value);
  const param = equip?.equipment_parameters?.find((p) => p.id === selectedParameterId.value);
  return param ?? null;
});

const selectedUnitName = computed<string>(() => {
  const p = selectedParameterDetails.value;
  if (!p || !p.unit_id) return '';
  const unit = paramUnits.value.find((u) => u.id === p.unit_id);
  return unit ? unit.name : '';
});

const chartFilteredLogs = computed(() => {
  if (!selectedEquipmentId.value || !selectedParameterId.value) return [];

  const start = dayjs().subtract(1, 'month').startOf('day');
  const end = dayjs().endOf('day');

  const result = paramLogs.value.filter((item) => {
    if (
      item.equipment_id !== selectedEquipmentId.value ||
      item.equipment_parameter_id !== selectedParameterId.value
    ) {
      return false;
    }
    const dateStr = item.recorded_at || item.created_at;
    if (!dateStr) return false;
    const recDate = dayjs(dateStr);
    return (recDate.isAfter(start) || recDate.isSame(start)) && (recDate.isBefore(end) || recDate.isSame(end));
  });

  return [...result].sort((a, b) => {
    const timeA = dayjs(a.recorded_at || a.created_at).valueOf();
    const timeB = dayjs(b.recorded_at || b.created_at).valueOf();
    return timeA - timeB;
  });
});

function filterSelectOption(input: string, option?: Record<string, unknown>) {
  if (!option?.label) return false;
  return String(option.label).toLowerCase().includes(input.toLowerCase());
}

onMounted(() => {
  loadEquipmentSummary();
  loadOperatingTimesData();
  loadParameterLogsData();
});
</script>

<template>
  <div class="p-3.5 space-y-3">
    <EquipmentSummaryWidgets
      :loading="summaryLoading"
      :summary="summary"
    />
  
    <!-- Khung chứa Filter Header Controls & Line Chart (tối ưu khoảng trắng) -->
    <div class="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2">
      <!-- Header Controls: Bên trái (Thiết bị & Parameter) | Bên phải (RangePicker 1 tháng & Công tắc đường ngưỡng) -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 px-1">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {{ $t('page.ops.equipmentLabel') }}:
            </span>
            <Select
              v-model:value="selectedEquipmentId"
              :placeholder="$t('page.ops.selectEquipment')"
              class="w-[220px]"
              show-search
              :options="equipmentSelectOptions"
              :filter-option="filterSelectOption"
            />
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {{ $t('page.ops.parameterLabel') }}:
            </span>
            <Select
              v-model:value="selectedParameterId"
              :placeholder="$t('page.ops.selectParameter')"
              class="w-[220px]"
              show-search
              :options="parameterSelectOptions"
              :filter-option="filterSelectOption"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {{ $t('page.ops.showLimits') }}:
            </span>
            <Switch v-model:checked="showLimits" />
          </div>
        </div>
      </div>

      <!-- Line Chart -->
      <AnalyticsTrends
        :items="chartFilteredLogs"
        :parameter-info="selectedParameterDetails"
        :unit-name="selectedUnitName"
        :loading="paramLogsLoading"
        :show-limits="showLimits"
      />
    </div>
    <OperatingTimesCharts
        :filtered-items="operatingItems"
        :equipments="operatingEquipments"
        :loading="operatingLoading"
        :maintenance-status-data="maintenanceStatusData"
      />
  </div>
</template>
