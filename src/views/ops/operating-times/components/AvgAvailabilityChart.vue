<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Empty, Spin } from 'ant-design-vue';

const props = defineProps<{
  avgValue: number;
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
        radius: ['55%', '78%'],
        type: 'pie',
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#4b5563',
    },
    tooltip: {
      formatter: '{b}: {c}%',
      trigger: 'item',
    },
  });
}

watch(
  [() => props.avgValue, () => props.loading],
  () => {
    renderChart();
  },
  { immediate: true },
);
</script>

<template>
  <div class="border border-border rounded-xl p-4 bg-white dark:bg-gray-900 flex flex-col h-[360px]">
    <div class="mb-2">
      <h5 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
        {{ $t('page.ops.chartAvgAvailabilityTitle') }}
      </h5>
    </div>
    <Spin :spinning="props.loading">
      <div v-if="props.avgValue !== undefined && props.avgValue !== null" class="h-[290px]">
        <EchartsUI ref="chartRef" height="290px" />
      </div>
      <div v-else class="py-12 flex justify-center">
        <Empty :description="$t('page.ops.noChartData')" />
      </div>
    </Spin>
  </div>
</template>

