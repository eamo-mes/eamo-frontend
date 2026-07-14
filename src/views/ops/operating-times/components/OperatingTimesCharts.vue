<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue';
import dayjs from 'dayjs';
import { Spin } from 'ant-design-vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import type { EchartsUIType } from '@vben/plugins/echarts';
import { $t } from '#/locales';
import type { OperatingTimeItem, EquipmentOption } from '../types';

const props = defineProps<{
  filteredItems: OperatingTimeItem[];
  equipments: EquipmentOption[];
  maintenanceStatusData: { name: string; remaining: number }[];
  activeEquipmentId?: string;
}>();

const chartsLoading = ref(false);

const avgAvailabilityChartRef = ref<EchartsUIType>();
const longestOperatingChartRef = ref<EchartsUIType>();
const maintenanceStatusChartRef = ref<EchartsUIType>();

const { renderEcharts: renderAvgAvailabilityChart } = useEcharts(avgAvailabilityChartRef);
const { renderEcharts: renderLongestOperatingChart } = useEcharts(longestOperatingChartRef);
const { renderEcharts: renderMaintenanceStatusChart } = useEcharts(maintenanceStatusChartRef);

function getEquipmentCode(id: string) {
  const equip = props.equipments.find(e => e.id === id);
  return equip ? equip.code : id;
}

function calculateRowAvailabilityFactor(record: OperatingTimeItem) {
  const workingTime = Number(record.working_time) || 0;
  const plannedStop = Number(record.planned_stop_time) || 0;
  const unplannedStop = Number(record.unplanned_stop_time) || 0;

  const plannedOp = Math.max(0, workingTime - plannedStop);
  const actualOp = Math.max(0, plannedOp - unplannedStop);

  if (plannedOp <= 0) return 0;
  return Number(((actualOp / plannedOp) * 100).toFixed(2));
}

