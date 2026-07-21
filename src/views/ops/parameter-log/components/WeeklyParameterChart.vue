<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Spin, Empty, RadioGroup, RadioButton } from 'ant-design-vue';
import dayjs from 'dayjs';
import { $t } from '#/locales';
import { EchartsUI, useEcharts, type EchartsUIType } from '@vben/plugins/echarts';
import { fetchWeeklyParameterLogsApi } from '../api';
import type { ParameterLogItem, EquipmentOption, UnitOption } from '../types';

const props = defineProps<{
  equipmentId?: string;
  equipments: EquipmentOption[];
  units: UnitOption[];
  externalLogs?: ParameterLogItem[];
}>();

const loading = ref(false);
const logs = ref<ParameterLogItem[]>([]);
const scaleMode = ref<'actual' | 'normalized'>('actual');
const showLimitLines = ref<boolean>(true);
const connectNullsMode = ref<boolean>(true);
const hiddenParamIds = ref<Set<string>>(new Set());

function toggleParam(paramId: string) {
  const newSet = new Set(hiddenParamIds.value);
  if (newSet.has(paramId)) {
    newSet.delete(paramId);
  } else {
    newSet.add(paramId);
  }
  hiddenParamIds.value = newSet;
  updateChart();
}

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const LINE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#a855f7', // Violet
  '#84cc16', // Lime
];

interface ParameterStats {
  id: string;
  name: string;
  code: string;
  unit: string;
  min: number;
  max: number;
  avg: number;
  count: number;
  color: string;
  limitMax?: number;
}

function getUnitName(unitId: string | null | undefined): string {
  if (!unitId) return '';
  const u = props.units.find((unit) => unit.id === unitId);
  return u ? u.name : '';
}

function getParamInfo(item: ParameterLogItem): { id: string; name: string; code: string; unit: string } {
  const paramId = item.equipment_parameter_id;
  const paramObj = item.parameter || item.equipment_parameter;
  const equip = props.equipments.find((e) => e.id === item.equipment_id);
  const metaParam = equip?.equipment_parameters?.find((p) => p.id === paramId);

  const name = paramObj?.name || metaParam?.name || paramId;
  const code = paramObj?.code || metaParam?.code || '';
  const unit = getUnitName(item.unit_id);
  return { id: paramId, name, code, unit };
}

async function loadData() {
  if (!props.equipmentId) {
    logs.value = props.externalLogs || [];
    updateChart();
    return;
  }

  loading.value = true;
  try {
    const data = await fetchWeeklyParameterLogsApi(props.equipmentId);
    logs.value = data;
  } catch (error) {
    console.error('Failed to fetch weekly parameter logs', error);
  } finally {
    loading.value = false;
    await nextTick();
    updateChart();
  }
}

watch(
  () => props.equipmentId,
  () => {
    hiddenParamIds.value.clear();
    loadData();
  },
  { immediate: true }
);

watch(
  () => props.externalLogs,
  (newLogs) => {
    if (!props.equipmentId && newLogs) {
      logs.value = newLogs;
      updateChart();
    }
  },
  { deep: true }
);

watch([scaleMode, showLimitLines, connectNullsMode], () => {
  updateChart();
});

// Calculate metrics per parameter
const parameterStats = computed<ParameterStats[]>(() => {
  const map = new Map<string, { info: { id: string; name: string; code: string; unit: string }; values: number[]; rawLimitMax?: number }>();

  logs.value.forEach((item) => {
    const numVal = parseFloat(item.value);
    if (isNaN(numVal)) return;

    const info = getParamInfo(item);
    const paramMeta = item.parameter || item.equipment_parameter;
    const rawLimit = paramMeta?.upper_limit ?? paramMeta?.max_value;
    const parsedLimit = rawLimit != null ? parseFloat(String(rawLimit)) : undefined;

    if (!map.has(info.id)) {
      map.set(info.id, { info, values: [numVal], rawLimitMax: parsedLimit });
    } else {
      map.get(info.id)?.values.push(numVal);
    }
  });

  const stats: ParameterStats[] = [];
  let colorIdx = 0;

  map.forEach((item, paramId) => {
    const vals = item.values;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sum = vals.reduce((acc, curr) => acc + curr, 0);
    const avg = parseFloat((sum / vals.length).toFixed(2));
    const color = LINE_COLORS[colorIdx % LINE_COLORS.length] ?? '#3b82f6';
    colorIdx++;

    // Calculate parameter upper limit (from metadata or peak value)
    const limitMax = item.rawLimitMax !== undefined && !isNaN(item.rawLimitMax)
      ? item.rawLimitMax
      : parseFloat((max * 1.05).toFixed(2));

    stats.push({
      id: paramId,
      name: item.info.name,
      code: item.info.code,
      unit: item.info.unit,
      min,
      max,
      avg,
      count: vals.length,
      color,
      limitMax,
    });
  });

  return stats;
});

