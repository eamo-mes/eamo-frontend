<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { usePreferences } from '@vben/preferences';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Empty, Spin } from 'ant-design-vue';

const props = withDefaults(defineProps<{
  avgValue: number;
  compact?: boolean;
  loading?: boolean;
}>(), {
  compact: false,
});

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

  const remainingValue = Number((100 - props.avgValue).toFixed(2));
  const labelColor = isDark.value ? '#f8fafc' : '#1e293b';
  const textColor = isDark.value ? '#cbd5e1' : '#4b5563';
  const pieBorderColor = isDark.value ? '#0f172a' : '#ffffff';

  renderEcharts({
    color: ['#3b82f6', isDark.value ? '#334155' : '#e2e8f0'],
    series: [
      {
        avoidLabelOverlap: false,
        data: [
          { name: $t('page.ops.chartAvailable'), value: props.avgValue },
          { name: $t('page.ops.chartUnavailable'), value: remainingValue },
        ],
        itemStyle: {
          borderColor: pieBorderColor,
          borderRadius: 8,
          borderWidth: 2,
        },
        label: {
          color: labelColor,
          fontSize: 26,
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
      color: textColor,
    },
    tooltip: {
      formatter: '{b}: {c}%',
      trigger: 'item',
    },
  });
}

watch(
  [() => props.avgValue, () => props.loading, () => isDark.value],
  () => {
    renderChart();
  },
  { immediate: true },
);
</script>

<template>
  <div :class="['border border-border rounded-xl p-4 bg-card flex flex-col', props.compact ? 'h-[240px]' : 'h-[360px]']">
    <div class="mb-2">
      <h5 class="text-sm font-bold text-foreground uppercase tracking-wider m-0">
        {{ $t('page.ops.chartAvgAvailabilityTitle') }}
      </h5>
    </div>
    <Spin :spinning="props.loading">
      <div v-if="props.avgValue !== undefined && props.avgValue !== null" :class="props.compact ? 'h-[180px]' : 'h-[290px]'">
        <EchartsUI ref="chartRef" :height="props.compact ? '180px' : '290px'" />
      </div>
      <div v-else class="py-12 flex justify-center">
        <Empty :description="$t('page.ops.noChartData')" />
      </div>
    </Spin>
  </div>
</template>

