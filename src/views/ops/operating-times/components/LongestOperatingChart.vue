<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Skeleton } from 'ant-design-vue';

interface OperatingItemData {
  actualOp: number;
  name: string;
  unplannedStop: number;
}

const props = defineProps<{
  data: OperatingItemData[];
  loading?: boolean;
}>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

async function renderChart() {
  if (props.loading) {
    return;
  }

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
        data: props.data.map((item) => Number(item.actualOp.toFixed(2))),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            colorStops: [
              { color: '#5ab1ef', offset: 0 },
              { color: '#1890ff', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 1,
            y: 0,
            y2: 0,
          },
        },
        name: $t('page.ops.actualOperatingTime'),
        stack: 'total',
        type: 'bar',
      },
      {
        barWidth: '55%',
        data: props.data.map((item) => -Number(item.unplannedStop.toFixed(2))),
        itemStyle: {
          borderRadius: [4, 0, 0, 4],
          color: {
            colorStops: [
              { color: '#cbd5e1', offset: 0 },
              { color: '#94a3b8', offset: 1 },
            ],
            type: 'linear',
            x: 1,
            x2: 0,
            y: 0,
            y2: 0,
          },
        },
        name: $t('page.ops.unplannedStopTime'),
        stack: 'total',
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
          res += `${p.marker} ${p.seriesName}: ${Math.abs(Number(p.value))} hrs<br/>`;
        });
        return res;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        fontSize: 10,
        formatter: (value: number) => `${Math.abs(value)} hrs`,
      },
      type: 'value',
    },
    yAxis: {
      axisLabel: { fontSize: 10 },
      axisLine: { onZero: false },
      data: props.data.map((item) => item.name),
      type: 'category',
    },
  });
}

watch(
  [() => props.data, () => props.loading],
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
    <Skeleton :loading="props.loading" active :paragraph="{ rows: 7 }">
      <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
        {{ $t('page.ops.chartLongestOperatingTitle') }}
      </h3>
      <EchartsUI ref="chartRef" />
    </Skeleton>
  </div>
</template>
