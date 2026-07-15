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

  // 1. Line Chart Data: % completion over the last 1 week (7 days)
  const displayDates = (props.stats.daily_stats || []).map((d: any) => {
    return dayjs(d.date).format('DD/MM');
  });
  const completionPercentages = (props.stats.daily_stats || []).map((d: any) => {
    return d.completion_rate;
  });

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
    },
    yAxis: {
      max: 100,
      min: 0,
      type: 'value',
      axisLabel: {
        formatter: '{value}%',
      },
    },
    series: [
      {
        data: completionPercentages,
        type: 'line',
        smooth: true,
        itemStyle: {
          color: '#3b82f6',
        },
        areaStyle: {
          color: {
            colorStops: [
              { color: 'rgba(59, 130, 246, 0.4)', offset: 0 },
              { color: 'rgba(59, 130, 246, 0)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
        },
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c}%',
    },
  });

  // 2. Pie Chart Data: breakdown of today's checklist results
  const passed = props.stats.today?.passed || 0;
  const failed = props.stats.today?.failed || 0;
  const pending = props.stats.today?.pending || 0;
  const totalToday = props.stats.today?.total_checklists || 0;

  const pieData = [
    { name: $t('page.ops.chartPassed'), value: passed },
    { name: $t('page.ops.chartFailed'), value: failed },
    { name: $t('page.ops.chartPending'), value: pending },
  ];

  renderPieChart({
    color: ['#10b981', '#ef4444', '#f59e0b'],
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
          formatter: `${totalToday}\nChecklists`,
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
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- Line Chart Panel -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm relative min-h-[350px]">
      <div class="font-semibold text-base mb-4 flex items-center gap-2">
        <span class="w-1.5 h-4 rounded-full bg-blue-500"></span>
        {{ $t('page.ops.chartTrendTitle') }}
      </div>
      <Spin :spinning="loading">
        <EchartsUI ref="lineChartRef" height="280px" />
      </Spin>
    </div>

    <!-- Pie Chart Panel -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm relative min-h-[350px]">
      <div class="font-semibold text-base mb-4 flex items-center gap-2">
        <span class="w-1.5 h-4 rounded-full bg-emerald-500"></span>
        {{ $t('page.ops.chartResultTitle') }} ({{ $t('page.dashboard.todayLabel') }})
      </div>
      <Spin :spinning="loading">
        <EchartsUI ref="pieChartRef" height="280px" />
      </Spin>
    </div>
  </div>
</template>
