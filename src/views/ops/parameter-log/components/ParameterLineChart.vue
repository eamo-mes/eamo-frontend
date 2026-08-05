<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue';
import { DatePicker, Empty } from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { $t } from '#/locales';
import { usePreferences } from '@vben/preferences';
import { EchartsUI, useEcharts, type EchartsUIType } from '@vben/plugins/echarts';
import type { UnitOption, ParameterLogItem, EquipmentOption } from '../types';

const RangePicker = DatePicker.RangePicker;

const props = defineProps<{
  items: ParameterLogItem[];
  units: UnitOption[];
  parameterId?: string;
  equipmentId?: string;
  equipments?: EquipmentOption[];
}>();

const { isDark } = usePreferences();
const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const chartDataLogs = ref<ParameterLogItem[]>([]);

// Default date range: 1 month leading up to today
const chartDateRange = ref<[Dayjs, Dayjs]>([
  dayjs().subtract(1, 'month').startOf('day'),
  dayjs().endOf('day'),
]);

function getParamId(item: ParameterLogItem | null | undefined): string | null {
  if (!item) return null;
  return item.equipment_parameter_id || item.equipment_parameter?.id || item.parameter?.id || null;
}

// Parameter details lookup across equipments and items
const parameterDetails = computed(() => {
  if (!props.parameterId) return null;

  // 1. Search in equipments
  if (props.equipments) {
    for (const equip of props.equipments) {
      if (equip.equipment_parameters) {
        const found = equip.equipment_parameters.find((p) => p.id === props.parameterId);
        if (found) {
          const nameStr = found.name ? (found.code ? `${found.name} (${found.code})` : found.name) : found.code || props.parameterId;
          return {
            name: nameStr,
            code: found.code || '',
            unitId: found.unit_id || null,
            standard: found.standard ?? null,
            standard_min: found.standard_min ?? found.min_value ?? found.lower_limit ?? null,
            standard_max: found.standard_max ?? found.max_value ?? found.upper_limit ?? null,
          };
        }
      }
    }
  }

  // 2. Search in items
  if (props.items) {
    for (const item of props.items) {
      const p = item.parameter || item.equipment_parameter;
      if (p && (p.id === props.parameterId || item.equipment_parameter_id === props.parameterId)) {
        const nameStr = p.name ? (p.code ? `${p.name} (${p.code})` : p.name) : p.code || props.parameterId;
        return {
          name: nameStr,
          code: p.code || '',
          unitId: item.unit_id || null,
          standard: p.standard ?? null,
          standard_min: p.standard_min ?? p.min_value ?? p.lower_limit ?? null,
          standard_max: p.standard_max ?? p.max_value ?? p.upper_limit ?? null,
        };
      }
    }
  }

  return { name: props.parameterId, code: '', unitId: null, standard: null, standard_min: null, standard_max: null };
});

// Unit suffix
const unitSuffix = computed(() => {
  if (chartDataLogs.value.length > 0 && chartDataLogs.value[0]?.unit_id) {
    const u = props.units.find((unit) => unit.id === chartDataLogs.value[0]?.unit_id);
    if (u) return u.name;
  }
  if (parameterDetails.value?.unitId) {
    const u = props.units.find((unit) => unit.id === parameterDetails.value?.unitId);
    if (u) return u.name;
  }
  return '';
});

async function updateChart() {
  const sourceLogs = props.items || [];

  // Filter by parameterId if provided
  let filtered = props.parameterId
    ? sourceLogs.filter((rec) => getParamId(rec) === props.parameterId)
    : sourceLogs;

  // Filter by chartDateRange if set
  if (chartDateRange.value && chartDateRange.value[0] && chartDateRange.value[1]) {
    const start = chartDateRange.value[0].startOf('day');
    const end = chartDateRange.value[1].endOf('day');
    filtered = filtered.filter((item) => {
      const recDateStr = item.recorded_at || item.created_at;
      if (!recDateStr) return false;
      const recDate = dayjs(recDateStr);
      return (recDate.isAfter(start) || recDate.isSame(start)) && (recDate.isBefore(end) || recDate.isSame(end));
    });
  }

  // Sort chronologically ascending
  const sorted = [...filtered].sort((a, b) => {
    const timeA = dayjs(a.recorded_at || a.created_at).valueOf();
    const timeB = dayjs(b.recorded_at || b.created_at).valueOf();
    return timeA - timeB;
  });

  chartDataLogs.value = sorted;
  await nextTick();
  renderLineChart();
}