async function updateChart() {
  await nextTick();
  if (!chartRef.value) return;

  if (!logs.value || logs.value.length === 0) {
    renderEcharts({
      title: {
        text: $t('page.ops.noChartData'),
        left: 'center',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 14 },
      },
    });
    return;
  }

  // Filter logs with valid numbers and timestamps
  const validLogs = logs.value
    .filter((item) => !isNaN(parseFloat(item.value)))
    .map((item) => {
      const timeStr = item.recorded_at || item.created_at;
      const formattedTime = timeStr ? dayjs(timeStr).format('YYYY-MM-DD HH:mm') : '-';
      const timestamp = timeStr ? dayjs(timeStr).valueOf() : 0;
      return {
        ...item,
        numValue: parseFloat(item.value),
        formattedTime,
        timestamp,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  // Unique X-axis categories (Timestamps)
  const timestamps = Array.from(new Set(validLogs.map((item) => item.formattedTime)));

  // Parameter series map
  const statsMap = new Map<string, ParameterStats>();
  parameterStats.value.forEach((stat) => statsMap.set(stat.id, stat));

  // Selected map for ECharts legend
  const selectedMap: Record<string, boolean> = {};
  parameterStats.value.forEach((stat) => {
    const seriesName = stat.code ? `${stat.name} (${stat.code})` : stat.name;
    selectedMap[seriesName] = !hiddenParamIds.value.has(stat.id);
  });

  // Build ECharts series for each parameter
  const seriesList = parameterStats.value.map((stat) => {
    const isNormalized = scaleMode.value === 'normalized';

    const dataPoints = timestamps.map((ts) => {
      const found = validLogs.find(
        (item) => item.equipment_parameter_id === stat.id && item.formattedTime === ts
      );
      if (!found) return null;

      if (isNormalized) {
        const range = stat.max - stat.min;
        if (range === 0) return 100;
        const norm = ((found.numValue - stat.min) / range) * 100;
        return parseFloat(norm.toFixed(1));
      }
      return found.numValue;
    });

    const markLineData = [];
    if (showLimitLines.value && stat.limitMax !== undefined) {
      const limitValStr = `${stat.limitMax}${stat.unit ? ' ' + stat.unit : ''}`;
      markLineData.push({
        name: `${stat.name} ${$t('page.ops.paramLimit')}`,
        yAxis: isNormalized ? 100 : stat.limitMax,
        label: {
          show: true,
          formatter: isNormalized
            ? `${stat.name} ${$t('page.ops.paramLimit')}`
            : `${stat.name} ${$t('page.ops.paramLimit')}: ${limitValStr}`,
          position: 'end' as const,
          fontSize: 10,
          color: stat.color,
          fontWeight: 'bold' as const,
        },
        lineStyle: {
          color: stat.color,
          type: 'dashed' as const,
          width: 1.5,
        },
      });
    }

    return {
      name: stat.code ? `${stat.name} (${stat.code})` : stat.name,
      type: 'line' as const,
      smooth: true,
      connectNulls: connectNullsMode.value,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: true,
      data: dataPoints,
      itemStyle: {
        color: stat.color,
      },
      lineStyle: {
        width: 2.5,
        color: stat.color,
      },
      markLine: markLineData.length > 0 ? {
        silent: false,
        symbol: ['none', 'none'],
        data: markLineData,
      } : undefined,
    };
  });

  renderEcharts({
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985',
        },
      },
      formatter: (params: unknown) => {
        const pList = params as Array<{
          axisValueLabel: string;
          marker: string;
          seriesName: string;
          value: number | null;
          color: string;
        }>;

        if (!pList || pList.length === 0) return '';
        let header = `<div class="font-bold text-gray-700 dark:text-gray-200 border-b pb-1 mb-1.5">${pList[0]?.axisValueLabel}</div>`;
        let content = '';

        pList.forEach((item) => {
          if (item.value !== null && item.value !== undefined) {
            const stat = parameterStats.value.find(
              (s) => (s.code ? `${s.name} (${s.code})` : s.name) === item.seriesName
            );
            const unitStr = stat?.unit ? ` ${stat.unit}` : '';
            const valDisplay = scaleMode.value === 'normalized' ? `${item.value}% (Raw: ${item.value}${unitStr})` : `${item.value}${unitStr}`;

            content += `
              <div class="flex items-center justify-between gap-4 py-0.5 text-xs">
                <span class="flex items-center gap-1.5">
                  ${item.marker}
                  <span class="font-medium text-gray-800 dark:text-gray-200">${item.seriesName}:</span>
                </span>
                <span class="font-bold" style="color: ${item.color}">${valDisplay}</span>
              </div>
            `;
          }
        });
        return `<div class="p-1">${header}${content}</div>`;
      },
    },
    legend: {
      top: '0%',
      type: 'scroll',
      selected: selectedMap,
      textStyle: {
        fontSize: 12,
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '5%',
      top: '14%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timestamps,
      axisLabel: {
        fontSize: 11,
        rotate: timestamps.length > 8 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      scale: true, // Fit min and max tight around data range
      axisLabel: {
        formatter: scaleMode.value === 'normalized' ? '{value}%' : '{value}',
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
          opacity: 0.5,
        },
      },
    },
    series: seriesList,
  });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header Controls: Mode Selector & Parameter Cards -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('page.ops.scaleMode') }}:
          </span>
          <RadioGroup v-model:value="scaleMode" size="small" button-style="solid">
            <RadioButton value="actual">
              {{ $t('page.ops.actualValues') }}
            </RadioButton>
            <RadioButton value="normalized">
              {{ $t('page.ops.normalizedValues') }}
            </RadioButton>
          </RadioGroup>
        </div>

        <div class="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('page.ops.limitLines') }}:
          </span>
          <RadioGroup v-model:value="showLimitLines" size="small" button-style="solid">
            <RadioButton :value="true">
              {{ $t('page.ops.showLimitLines') }}
            </RadioButton>
            <RadioButton :value="false">
              {{ $t('page.ops.hideLimitLines') }}
            </RadioButton>
          </RadioGroup>
        </div>
      </div>

      <div class="text-xs text-gray-500 flex items-center gap-3">
        <span>Total Parameters: <strong class="text-primary">{{ parameterStats.length }}</strong></span>
      </div>
    </div>

    <!-- Parameter Stats Summary Badge Chips (Interactive Toggle) -->
    <div v-if="parameterStats.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="stat in parameterStats"
        :key="stat.id"
        type="button"
        class="px-2.5 py-1.5 rounded-md text-xs font-medium border shadow-2xs flex items-center gap-2 cursor-pointer transition-all duration-200 select-none hover:shadow-sm"
        :class="[
          hiddenParamIds.has(stat.id)
            ? 'bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700/60 opacity-60 line-through'
            : 'bg-card text-gray-800 dark:text-gray-200 hover:scale-[1.02]'
        ]"
        :style="hiddenParamIds.has(stat.id) ? {} : { borderColor: stat.color + '60', backgroundColor: stat.color + '0A' }"
        @click="toggleParam(stat.id)"
      >
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
          :class="hiddenParamIds.has(stat.id) ? 'bg-gray-300 dark:bg-gray-600' : ''"
          :style="hiddenParamIds.has(stat.id) ? {} : { backgroundColor: stat.color }"
        ></span>
        <span class="font-semibold">
          <span v-if="stat.code" :class="hiddenParamIds.has(stat.id) ? 'text-gray-400' : 'text-gray-500'">({{ stat.code }})</span>
        </span>
      </button>
    </div>

    <!-- Multi-Line Chart Container -->
    <Spin :spinning="loading">
      <div class="bg-card border border-border rounded-xl p-4 shadow-sm min-h-[420px] relative">
        <EchartsUI v-if="logs.length > 0" ref="chartRef" height="400px" />
        <Empty
          v-else
          :description="$t('page.ops.noChartData')"
          class="my-16"
        />
      </div>
    </Spin>
  </div>
</template>
