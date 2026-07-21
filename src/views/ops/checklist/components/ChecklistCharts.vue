<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Spin } from 'ant-design-vue';

interface DailyStat {
  date: string;
  total_checklists?: number | string;
  passed?: number | string;
}

interface TodayStat {
  passed?: number | string;
  failed?: number | string;
  pending?: number | string;
  total_checklists?: number | string;
}

interface ChecklistStats {
  daily_stats?: DailyStat[];
  today?: TodayStat;
}

const props = defineProps<{
  stats: ChecklistStats | null;
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

  const displayDates = (props.stats.daily_stats || []).map((d: DailyStat) => {
    return dayjs(d.date).format('DD/MM');
  });
  const completionPercentages = (props.stats.daily_stats || []).map((d: DailyStat) => {
    const total = Number(d.total_checklists || 0);
    const passed = Number(d.passed || 0);
    return total > 0 ? Math.round((passed / total) * 100) : 0;
  });

  const lineAreaGradient = {
    colorStops: [
      { color: 'rgba(24, 144, 255, 0.42)', offset: 0 },
      { color: 'rgba(24, 144, 255, 0)', offset: 1 },
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
          color: lineAreaGradient,
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

  const passed = Number(props.stats.today?.passed || 0);
  const failed = Number(props.stats.today?.failed || 0);
  const pending = Number(props.stats.today?.pending || 0);
  const totalToday = Number(props.stats.today?.total_checklists || 0);
  const completedToday = passed + failed;

  const pieData = [
    { name: $t('page.ops.chartPassed'), value: passed },
    { name: $t('page.ops.chartFailed'), value: failed },
    { name: $t('page.ops.chartPending'), value: pending },
  ];

  renderPieChart({
    color: ['#1890ff', '#f87171', '#cbd5e1'],
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
          formatter: `${completedToday} / ${totalToday}\n\n${$t('page.ops.chartChecklistCompleted')}`,
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
  <div class="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-border pb-3">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">
        {{ $t('page.ops.chartChecklistTitle') }}
      </h3>
    </div>

    <Spin :spinning="props.loading">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Line Chart Card -->
        <div class="border border-border rounded-xl p-4">
          <div class="mb-1">
            <h5 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
              {{ $t('page.ops.chartTrendTitle') }}
            </h5>
            <p class="text-[11px] text-muted-foreground mt-0.5 m-0">
              {{ $t('page.ops.chartChecklistTrendDesc') }}
            </p>
          </div>
          <EchartsUI ref="lineChartRef" height="300px" />
        </div>

        <!-- Pie Chart Card -->
        <div class="border border-border rounded-xl p-4">
          <div class="mb-1">
            <h5 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
              {{ $t('page.ops.chartResultTitle') }}
            </h5>
            <p class="text-[11px] text-muted-foreground mt-0.5 m-0">
              {{ $t('page.ops.chartChecklistTodayDesc') }}
            </p>
          </div>
          <EchartsUI ref="pieChartRef" height="300px" />
        </div>
      </div>
    </Spin>
  </div>
</template>
