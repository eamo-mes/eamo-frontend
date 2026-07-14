<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface MaintenanceItemData {
  name: string;
  remaining: number;
}

const props = defineProps<{
  data: MaintenanceItemData[];
}>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

async function renderChart() {
  await nextTick();
  if (!chartRef.value) {
    return;
  }

  renderEcharts({
    grid: {
      bottom: '10%',
      containLabel: true,
      left: '3%',
      right: '8%',
      top: '5%',
    },
    series: [
      {
        barWidth: '55%',
        data: props.data.map((item) => item.remaining),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            colorStops: [
              { color: '#2ec7c9', offset: 0 },
              { color: '#67e0e3', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 1,
            y: 0,
            y2: 0,
          },
        },
        name: $t('page.ops.chartRemainingHours') || 'Thời gian còn lại',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = params as {
          marker: string;
          name: string;
          seriesName: string;
          value: number;
        }[];
        if (!Array.isArray(list) || list.length === 0) {
          return '';
        }
        let res = `${list[0]?.name}<br/>`;
        list.forEach((p) => {
          res += `${p.marker} ${p.seriesName}: ${p.value} hrs<br/>`;
        });
        return res;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        fontSize: 10,
        formatter: '{value} hrs',
      },
      type: 'value',
    },
    yAxis: {
      axisLabel: { fontSize: 10 },
      data: props.data.map((item) => item.name),
      type: 'category',
    },
  });
}

watch(
  () => props.data,
  () => {
    renderChart();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div
    class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card"
  >
    <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
      {{ $t('page.ops.chartMaintenanceStatusTitle') }}
    </h3>
    <EchartsUI ref="chartRef" />
  </div>
</template>
