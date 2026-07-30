<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { usePreferences } from '@vben/preferences';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Empty, Spin } from 'ant-design-vue';

interface OperatingItemData {
  actualOp: number;
  name: string;
  unplannedStop: number;
}

const props = defineProps<{
  data: OperatingItemData[];
  loading?: boolean;
}>();

const { isDark } = usePreferences();
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

  const axisTextColor = isDark.value ? '#f1f5f9' : '#334155';
  const textColor = isDark.value ? '#cbd5e1' : '#4b5563';

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
          color: '#1890ff',
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
          color: '#94a3b8',
        },
        name: $t('page.ops.unplannedStopTime'),
        stack: 'total',
        type: 'bar',
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: textColor,
    },
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
        color: axisTextColor,
        fontSize: 10,
        formatter: (value: number) => `${Math.abs(value)} hrs`,
      },
      type: 'value',
    },
    yAxis: {
      axisLabel: { color: axisTextColor, fontSize: 10 },
      axisLine: { onZero: false },
      data: props.data.map((item) => item.name),
      type: 'category',
    },
  });
}

watch(
  [() => props.data, () => props.loading, () => isDark.value],
  () => {
    renderChart();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="border border-border rounded-xl p-4 bg-white dark:bg-gray-900 flex flex-col h-[360px]">
    <div class="mb-2">
      <h5 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
        {{ $t('page.ops.chartLongestOperatingTitle') }}
      </h5>
    </div>
    <Spin :spinning="props.loading">
      <div v-if="props.data && props.data.length > 0" class="h-[290px]">
        <EchartsUI ref="chartRef" height="290px" />
      </div>
      <div v-else class="py-12 flex justify-center">
        <Empty :description="$t('page.ops.noChartData')" />
      </div>
    </Spin>
  </div>
</template>

