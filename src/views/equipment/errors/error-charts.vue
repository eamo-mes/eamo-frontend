<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Spin } from 'ant-design-vue';

interface EquipmentOption {
  code: string;
  id: string;
  name: string;
}

interface ErrorItem {
  equipment?: EquipmentOption[];
  fix?: string;
  id: string;
  name: string;
  protection_measures?: string;
  reason?: string;
}

interface MappedItem {
  count: number;
  name: string;
}

const props = defineProps<{
  errors: ErrorItem[];
  loading: boolean;
}>();

const barChartRef = ref<EchartsUIType>();
const pieChartRef = ref<EchartsUIType>();
const { renderEcharts: renderBarChart } = useEcharts(barChartRef);
const { renderEcharts: renderPieChart } = useEcharts(pieChartRef);

async function updateCharts() {
  await nextTick();
  if (!barChartRef.value || !pieChartRef.value) {
    return;
  }

  const data = props.errors;

  // Count associated equipments
  const mapped: MappedItem[] = data.map((d: ErrorItem) => ({
    count: d.equipment ? d.equipment.length : 0,
    name: d.name,
  }));

  // Sort ascending for chart (horizontal bar chart places first item at the bottom)
  mapped.sort((a: MappedItem, b: MappedItem) => a.count - b.count);

  const names = mapped.map((d: MappedItem) => d.name);
  const counts = mapped.map((d: MappedItem) => d.count);
  const totalErrors = counts.reduce((sum: number, val: number) => sum + val, 0);

  // Existing Top Most Frequent Errors palette.
  const chartColors = [
    '#5ab1ef',
    '#b6a2de',
    '#67e0e3',
    '#2ec7c9',
    '#38bdf8',
    '#818cf8',
    '#c084fc',
    '#34d399',
  ];
  const chartGradients = [
    { end: '#1890ff', start: '#40a9ff' },
    { end: '#14b8a6', start: '#2dd4bf' },
    { end: '#9333ea', start: '#c084fc' },
    { end: '#2ec7c9', start: '#67e0e3' },
    { end: '#0284c7', start: '#38bdf8' },
    { end: '#4f46e5', start: '#818cf8' },
  ];

  renderBarChart({
    grid: {
      bottom: '3%',
      containLabel: true,
      left: '3%',
      right: '4%',
    },
    series: [
      {
        data: counts,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: (params: { dataIndex: number }) => {
            const g =
              chartGradients[params.dataIndex % chartGradients.length] ??
              chartGradients[0];
            return {
              colorStops: [
                { color: g!.start, offset: 0 },
                { color: g!.end, offset: 1 },
              ],
              type: 'linear',
              x: 0,
              x2: 1,
              y: 0,
              y2: 0,
            };
          },
        },
        name: $t('page.equipment.chartErrorCount'),
        type: 'bar',
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      axisPointer: { type: 'shadow' },
      trigger: 'axis',
    },
    xAxis: {
      minInterval: 1,
      type: 'value',
    },
    yAxis: {
      axisLabel: {
        fontSize: 11,
        overflow: 'truncate',
        width: 150,
      },
      data: names,
      type: 'category',
    },
  });

  renderPieChart({
    color: chartColors,
    series: [
      {
        avoidLabelOverlap: false,
        center: ['50%', '50%'],
        data: mapped.map((d: MappedItem) => ({
          name: d.name,
          value: d.count,
        })),
        emphasis: {
          label: {
            fontSize: 18,
            fontWeight: 'bold',
            show: true,
          },
        },
        itemStyle: {
          borderColor: '#fff',
          borderRadius: 8,
          borderWidth: 2,
        },
        label: {
          color: '#1e293b',
          fontSize: 18,
          fontWeight: 'bold',
          formatter: `${totalErrors}\nErrors`,
          position: 'center',
          show: true,
        },
        name: $t('page.equipment.chartErrorCount'),
        radius: ['55%', '75%'],
        type: 'pie',
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      formatter: '{a} <br/>{b} : {c} ({d}%)',
      trigger: 'item',
    },
  });
}

watch(
  () => props.errors,
  () => {
    updateCharts();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div
    class="bg-card border-border rounded-xl border p-4 shadow-sm relative min-h-[350px]"
  >
    <div class="font-semibold text-base mb-4 flex items-center gap-2">
      <span class="w-1.5 h-4 rounded-full"></span>
      {{ $t('page.equipment.chartErrorTitle') }}
    </div>
    <Spin :spinning="loading">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EchartsUI ref="barChartRef" height="300px" />
        <EchartsUI ref="pieChartRef" height="300px" />
      </div>
    </Spin>
  </div>
</template>
