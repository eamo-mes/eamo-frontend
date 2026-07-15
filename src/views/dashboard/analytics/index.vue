<script lang="ts" setup>
import type { TabOption } from '@vben/types';

import { AnalysisChartsTabs } from '@vben/common-ui';
import { onMounted, ref } from 'vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

import EquipmentSummaryWidgets from '#/views/equipment/list/components/EquipmentSummaryWidgets.vue';
import OperatingTimesCharts from '#/views/ops/operating-times/components/OperatingTimesCharts.vue';
import type {
  EquipmentOption,
  OperatingTimeItem,
} from '#/views/ops/operating-times/types';
import AnalyticsTrends from './analytics-trends.vue';
import AnalyticsVisits from './analytics-visits.vue';

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
const operatingEquipments = ref<EquipmentOption[]>([]);
const maintenanceStatusData = ref<{ name: string; remaining: number }[]>([]);
const operatingLoading = ref(false);

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

const chartTabs: TabOption[] = [
  {
    label: '流量趋势',
    value: 'trends',
  },
  {
    label: '月访问量',
    value: 'visits',
  },
];

onMounted(() => {
  loadEquipmentSummary();
  loadOperatingTimesData();
});
</script>

<template>
  <div class="p-5">
    <EquipmentSummaryWidgets
      :loading="summaryLoading"
      :summary="summary"
    />

    <AnalysisChartsTabs :tabs="chartTabs" class="mt-5">
      <template #trends>
        <AnalyticsTrends />
      </template>
      <template #visits>
        <AnalyticsVisits />
      </template>
    </AnalysisChartsTabs>

    <div class="mt-5">
      <OperatingTimesCharts
        :filtered-items="operatingItems"
        :equipments="operatingEquipments"
        :loading="operatingLoading"
        :maintenance-status-data="maintenanceStatusData"
      />
    </div>
  </div>
</template>
