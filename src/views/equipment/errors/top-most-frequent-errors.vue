<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, ref, watch } from 'vue';

import { $t } from '#/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Empty, Spin } from 'ant-design-vue';

interface EquipmentOption {
  code: string;
  id: string;
  name: string;
}

interface ErrorItem {
  equipment?: EquipmentOption[];
  fix?: string;
  id: string;
  name: string;
  protection_measures?: string;
  reason?: string;
}

interface MappedItem {
  count: number;
  name: string;
}

import { usePreferences } from '@vben/preferences';

const props = defineProps<{
  errors: ErrorItem[];
  loading: boolean;
}>();

const { isDark } = usePreferences();
const barChartRef = ref<EchartsUIType>();
const pieChartRef = ref<EchartsUIType>();
const { renderEcharts: renderBarChart } = useEcharts(barChartRef);
const { renderEcharts: renderPieChart } = useEcharts(pieChartRef);

async function updateCharts() {
  await nextTick();
  if (!barChartRef.value || !pieChartRef.value) {
    return;
  }

  const data = props.errors;

  const mapped: MappedItem[] = data.map((d: ErrorItem) => ({
    count: d.equipment ? d.equipment.length : 0,
    name: d.name,
  }));

  mapped.sort((a: MappedItem, b: MappedItem) => a.count - b.count);
  const chartData = mapped.slice(-8);

  const names = chartData.map((d: MappedItem) => d.name);
  const counts = chartData.map((d: MappedItem) => d.count);
  const totalLinked = counts.reduce((sum: number, val: number) => sum + val, 0);

  const axisTextColor = isDark.value ? '#ffffff' : '#4b5563';
  const textColor = isDark.value ? '#ffffff' : '#4b5563';
  const labelColor = isDark.value ? '#ffffff' : '#1e293b';
  const pieBorderColor = isDark.value ? '#0f172a' : '#ffffff';
  const splitLineColor = isDark.value ? 'rgba(255,255,255,0.1)' : '#e5e7eb';

  // Signature color palette for pie chart slices
  const signatureColors = [
    '#1890ff',
    '#5ab1ef',
    '#3aa0ff',
    '#94a3b8',
    '#cbd5e1',
    '#0076e4',
    '#7ec2f4',
    '#64748b',
  ];

  renderBarChart({
    grid: {
      bottom: '5%',
      containLabel: true,
      left: '3%',
      right: '4%',
      top: '5%',
    },
    legend: {
      data: [{ name: $t('page.equipment.chartEquipmentLinks'), icon: 'roundRect' }],
      bottom: 0,
      textStyle: { color: textColor, fontSize: 11 },
    },
    series: [
      {
        data: counts.map((v) => ({
          value: v,
          label: {
            show: true,
            position: 'right',
            formatter: `{c}`,
            color: axisTextColor,
            fontSize: 11,
          },
          itemStyle: {
            color: '#1890ff',
          },
        })),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
        },
        name: $t('page.equipment.chartEquipmentLinks'),
        type: 'bar',
        barWidth: '52%',
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: textColor,
    },
    tooltip: {
      axisPointer: { type: 'shadow' },
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as {
          name: string;
          value: number;
        }[];
        if (!Array.isArray(list) || list.length === 0) {
          return '';
        }
        const p = list[0];
        if (!p) return '';
        return `<strong>${p.name}</strong><br/>${$t('page.equipment.chartEquipmentLinks')}: <strong>${p.value}</strong>`;
      },
    },
    xAxis: {
      minInterval: 1,
      type: 'value',
      axisLabel: { color: axisTextColor, fontSize: 11 },
      splitLine: {
        lineStyle: { type: 'dashed', color: splitLineColor, opacity: 0.6 },
      },
    },
    yAxis: {
      axisLabel: {
        fontSize: 11,
        color: axisTextColor,
        overflow: 'truncate',
        width: 140,
      },
      data: names,
      type: 'category',
    },
  });

  renderPieChart({
    color: signatureColors,
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'middle',
      textStyle: { color: textColor, fontSize: 11 },
      formatter: (name: string) => {
        const item = chartData.find((d) => d.name === name);
        const pct = totalLinked > 0 ? Math.round(((item?.count ?? 0) / totalLinked) * 100) : 0;
        const shortName = name.length > 22 ? name.slice(0, 20) + '…' : name;
        return `${shortName}  (${pct}%)`;
      },
    },
    series: [
      {
        avoidLabelOverlap: true,
        center: ['30%', '50%'],
        data: chartData.map((d: MappedItem) => ({
          name: d.name,
          value: d.count,
        })),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
          label: { fontSize: 14, fontWeight: 'bold', show: true },
        },
        itemStyle: {
          borderColor: pieBorderColor,
          borderRadius: 8,
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'center',
          color: labelColor,
          fontSize: 14,
          fontWeight: 'bold',
          formatter: `${totalLinked}\n${$t('page.equipment.chartLinksLabel')}`,
        },
        labelLine: { show: false },
        name: $t('page.equipment.chartErrorCount'),
        radius: ['55%', '78%'],
        type: 'pie',
      },
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: textColor,
    },
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as {
          name: string;
          value: number;
          percent: number;
        };
        return `${p.name}<br/>${$t('page.equipment.chartEquipmentLinks')}: <strong>${p.value}</strong> (${p.percent}%)`;
      },
      trigger: 'item',
    },
  });
}

watch(
  [() => props.errors, () => isDark.value],
  () => {
    updateCharts();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <Spin :spinning="props.loading">
    <div v-if="props.errors.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <!-- Bar Chart Card -->
      <div class="border border-border rounded-xl p-4 bg-card">
        <div class="mb-1">
          <h5 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
            {{ $t('page.equipment.chartFrequencyTitle') }}
          </h5>
        </div>
        <EchartsUI ref="barChartRef" height="300px" />
      </div>

      <!-- Pie Chart Card -->
      <div class="border border-border rounded-xl p-4 bg-card">
        <div class="mb-1">
          <h5 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
            {{ $t('page.equipment.chartRatioTitle') }}
          </h5>
        </div>
        <EchartsUI ref="pieChartRef" height="300px" />
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="py-12 flex justify-center">
      <Empty :description="$t('page.equipment.chartNoData')" />
    </div>
  </Spin>
</template>
