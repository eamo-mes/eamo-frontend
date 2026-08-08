<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue';
import { Empty, Spin } from 'ant-design-vue';
import dayjs from 'dayjs';
import { $t } from '#/locales';
import { usePreferences } from '@vben/preferences';
import { EchartsUI, useEcharts, type EchartsUIType } from '@vben/plugins/echarts';
import type { ParameterLogItem, ParameterOption } from '#/views/ops/parameter-log/types';

const props = withDefaults(
  defineProps<{
    items: ParameterLogItem[];
    parameterInfo?: ParameterOption | null;
    unitName?: string;
    loading?: boolean;
    showLimits?: boolean;
  }>(),
  {
    showLimits: false,
    loading: false,
  }
);

const { isDark } = usePreferences();
const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

async function updateChart() {
  await nextTick();
  if (!chartRef.value || props.items.length === 0) return;

  const doubledDates: string[] = [];
  const doubledValues: number[] = [];

  for (let i = 0; i < props.items.length; i++) {
    const currItem = props.items[i]!;
    const currTime = currItem.recorded_at || currItem.created_at;
    const currVal = isNaN(Number(currItem.value)) ? 0 : Number(currItem.value);

    const currDayjs = dayjs(currTime);
    doubledDates.push(currDayjs.format('YYYY-MM-DD'));
    doubledValues.push(currVal);

    if (i < props.items.length - 1) {
      const nextItem = props.items[i + 1]!;
      const nextTime = nextItem.recorded_at || nextItem.created_at;
      const nextVal = isNaN(Number(nextItem.value)) ? 0 : Number(nextItem.value);
      const nextDayjs = dayjs(nextTime);

      const midTimeMs = Math.round((currDayjs.valueOf() + nextDayjs.valueOf()) / 2);
      const midVal = Number(((currVal + nextVal) / 2).toFixed(2));

      doubledDates.push(dayjs(midTimeMs).format('YYYY-MM-DD'));
      doubledValues.push(midVal);
    }
  }

  const axisTextColor = isDark.value ? '#cbd5e1' : '#4b5563';
  const textColor = isDark.value ? '#f8fafc' : '#1e293b';
  const splitLineColor = isDark.value ? 'rgba(255,255,255,0.1)' : '#e2e8f0';

  const unitLabel = props.unitName ? ` (${props.unitName})` : '';

  const markLineData: Record<string, unknown>[] = [];
  const pInfo = props.parameterInfo;

  if (pInfo && props.showLimits) {
    if (pInfo.standard_max !== null && pInfo.standard_max !== undefined) {
      const maxVal = Number(pInfo.standard_max);
      if (!isNaN(maxVal)) {
        markLineData.push({
          name: 'Standard Max',
          yAxis: maxVal,
          label: {
            show: true,
            formatter: `Max: ${maxVal}${props.unitName ? ' ' + props.unitName : ''}`,
            position: 'end',
            color: '#ef4444',
            fontSize: 10,
            fontWeight: 'bold',
          },
          lineStyle: {
            color: '#ef4444',
            type: 'dashed',
            width: 1.5,
          },
        });
      }
    }

    if (pInfo.standard !== null && pInfo.standard !== undefined) {
      const stdVal = Number(pInfo.standard);
      if (!isNaN(stdVal)) {
        markLineData.push({
          name: 'Standard',
          yAxis: stdVal,
          label: {
            show: true,
            formatter: `Std: ${stdVal}${props.unitName ? ' ' + props.unitName : ''}`,
            position: 'end',
            color: '#10b981',
            fontSize: 10,
            fontWeight: 'bold',
          },
          lineStyle: {
            color: '#10b981',
            type: 'dashed',
            width: 1.5,
          },
        });
      }
    }

    if (pInfo.standard_min !== null && pInfo.standard_min !== undefined) {
      const minVal = Number(pInfo.standard_min);
      if (!isNaN(minVal)) {
        markLineData.push({
          name: 'Standard Min',
          yAxis: minVal,
          label: {
            show: true,
            formatter: `Min: ${minVal}${props.unitName ? ' ' + props.unitName : ''}`,
            position: 'end',
            color: '#ef4444',
            fontSize: 10,
            fontWeight: 'bold',
          },
          lineStyle: {
            color: '#ef4444',
            type: 'dashed',
            width: 1.5,
          },
        });
      }
    }
  }

  renderEcharts({
    grid: {
      left: '1.5%',
      right: '6%',
      bottom: '8%',
      top: '7%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: unknown) => {
        const list = params as { name: string; value: number }[];
        if (!Array.isArray(list) || list.length === 0) return '';
        const item = list[0];
        if (!item) return '';
        const pName = props.parameterInfo?.name || $t('page.ops.value');
        return `<strong>${item.name}</strong><br/>${pName}: <strong>${item.value}${props.unitName ? ' ' + props.unitName : ''}</strong>`;
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: doubledDates,
      axisLabel: {
        show: true,
        color: axisTextColor,
        fontSize: 9,
        rotate: doubledDates.length > 8 ? 25 : 0,
        hideOverlap: true,
      },
      axisTick: { show: true, alignWithLabel: true },
      axisLine: { show: true },
    },
    yAxis: {
      type: 'value',
      name: `${$t('page.ops.value')}${unitLabel}`,
      nameTextStyle: { color: axisTextColor, fontSize: 11 },
      axisLabel: { color: axisTextColor, fontSize: 11 },
      splitLine: {
        lineStyle: { type: 'dashed', color: splitLineColor, opacity: 0.7 },
      },
    },
    series: [
      {
        name: props.parameterInfo?.name || $t('page.ops.value'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        symbol: 'none',
        itemStyle: {
          color: '#1890ff',
        },
        lineStyle: {
          width: 2.5,
          color: '#1890ff',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.25)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
            ],
          },
        },
        markLine: markLineData.length > 0 ? { symbol: ['none', 'none'], data: markLineData } : undefined,
        data: doubledValues,
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: textColor,
    },
  });
}

watch(
  [() => props.items, () => props.parameterInfo, () => props.showLimits, () => isDark.value],
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
    <div v-else class="py-8 flex justify-center">
      <Empty :description="$t('page.ops.chartNoData')" />
    </div>
  </Spin>
</template>
