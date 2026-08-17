<script lang="ts" setup>
import { onMounted, ref, computed, watch } from 'vue';
import axios from 'axios';
import { Select, Switch, SkeletonInput } from 'ant-design-vue';
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
const operatingLoading = ref(true);

// Parameter Logs Chart State
const paramLogs = ref<ParameterLogItem[]>([]);
const paramEquipments = ref<ParameterEquipmentOption[]>([]);
const paramUnits = ref<UnitOption[]>([]);
const paramLogsLoading = ref(true);

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
    operatingEquipments.value = equipments.map((item: any) => {
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
    maintenanceStatusData.value = maintenanceRes.data?.data ?? maintenanceRes.data ?? [];
  } catch {
    operatingItems.value = [];
    operatingEquipments.value = [];
    maintenanceStatusData.value = [];
  } finally {
    operatingLoading.value = false;
  }
}

async function fetchChartLogs(equipmentId: string, parameterId: string): Promise<void> {
  paramLogsLoading.value = true;
  try {
    const startDate = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');
    const logs = await fetchParameterLogsApi({
      equipment_id: equipmentId,
      equipment_parameter_id: parameterId,
      start_date: startDate,
      end_date: endDate,
    });
    paramLogs.value = logs;
  } catch (error) {
    console.error('Failed to fetch chart parameter logs', error);
    paramLogs.value = [];
  } finally {
    paramLogsLoading.value = false;
  }
}

async function loadParameterLogsData(): Promise<void> {
  paramLogsLoading.value = true;
  try {
    const [equipRes, unitRes] = await Promise.all([
      fetchEquipmentsApi(),
      fetchUnitsApi(),
    ]);

    paramEquipments.value = equipRes.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      equipment_parameters: item.equipment_parameters || [],
    }));
    paramUnits.value = unitRes;

    if (paramEquipments.value.length > 0) {
      const firstEquip = paramEquipments.value[0];
      selectedEquipmentId.value = firstEquip?.id;
      if (firstEquip?.equipment_parameters && firstEquip.equipment_parameters.length > 0) {
        selectedParameterId.value = firstEquip.equipment_parameters[0]?.id;
      } else {
        paramLogsLoading.value = false;
      }
    } else {
      paramLogsLoading.value = false;
    }
  } catch (error) {
    console.error('Failed to load equipment and unit data for dashboard chart', error);
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

watch([selectedEquipmentId, selectedParameterId], ([equipId, paramId]) => {
  if (equipId && paramId) {
    fetchChartLogs(equipId, paramId);
  } else {
    paramLogs.value = [];
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

  return [...paramLogs.value].sort((a, b) => {
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
            <SkeletonInput
              v-if="paramLogsLoading && paramEquipments.length === 0"
              active
              size="small"
              style="width: 220px;"
            />
            <Select
              v-else
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
            <SkeletonInput
              v-if="paramLogsLoading && paramEquipments.length === 0"
              active
              size="small"
              style="width: 220px;"
            />
            <Select
              v-else
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
