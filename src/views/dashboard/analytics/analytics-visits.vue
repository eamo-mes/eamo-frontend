<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue';
import { Empty, Spin } from 'ant-design-vue';
import dayjs from 'dayjs';
import { usePreferences } from '@vben/preferences';
import { EchartsUI, useEcharts, type EchartsUIType } from '@vben/plugins/echarts';
import type { ParameterLogItem, ParameterOption } from '#/views/ops/parameter-log/types';

const props = defineProps<{
  items: ParameterLogItem[];
  parameterInfo?: ParameterOption | null;
  unitName?: string;
  loading?: boolean;
}>();

const { isDark } = usePreferences();
const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

async function updateChart() {
  await nextTick();
  if (!chartRef.value || props.items.length === 0) return;

  const dates = props.items.map((item) =>
    item.recorded_at
      ? dayjs(item.recorded_at).format('YYYY-MM-DD HH:mm')
      : dayjs(item.created_at).format('YYYY-MM-DD HH:mm')
  );

  const values = props.items.map((item) => {
    const num = Number(item.value);
    return isNaN(num) ? 0 : num;
  });

  const axisTextColor = isDark.value ? '#cbd5e1' : '#4b5563';
  const textColor = isDark.value ? '#f8fafc' : '#1e293b';
  const splitLineColor = isDark.value ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
  const unitLabel = props.unitName ? ` (${props.unitName})` : '';

  renderEcharts({
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '12%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = params as { name: string; value: number }[];
        if (!Array.isArray(list) || list.length === 0) return '';
        const item = list[0];
        if (!item) return '';
        const pName = props.parameterInfo?.name || 'Giá trị';
        return `<strong>${item.name}</strong><br/>${pName}: <strong>${item.value}${props.unitName ? ' ' + props.unitName : ''}</strong>`;
      },
    },
    xAxis: {
      type: 'category',
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
      name: `Giá trị${unitLabel}`,
      nameTextStyle: { color: axisTextColor, fontSize: 11 },
      axisLabel: { color: axisTextColor, fontSize: 11 },
      splitLine: {
        lineStyle: { type: 'dashed', color: splitLineColor, opacity: 0.7 },
      },
    },
    series: [
      {
        name: props.parameterInfo?.name || 'Giá trị',
        type: 'bar',
        barMaxWidth: 50,
        itemStyle: {
          color: '#1890ff',
          borderRadius: [4, 4, 0, 0],
        },
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
  [() => props.items, () => props.parameterInfo, () => isDark.value],
  () => {
    updateChart();
  },
  { deep: true, immediate: true }
);
</script>

<template>
  <Spin :spinning="props.loading || false">
    <div v-if="props.items && props.items.length > 0" class="h-[340px]">
      <EchartsUI ref="chartRef" height="340px" />
    </div>
    <div v-else class="py-12 flex justify-center">
      <Empty description="Không có dữ liệu đo đạc" />
    </div>
  </Spin>
</template>
