<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Spin } from 'ant-design-vue';

const props = defineProps<{
  stats: any;
  loading: boolean;
}>();

const lineChartRef = ref<EchartsUIType>();
const pieChartRef = ref<EchartsUIType>();
const { renderEcharts: renderLineChart } = useEcharts(lineChartRef);
const { renderEcharts: renderPieChart } = useEcharts(pieChartRef);

async function updateCharts() {
  await nextTick();
  if (!lineChartRef.value || !pieChartRef.value || !props.stats) {
    return;
  }

  const displayDates = (props.stats.daily_stats || []).map((d: any) => {
    return dayjs(d.date).format('DD/MM');
  });
  const completionPercentages = (props.stats.daily_stats || []).map((d: any) => {
    const total = Number(d.total_checklists || 0);
    const passed = Number(d.passed || 0);
    return total > 0 ? Math.round((passed / total) * 100) : 0;
  });

  const topErrorsBlueGradient = {
    colorStops: [
      { color: 'rgba(64, 169, 255, 0.42)', offset: 0 },
      { color: 'rgba(64, 169, 255, 0)', offset: 1 },
    ],
    type: 'linear' as const,
    x: 0,
    x2: 0,
    y: 0,
    y2: 1,
  };

  renderLineChart({
    grid: {
      bottom: '3%',
      containLabel: true,
      left: '3%',
      right: '4%',
      top: '12%',
    },
    xAxis: {
      data: displayDates,
      type: 'category',
      axisLine: {
        lineStyle: {
          color: '#cbd5e1',
        },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#64748b',
      },
    },
    yAxis: {
      max: 100,
      min: 0,
      type: 'value',
      axisLabel: {
        color: '#64748b',
        formatter: '{value}%',
      },
      splitLine: {
        lineStyle: {
          color: '#e2e8f0',
        },
      },
    },
    series: [
      {
        data: completionPercentages,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#1890ff',
        },
        lineStyle: {
          color: '#1890ff',
          width: 3,
        },
        areaStyle: {
          color: topErrorsBlueGradient,
        },
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#1e293b',
      },
      trigger: 'axis',
      formatter: '{b}: {c}%',
    },
  });

  const passed = props.stats.today?.passed || 0;
  const failed = props.stats.today?.failed || 0;
  const pending = props.stats.today?.pending || 0;
  const totalToday = props.stats.today?.total_checklists || 0;
  const completedToday = passed + failed;

  const pieData = [
    { name: $t('page.ops.chartPassed'), value: passed },
    { name: $t('page.ops.chartFailed'), value: failed },
    { name: $t('page.ops.chartPending'), value: pending },
  ];

  renderPieChart({
    color: ['#5ab1ef', '#67e0e3', '#818cf8'],
    series: [
      {
        avoidLabelOverlap: false,
        center: ['50%', '50%'],
        data: pieData,
        emphasis: {
          label: {
            fontSize: 16,
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
          fontSize: 14,
          fontWeight: 'bold',
          formatter: `${completedToday} / ${totalToday}\n\nChecklists completed`,
          position: 'center',
          show: true,
        },
        radius: ['55%', '75%'],
        type: 'pie',
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#1e293b',
      },
      formatter: '{b} : {c} ({d}%)',
      trigger: 'item',
    },
  });
}

watch(
  () => props.stats,
  () => {
    updateCharts();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="bg-card border border-border rounded-xl p-4 shadow-sm relative min-h-[350px]">
    <div class="font-semibold text-base mb-4 flex items-center gap-2">
      Checklist Charts
    </div>

    <Spin :spinning="loading">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EchartsUI ref="lineChartRef" height="300px" />
        <EchartsUI ref="pieChartRef" height="300px" />
      </div>
    </Spin>
  </div>
</template>
