<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Spin } from 'ant-design-vue';
import dayjs from 'dayjs';
import { requestClient } from '#/api/request';
import { $t } from '#/locales';
import type { ScheduleRow, ChecklistSession } from '../types';

const props = defineProps<{
  activeTab: 'maintenance' | 'checklist' | 'error-monitoring';
  schedules: ScheduleRow[];
}>();

const lineChartRef = ref<EchartsUIType>();
const donutChartRef = ref<EchartsUIType>();

const { renderEcharts: renderLineChart } = useEcharts(lineChartRef);
const { renderEcharts: renderDonutChart } = useEcharts(donutChartRef);

const loading = ref(false);
const checklistSessions = ref<ChecklistSession[]>([]);

// Fetch checklist sessions for the current month when tab is 'checklist'
async function fetchChecklistData(): Promise<void> {
  loading.value = true;
  try {
    const startOfMonth = dayjs().startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
    const endOfMonth = dayjs().endOf('month').add(7, 'day').format('YYYY-MM-DD');

    const raw = await requestClient.get('/v1/checklist-sessions', {
      params: {
        include_details: true,
        start_date: startOfMonth,
        end_date: endOfMonth,
        per_page: 1000,
      },
    });

    const responseData =
      (raw as { data?: ChecklistSession[]; items?: ChecklistSession[] })?.data ??
      (raw as { items?: ChecklistSession[] })?.items ??
      (Array.isArray(raw) ? raw : []);

    checklistSessions.value = Array.isArray(responseData) ? (responseData as ChecklistSession[]) : [];
  } catch {
    checklistSessions.value = [];
  } finally {
    loading.value = false;
  }
}

