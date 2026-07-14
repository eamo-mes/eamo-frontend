<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface EquipmentDetail {
  code: string;
  id: string;
  name: string;
}

interface ChecklistDetailItem {
  checklist_id: string;
  description: string;
  id: string;
  result: 'fail' | 'pass';
}

interface ChecklistSession {
  details?: ChecklistDetailItem[];
  equipment?: EquipmentDetail | null;
  equipment_id: string | null;
  id: string;
  name?: string;
  session_date: string | null;
}

interface TrendDayItem {
  failed: number;
  passed: number;
}

interface FailEquipmentItem {
  failedCount: number;
  name: string;
}

const props = defineProps<{
  loading: boolean;
  sessions: ChecklistSession[];
}>();

const statusChartRef = ref<EchartsUIType>();
const trendChartRef = ref<EchartsUIType>();
const failChartRef = ref<EchartsUIType>();

const { renderEcharts: renderStatusChart } = useEcharts(statusChartRef);
const { renderEcharts: renderTrendChart } = useEcharts(trendChartRef);
const { renderEcharts: renderFailChart } = useEcharts(failChartRef);

function getSessionStatusText(record: ChecklistSession) {
  if (!record.details || record.details.length === 0) {
    return 'Pending';
  }
  const hasFail = record.details.some((d) => d.result === 'fail');
  return hasFail ? 'Failed' : 'Passed';
}

async function renderCharts() {
  await nextTick();
  if (
    !statusChartRef.value ||
    !trendChartRef.value ||
    !failChartRef.value ||
    props.sessions.length === 0
  ) {
    return;
  }

  const list = props.sessions;

  // 1. Status distribution (Rounded Doughnut with center label)
  const passedCount = list.filter(
    (s) => getSessionStatusText(s) === 'Passed',
  ).length;
  const failedCount = list.filter(
    (s) => getSessionStatusText(s) === 'Failed',
  ).length;
  const pendingCount = list.filter(
    (s) => getSessionStatusText(s) === 'Pending',
  ).length;
  const totalCount = passedCount + failedCount + pendingCount;

  renderStatusChart({
    color: ['#10b981', '#cbd5e1', '#3b82f6'], // Cold colors (Green, Gray, Blue)
    series: [
      {
        avoidLabelOverlap: false,
        data: [
          { name: $t('page.ops.chartPassed'), value: passedCount },
          { name: $t('page.ops.chartFailed'), value: failedCount },
          { name: $t('page.ops.chartPending'), value: pendingCount },
        ],
        itemStyle: { borderColor: '#fff', borderRadius: 8, borderWidth: 2 },
        label: {
          color: '#1e293b',
          fontSize: 18,
          fontWeight: 'bold',
          formatter: `${totalCount}\nChecklists`,
          position: 'center',
          show: true,
        },
        name: $t('page.ops.chartStatus'),
        radius: ['55%', '75%'],
        type: 'pie',
      },
    ],
    tooltip: { formatter: '{b}: {c} ({d}%)', trigger: 'item' },
  });

  // 2. Trend Chart (Area Line Chart with Gradients)
  const dayMap: Record<string, TrendDayItem> = {};
  list.forEach((s) => {
    if (!s.session_date) {
      return;
    }
    const day = s.session_date.substring(0, 10);
    if (!dayMap[day]) {
      dayMap[day] = { failed: 0, passed: 0 };
    }
    const status = getSessionStatusText(s);
    if (status === 'Passed') {
      dayMap[day]!.passed++;
    } else if (status === 'Failed') {
      dayMap[day]!.failed++;
    }
  });
  const days = Object.keys(dayMap).sort().slice(-7);
  const passedTrend = days.map((d) => dayMap[d]?.passed ?? 0);
  const failedTrend = days.map((d) => dayMap[d]?.failed ?? 0);

  renderTrendChart({
    grid: { bottom: '15%', containLabel: true, left: '3%', right: '4%', top: '5%' },
    legend: {
      bottom: '0',
      itemHeight: 10,
      itemWidth: 10,
      left: 'center',
      textStyle: { fontSize: 11 },
    },
    series: [
      {
        areaStyle: {
          color: {
            colorStops: [
              { color: '#10b981', offset: 0 },
              { color: 'rgba(16, 185, 129, 0)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
          opacity: 0.15,
        },
        color: '#10b981',
        data: passedTrend,
        lineStyle: { width: 3 },
        name: $t('page.ops.chartPassed'),
        smooth: true,
        type: 'line',
      },
      {
        areaStyle: {
          color: {
            colorStops: [
              { color: '#8892b0', offset: 0 }, // Cool gray line instead of bright red
              { color: 'rgba(136, 146, 176, 0)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
          opacity: 0.15,
        },
        color: '#8892b0',
        data: failedTrend,
        lineStyle: { width: 3 },
        name: $t('page.ops.chartFailed'),
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      boundaryGap: false,
      data: days,
      type: 'category',
    },
    yAxis: {
      minInterval: 1,
      splitLine: { lineStyle: { type: 'dashed' } },
      type: 'value',
    },
  });

  // 3. Top Failed Equipment (Horizontal Bar with Gradient Fill & Rounded Corners)
  const eqMap: Record<string, FailEquipmentItem> = {};
  list.forEach((s) => {
    const status = getSessionStatusText(s);
    if (status !== 'Failed') {
      return;
    }
    const eqName = s.equipment
      ? s.equipment.name
      : s.equipment_id || $t('page.ops.chartUnassigned');
    if (!eqMap[eqName]) {
      eqMap[eqName] = { failedCount: 0, name: eqName };
    }
    eqMap[eqName]!.failedCount++;
  });
  const sortedEq = Object.values(eqMap)
    .sort((a, b) => b.failedCount - a.failedCount)
    .slice(0, 5);
  sortedEq.reverse();
  const eqNames = sortedEq.map((x) => x.name);
  const eqFails = sortedEq.map((x) => x.failedCount);

  renderFailChart({
    grid: { bottom: '10%', containLabel: true, left: '3%', right: '8%', top: '5%' },
    series: [
      {
        barWidth: '55%',
        data: eqFails,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            colorStops: [
              { color: '#5ab1ef', offset: 0 }, // Cold blue gradient
              { color: '#1890ff', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 1,
            y: 0,
            y2: 0,
          },
        },
        name: $t('page.ops.chartFailCount'),
        type: 'bar',
      },
    ],
    tooltip: { axisPointer: { type: 'shadow' }, trigger: 'axis' },
    xAxis: { axisLabel: { fontSize: 10 }, minInterval: 1, type: 'value' },
    yAxis: { axisLabel: { fontSize: 10 }, data: eqNames, type: 'category' },
  });
}

watch(
  () => props.sessions,
  () => {
    renderCharts();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div
      class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card"
    >
      <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
        {{ $t('page.ops.chartResultTitle') }}
      </h3>
      <EchartsUI ref="statusChartRef" />
    </div>
    <div
      class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card"
    >
      <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
        {{ $t('page.ops.chartTrendTitle') }}
      </h3>
      <EchartsUI ref="trendChartRef" />
    </div>
    <div
      class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card"
    >
      <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
        {{ $t('page.ops.chartFailTitle') }}
      </h3>
      <EchartsUI ref="failChartRef" />
    </div>
  </div>
</template>
