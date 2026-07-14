<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const props = defineProps<{
  avgValue: number;
}>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

async function renderChart() {
  await nextTick();
  if (!chartRef.value) {
    return;
  }

  const remainingValue = Number((100 - props.avgValue).toFixed(2));

  renderEcharts({
    color: ['#1890ff', '#cbd5e1'],
    series: [
      {
        avoidLabelOverlap: false,
        data: [
          { name: $t('page.ops.chartAvailable'), value: props.avgValue },
          { name: $t('page.ops.chartUnavailable'), value: remainingValue },
        ],
        itemStyle: {
          borderColor: '#fff',
          borderRadius: 8,
          borderWidth: 2,
        },
        label: {
          color: '#1e293b',
          fontSize: 22,
          fontWeight: 'bold',
          formatter: `${props.avgValue}%`,
          position: 'center',
          show: true,
        },
        labelLine: {
          show: false,
        },
        name: $t('page.ops.availabilityFactor'),
        radius: ['55%', '75%'],
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c}%',
      trigger: 'item',
    },
  });
}

watch(
  () => props.avgValue,
  () => {
    renderChart();
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card"
  >
    <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
      {{ $t('page.ops.chartAvgAvailabilityTitle') }}
    </h3>
    <EchartsUI ref="chartRef" />
  </div>
</template>