// Compute daily completion data for current month (1..daysInMonth)
const chartData = computed(() => {
  const now = dayjs();
  const daysInMonth = now.daysInMonth();
  const days: string[] = [];
  const rates: number[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${d}`);
    const dateStr = now.date(d).format('YYYY-MM-DD');

    if (props.activeTab === 'maintenance') {
      const daySchedules = props.schedules.filter((s) => {
        const sDate = s.date ? dayjs(s.date).format('YYYY-MM-DD') : '';
        return sDate === dateStr;
      });

      if (daySchedules.length === 0) {
        rates.push(0);
      } else {
        const completed = daySchedules.filter((s) =>
          s.result === 'Completed' || s.result === 'Pass' || s.result === 'completed'
        ).length;
        rates.push(Math.round((completed / daySchedules.length) * 100));
      }
    } else {
      // Checklist tab
      let totalItemsOnDay = 0;
      let completedItemsOnDay = 0;

      for (const session of checklistSessions.value) {
        const schedules = session.schedules ?? [];
        if (schedules.length > 0) {
          for (const schedule of schedules) {
            if (schedule.date && schedule.date.startsWith(dateStr)) {
              totalItemsOnDay++;
              const logs = schedule.logs ?? [];
              const hasCompletedLog = logs.some(
                (l) => l.status === 'completed' || l.result === 'pass'
              );
              if (hasCompletedLog) {
                completedItemsOnDay++;
              }
            }
          }
        } else {
          const sessionDate = session.session_date?.slice(0, 10) || session.created_at?.slice(0, 10);
          if (sessionDate === dateStr) {
            const details = session.details ?? [];
            if (details.length > 0) {
              for (const detail of details) {
                totalItemsOnDay++;
                const logs = (detail as { logs?: Array<{ status?: string; result?: string }> }).logs ?? [];
                const hasCompletedLog = logs.some(
                  (l) => l.status === 'completed' || l.result === 'pass'
                );
                const detailObj = detail as { result?: string };
                if (hasCompletedLog || detailObj.result === 'pass') {
                  completedItemsOnDay++;
                }
              }
            } else {
              totalItemsOnDay++;
              const sessionObj = session as { logs?: Array<unknown> };
              if (sessionObj.logs && sessionObj.logs.length > 0) {
                completedItemsOnDay++;
              }
            }
          }
        }
      }

      rates.push(
        totalItemsOnDay > 0 ? Math.round((completedItemsOnDay / totalItemsOnDay) * 100) : 0
      );
    }
  }

  // Today's rate
  const todayDay = now.date();
  const todayRate = rates[todayDay - 1] ?? 0;
  const dayPrefix = $t('page.ops.todayCompletionTitle') || 'NGÀY';

  return {
    days,
    rates,
    todayDay,
    todayRate,
    todayLabel: `${dayPrefix} ${now.format('D/M')}`,
    todaySubtext: `${dayPrefix} ${now.format('D')}`,
  };
});
async function updateCharts(): Promise<void> {
  loading.value = true;
  await nextTick();
  if (!lineChartRef.value || !donutChartRef.value) {
    loading.value = false;
    return;
  }

  const data = chartData.value;
  const dayText = $t('page.ops.todayCompletionTitle') || 'Ngày';
  const completedText = $t('page.dashboard.statusCompleted') || 'Hoàn thành';
  const pendingText = $t('page.dashboard.statusPending') || 'Chưa hoàn thành';
  const completionRateText = $t('page.ops.completionRateLabel') || 'Tỷ lệ hoàn thành';

  // 1. Line / Area Chart with Vben Primary Blue Palette (#1890ff)
  renderLineChart({
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '12%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const item = Array.isArray(params)
          ? (params as Array<{ name: string; value: number }>)[0]
          : (params as { name: string; value: number });
        if (!item) return '';
        return `<strong>${dayText} ${item.name}</strong><br/>${completionRateText}: <strong>${item.value}%</strong>`;
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.days,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value}%',
        color: '#64748b',
        fontSize: 11,
      },
      splitLine: { lineStyle: { color: 'rgba(226, 232, 240, 0.6)', type: 'dashed' } },
    },
    series: [
      {
        name: completedText,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: true,
        itemStyle: {
          color: '#1890ff',
        },
        lineStyle: {
          color: '#1890ff',
          width: 2.5,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.35)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
            ],
          },
        },
        data: data.rates,
      },
    ],
  });

  // 2. Donut Pie Chart following Vben & Rule 6 Standard Radius (['55%', '78%'])
  renderDonutChart({
    color: ['#1890ff', '#cbd5e1'],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#4b5563',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}%',
    },
    legend: {
      show: true,
      bottom: '0',
      left: 'center',
      icon: 'circle',
      textStyle: {
        color: '#64748b',
        fontSize: 11,
      },
    },
    series: [
      {
        name: completedText,
        type: 'pie',
        radius: ['55%', '78%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'center',
          formatter: `{val|${data.todayRate}%}\n{sub|${data.todaySubtext}}`,
          rich: {
            val: {
              fontSize: 26,
              fontWeight: 'bold',
              color: '#111827',
              lineHeight: 32,
            },
            sub: {
              fontSize: 12,
              color: '#64748b',
              fontWeight: '500',
            },
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          {
            value: data.todayRate,
            name: completedText,
            itemStyle: { color: '#1890ff' },
          },
          {
            value: Math.max(0, 100 - data.todayRate),
            name: pendingText,
            itemStyle: { color: '#cbd5e1' },
          },
        ],
      },
    ],
  });

  loading.value = false;
}

watch(
  () => props.activeTab,
  (newTab) => {
    if (newTab === 'checklist') {
      fetchChecklistData();
    } else {
      updateCharts();
    }
  },
  { immediate: true }
);

watch(
  [() => props.schedules, checklistSessions, chartData],
  () => {
    updateCharts();
  },
  { deep: true }
);

onMounted(() => {
  if (props.activeTab === 'checklist') {
    fetchChecklistData();
  } else {
    updateCharts();
  }
});
</script>

<template>
  <div class="border border-border rounded-xl p-4 bg-card shadow-sm mb-4">
    <Spin :spinning="loading">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
        <!-- Left 3 cols: Area Line Chart -->
        <div class="lg:col-span-3">
          <div class="text-xs font-bold text-foreground uppercase tracking-wider mb-1">
            {{ $t('page.ops.dailyCompletionChartTitle') || 'BIỂU ĐỒ HOÀN THÀNH THEO NGÀY (%)' }}
          </div>
          <EchartsUI ref="lineChartRef" height="280px" />
        </div>

        <!-- Right 1 col: Donut Pie Chart -->
        <div class="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 flex flex-col items-center justify-center">
          <div class="text-xs font-bold text-foreground uppercase tracking-wider mb-1 text-center">
            {{ chartData.todayLabel }}
          </div>
          <EchartsUI ref="donutChartRef" height="280px" />
        </div>
      </div>
    </Spin>
  </div>
</template>