async function renderCharts() {
  await nextTick();
  if (!avgAvailabilityChartRef.value || !longestOperatingChartRef.value || !maintenanceStatusChartRef.value) {
    return;
  }

  const list = props.filteredItems;
  
  // Group by equipment
  const eqMap: Record<string, { id: string; name: string; actualOp: number; unplannedStop: number; factors: number[] }> = {};
  
  list.forEach(item => {
    const eqId = item.equipment_id;
    const eqCode = getEquipmentCode(eqId);

    const eq = props.equipments.find(e => e.id === eqId);
    const lastMaintenanceDate = eq?.last_maintenance?.datetime;
    if (lastMaintenanceDate && item.start_time) {
      if (dayjs(item.start_time).isBefore(dayjs(lastMaintenanceDate))) {
        return;
      }
    }

    if (!eqMap[eqId]) {
      eqMap[eqId] = {
        id: eqId,
        name: eqCode,
        actualOp: 0,
        unplannedStop: 0,
        factors: []
      };
    }
    
    const workingTime = Number(item.working_time) || 0;
    const plannedStop = Number(item.planned_stop_time) || 0;
    const unplannedStop = Number(item.unplanned_stop_time) || 0;

    const plannedOp = Math.max(0, workingTime - plannedStop);
    const actualOp = Math.max(0, plannedOp - unplannedStop);
    const factor = plannedOp > 0 ? (actualOp / plannedOp) * 100 : 0;

    eqMap[eqId].actualOp += actualOp;
    eqMap[eqId].unplannedStop += unplannedStop;
    eqMap[eqId].factors.push(factor);
  });

  const eqData = Object.values(eqMap);

  // 1. Average Availability Factor (A)
  const totalRecords = list.length;
  const overallAvg = totalRecords > 0 
    ? list.reduce((sum, item) => sum + calculateRowAvailabilityFactor(item), 0) / totalRecords 
    : 0;
  
  const avgValue = Number(overallAvg.toFixed(2));
  const remainingValue = Number((100 - avgValue).toFixed(2));

  renderAvgAvailabilityChart({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}%'
    },
    legend: {
      bottom: '5%',
      left: 'center',
      textStyle: { fontSize: 11 }
    },
    series: [
      {
        name: $t('page.ops.availabilityFactor'),
        type: 'pie',
        radius: ['55%', '75%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'center',
          formatter: `${avgValue}%`,
          fontSize: 22,
          fontWeight: 'bold',
          color: '#1e293b'
        },
        labelLine: {
          show: false
        },
        color: ['#3b82f6', '#cbd5e1'],
        data: [
          { value: avgValue, name: $t('page.ops.chartAvailable') },
          { value: remainingValue, name: $t('page.ops.chartUnavailable') }
        ]
      }
    ]
  });

  // 2. Longest operating time
  const sortedOperatingData = [...eqData].sort((a, b) => b.actualOp - a.actualOp);
  const topOperatingData = sortedOperatingData.slice(0, 10);
  const horizontalData = [...topOperatingData].reverse();

  renderLongestOperatingChart({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let res = `${params[0].name}<br/>`;
        params.forEach((p: any) => {
          res += `${p.marker} ${p.seriesName}: ${Math.abs(Number(p.value))} hrs<br/>`;
        });
        return res;
      }
    },
    legend: {
      bottom: '0',
      left: 'center',
      textStyle: { fontSize: 10 }
    },
    grid: { left: '3%', right: '8%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (value: any) => `${Math.abs(Number(value))} hrs`, fontSize: 10 }
    },
    yAxis: {
      type: 'category',
      data: horizontalData.map(item => item.name),
      axisLabel: { fontSize: 10 },
      axisLine: { onZero: false }
    },
    series: [
      {
        name: $t('page.ops.actualOperatingTime'),
        type: 'bar',
        stack: 'total',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#60a5fa' }
            ]
          }
        },
        barWidth: '45%',
        data: horizontalData.map(item => Number(item.actualOp.toFixed(2)))
      },
      {
        name: $t('page.ops.unplannedStopTime'),
        type: 'bar',
        stack: 'total',
        itemStyle: {
          borderRadius: [4, 0, 0, 4],
          color: {
            type: 'linear',
            x: 1,
            y: 0,
            x2: 0,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#cbd5e1' },
              { offset: 1, color: '#94a3b8' }
            ]
          }
        },
        barWidth: '45%',
        data: horizontalData.map(item => -Number(item.unplannedStop.toFixed(2)))
      }
    ]
  });

  // 3. Maintenance Status Chart
  let finalData = props.maintenanceStatusData;
  if (props.activeEquipmentId) {
    const activeEquip = props.equipments.find(e => e.id === props.activeEquipmentId);
    if (activeEquip) {
      finalData = finalData.filter(item => item.name === activeEquip.code);
    }
  }

  const topMaintenanceData = finalData.slice(0, 10);
  const finalMaintenanceData = [...topMaintenanceData].reverse();

  renderMaintenanceStatusChart({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let res = `${params[0].name}<br/>`;
        params.forEach((p: any) => {
          res += `${p.marker} ${p.seriesName}: ${p.value} hrs<br/>`;
        });
        return res;
      }
    },
    grid: { left: '3%', right: '8%', bottom: '10%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: '{value} hrs', fontSize: 10 }
    },
    yAxis: {
      type: 'category',
      data: finalMaintenanceData.map(item => item.name),
      axisLabel: { fontSize: 10 }
    },
    series: [
      {
        name: $t('page.ops.chartRemainingHours') || 'Thời gian còn lại',
        type: 'bar',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#8b5cf6' },
              { offset: 1, color: '#a78bfa' }
            ]
          }
        },
        barWidth: '55%',
        data: finalMaintenanceData.map(item => item.remaining)
      }
    ]
  });
}

watch([() => props.filteredItems, () => props.maintenanceStatusData], async () => {
  chartsLoading.value = true;
  try {
    await renderCharts();
  } finally {
    chartsLoading.value = false;
  }
}, { deep: true, immediate: true });
</script>

<template>
  <Spin :spinning="chartsLoading">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
        <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
          {{ $t('page.ops.chartAvgAvailabilityTitle') }}
        </h3>
        <EchartsUI ref="avgAvailabilityChartRef" />
      </div>
      <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
        <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
          {{ $t('page.ops.chartLongestOperatingTitle') }}
        </h3>
        <EchartsUI ref="longestOperatingChartRef" />
      </div>
      <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
        <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
          {{ $t('page.ops.chartMaintenanceStatusTitle') }}
        </h3>
        <EchartsUI ref="maintenanceStatusChartRef" />
      </div>
    </div>
  </Spin>
</template>
