<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Spin, Empty } from 'ant-design-vue';
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
const scaleMode = ref<'actual' | 'normalized'>('normalized');
const showLimitLines = ref<boolean>(true);
const selectedParamId = ref<string | null>(null);
const connectNullsMode = ref<boolean>(true);

function selectParam(paramId: string) {
  selectedParamId.value = paramId;
  updateChart();
}

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const LINE_COLORS = [
  '#1890ff', // Primary Blue
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
  limitMin?: number;
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
    selectedParamId.value = null;
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

watch([scaleMode, showLimitLines, connectNullsMode, selectedParamId], () => {
  updateChart();
});

// Calculate metrics per parameter
const parameterStats = computed<ParameterStats[]>(() => {
  const map = new Map<
    string,
    {
      info: { id: string; name: string; code: string; unit: string };
      values: number[];
      rawLimitMax?: number;
      rawLimitMin?: number;
    }
  >();

  logs.value.forEach((item) => {
    const numVal = parseFloat(item.value);
    if (isNaN(numVal)) return;

    const info = getParamInfo(item);
    const paramMeta = (item.parameter || item.equipment_parameter) as Record<string, any> | undefined;
    const rawLimitMax = paramMeta?.standard_max ?? paramMeta?.upper_limit ?? paramMeta?.max_value;
    const rawLimitMin = paramMeta?.standard_min ?? paramMeta?.lower_limit ?? paramMeta?.min_value;
    const parsedLimitMax = rawLimitMax != null ? parseFloat(String(rawLimitMax)) : undefined;
    const parsedLimitMin = rawLimitMin != null ? parseFloat(String(rawLimitMin)) : undefined;

    if (!map.has(info.id)) {
      map.set(info.id, {
        info,
        values: [numVal],
        rawLimitMax: parsedLimitMax,
        rawLimitMin: parsedLimitMin,
      });
    } else {
      const entry = map.get(info.id);
      if (entry) {
        entry.values.push(numVal);
      }
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
    const limitMax =
      item.rawLimitMax !== undefined && !isNaN(item.rawLimitMax)
        ? item.rawLimitMax
        : parseFloat((max * 1.05).toFixed(2));

    // Calculate parameter lower limit (from metadata or min value)
    const limitMin =
      item.rawLimitMin !== undefined && !isNaN(item.rawLimitMin)
        ? item.rawLimitMin
        : parseFloat((min * 0.95).toFixed(2));

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
      limitMin,
    });
  });

  return stats;
});

watch(parameterStats, (stats) => {
  if (stats && stats.length > 0) {
    const firstStat = stats[0];
    if (firstStat && (!selectedParamId.value || !stats.some((s) => s.id === selectedParamId.value))) {
      selectedParamId.value = firstStat.id;
    }
  } else {
    selectedParamId.value = null;
  }
}, { immediate: true });

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
    selectedMap[seriesName] = stat.id === selectedParamId.value;
  });

  // Build ECharts series for the active parameter
  const seriesList = parameterStats.value
    .filter((stat) => stat.id === selectedParamId.value)
    .map((stat) => {
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

      // Max Limit Line
      if (showLimitLines.value && stat.limitMax !== undefined) {
        const limitValStr = `${stat.limitMax}${stat.unit ? ' ' + stat.unit : ''}`;
        markLineData.push({
          name: 'Max Limit',
          yAxis: isNormalized ? 100 : stat.limitMax,
          label: {
            show: true,
            formatter: isNormalized ? 'Max Limit' : `Max Limit: ${limitValStr}`,
            position: 'end' as const,
            fontSize: 10,
            color: '#ef4444',
            fontWeight: 'bold' as const,
          },
          lineStyle: {
            color: '#ef4444',
            type: 'dashed' as const,
            width: 1.5,
          },
        });
      }

      // Min Limit Line
      if (showLimitLines.value && stat.limitMin !== undefined) {
        const limitValStr = `${stat.limitMin}${stat.unit ? ' ' + stat.unit : ''}`;
        markLineData.push({
          name: 'Min Limit',
          yAxis: isNormalized ? 0 : stat.limitMin,
          label: {
            show: true,
            formatter: isNormalized ? 'Min Limit' : `Min Limit: ${limitValStr}`,
            position: 'end' as const,
            fontSize: 10,
            color: '#ef4444',
            fontWeight: 'bold' as const,
          },
          lineStyle: {
            color: '#ef4444',
            type: 'dashed' as const,
            width: 1.5,
          },
        });
      }

      // Average Line
      if (stat.avg !== undefined) {
        const avgValStr = `${stat.avg}${stat.unit ? ' ' + stat.unit : ''}`;
        const normalizedAvg = isNormalized
          ? ((stat.avg - stat.min) / (stat.max - stat.min || 1)) * 100
          : stat.avg;
        markLineData.push({
          name: 'Average',
          yAxis: parseFloat(normalizedAvg.toFixed(1)),
          label: {
            show: true,
            formatter: `Avg: ${avgValStr}`,
            position: 'end' as const,
            fontSize: 10,
            color: '#64748b',
            fontWeight: 'bold' as const,
          },
          lineStyle: {
            color: '#64748b',
            type: 'dashed' as const,
            width: 1.5,
          },
        });
      }

      const seriesObj: any = {
        name: stat.code ? `${stat.name} (${stat.code})` : stat.name,
        type: 'bar',
        barWidth: '40%',
        data: dataPoints,
        itemStyle: {
          color: stat.color,
          borderRadius: [4, 4, 0, 0],
        },
      };

      if (markLineData.length > 0) {
        seriesObj.markLine = {
          silent: false,
          symbol: ['none', 'none'],
          data: markLineData,
        };
      }

      return seriesObj;
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
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#4b5563',
    },
    series: seriesList,
  });

}
</script>

<template>
  <div class="space-y-4">


    <!-- Parameter Stats Summary Badge Chips (Single Select) -->
    <div v-if="parameterStats.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="stat in parameterStats"
        :key="stat.id"
        type="button"
        class="px-2.5 py-1.5 rounded-md text-xs font-medium border shadow-2xs flex items-center gap-2 cursor-pointer transition-all duration-200 select-none hover:shadow-sm"
        :class="[
          selectedParamId === stat.id
            ? 'bg-card text-gray-800 dark:text-gray-200 hover:scale-[1.02] border-primary font-semibold ring-2 ring-primary/20 shadow-xs'
            : 'bg-gray-50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700/60 opacity-60 hover:opacity-85'
        ]"
        :style="selectedParamId === stat.id ? { borderColor: stat.color, backgroundColor: stat.color + '12' } : {}"
        @click="selectParam(stat.id)"
      >
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
          :class="selectedParamId === stat.id ? '' : 'bg-gray-300 dark:bg-gray-600'"
          :style="selectedParamId === stat.id ? { backgroundColor: stat.color } : {}"
        ></span>
        <span class="font-semibold text-xs" :class="selectedParamId === stat.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'">
          <span v-if="stat.code" :class="selectedParamId === stat.id ? 'text-gray-500' : 'text-gray-400'">({{ stat.code }})</span>
        </span>
      </button>
    </div>

    <!-- Multi-Line Chart Container -->
    <Spin :spinning="loading">
      <div class="border border-border rounded-xl p-4 bg-card min-h-[420px] relative">
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