async function renderLineChart() {
  await nextTick();
  if (!chartRef.value || chartDataLogs.value.length === 0) return;

  const dates = chartDataLogs.value.map((item) =>
    item.recorded_at
      ? dayjs(item.recorded_at).format('YYYY-MM-DD HH:mm')
      : dayjs(item.created_at).format('YYYY-MM-DD HH:mm')
  );

  const values = chartDataLogs.value.map((item) => {
    const num = Number(item.value);
    return isNaN(num) ? 0 : num;
  });

  const axisTextColor = isDark.value ? '#cbd5e1' : '#4b5563';
  const textColor = isDark.value ? '#f8fafc' : '#1e293b';
  const splitLineColor = isDark.value ? 'rgba(255,255,255,0.1)' : '#e2e8f0';

  const unitLabel = unitSuffix.value ? ` (${unitSuffix.value})` : '';

  // Build standard reference lines (standard, standard_min, standard_max)
  const markLineData: any[] = [];
  const pInfo = parameterDetails.value;

  if (pInfo) {
    if (pInfo.standard_max !== null && pInfo.standard_max !== undefined) {
      const maxVal = Number(pInfo.standard_max);
      if (!isNaN(maxVal)) {
        markLineData.push({
          name: 'Standard Max',
          yAxis: maxVal,
          label: {
            show: true,
            formatter: `Max: ${maxVal}${unitSuffix.value ? ' ' + unitSuffix.value : ''}`,
            position: 'end',
            color: '#ef4444',
            fontSize: 10,
            fontWeight: 'bold',
          },
          lineStyle: {
            color: '#ef4444',
            type: 'dashed',
            width: 1.5,
          },
        });
      }
    }

    if (pInfo.standard !== null && pInfo.standard !== undefined) {
      const stdVal = Number(pInfo.standard);
      if (!isNaN(stdVal)) {
        markLineData.push({
          name: 'Standard',
          yAxis: stdVal,
          label: {
            show: true,
            formatter: `Standard: ${stdVal}${unitSuffix.value ? ' ' + unitSuffix.value : ''}`,
            position: 'end',
            color: '#10b981',
            fontSize: 10,
            fontWeight: 'bold',
          },
          lineStyle: {
            color: '#10b981',
            type: 'dashed',
            width: 1.5,
          },
        });
      }
    }

    if (pInfo.standard_min !== null && pInfo.standard_min !== undefined) {
      const minVal = Number(pInfo.standard_min);
      if (!isNaN(minVal)) {
        markLineData.push({
          name: 'Standard Min',
          yAxis: minVal,
          label: {
            show: true,
            formatter: `Min: ${minVal}${unitSuffix.value ? ' ' + unitSuffix.value : ''}`,
            position: 'end',
            color: '#ef4444',
            fontSize: 10,
            fontWeight: 'bold',
          },
          lineStyle: {
            color: '#ef4444',
            type: 'dashed',
            width: 1.5,
          },
        });
      }
    }
  }

  renderEcharts({
    grid: {
      left: '3%',
      right: '8%',
      bottom: '10%',
      top: '12%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: unknown) => {
        const list = params as { name: string; value: number }[];
        if (!Array.isArray(list) || list.length === 0) return '';
        const item = list[0];
        if (!item) return '';
        return `<strong>${item.name}</strong><br/>${parameterDetails.value?.name || $t('page.ops.value')}: <strong>${item.value}${unitSuffix.value ? ' ' + unitSuffix.value : ''}</strong>`;
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: {
        color: axisTextColor,
        fontSize: 11,
        rotate: dates.length > 10 ? 30 : 0,
      },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      name: `${$t('page.ops.value')}${unitLabel}`,
      nameTextStyle: { color: axisTextColor, fontSize: 11 },
      axisLabel: { color: axisTextColor, fontSize: 11 },
      splitLine: {
        lineStyle: { type: 'dashed', color: splitLineColor, opacity: 0.7 },
      },
    },
    series: [
      {
        name: parameterDetails.value?.name || $t('page.ops.value'),
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        itemStyle: {
          color: '#1890ff',
        },
        lineStyle: {
          width: 2.5,
          color: '#1890ff',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.25)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
            ],
          },
        },
        markLine: markLineData.length > 0 ? { symbol: ['none', 'none'], data: markLineData } : undefined,
        data: values,
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: textColor,
    },
  });
}

watch(
  [() => props.items, () => props.parameterId, () => chartDateRange.value, () => isDark.value],
  () => {
    updateChart();
  },
  { deep: true, immediate: true }
);
</script>

<template>
  <div class="border border-border rounded-xl p-4 bg-white dark:bg-gray-900 shadow-sm space-y-3">
    <!-- Chart Top Controls Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div class="flex items-center gap-2">
        <h5 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
          {{ parameterDetails?.name || $t('page.ops.parameter') }}
        </h5>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-gray-500 whitespace-nowrap">
          Range:
        </span>
        <RangePicker
          v-model:value="chartDateRange"
          format="YYYY-MM-DD"
          allow-clear
          class="w-[260px]"
        />
      </div>
    </div>

    <!-- Chart Body / Empty State -->
    <div v-if="chartDataLogs.length > 0" class="h-[320px]">
      <EchartsUI ref="chartRef" height="320px" />
    </div>
    <div v-else class="py-12 flex justify-center">
      <Empty :description="$t('page.equipment.chartNoData')" />
    </div>
  </div>
</template>
