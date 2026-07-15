<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import dayjs from 'dayjs';
import { Spin } from 'ant-design-vue';

import type { EquipmentOption, OperatingTimeItem } from '../types';

import AvgAvailabilityChart from './AvgAvailabilityChart.vue';
import LongestOperatingChart from './LongestOperatingChart.vue';
import MaintenanceStatusChart from './MaintenanceStatusChart.vue';

interface MaintenanceStatusItem {
  name: string;
  remaining: number;
}

const props = defineProps<{
  activeEquipmentId?: string;
  equipments: EquipmentOption[];
  filteredItems: OperatingTimeItem[];
  loading?: boolean;
  maintenanceStatusData: MaintenanceStatusItem[];
}>();

const chartsLoading = ref(false);

function getEquipmentCode(id: string) {
  const equip = props.equipments.find((e) => e.id === id);
  return equip ? equip.code : id;
}

function calculateRowAvailabilityFactor(record: OperatingTimeItem) {
  const workingTime = Number(record.working_time) || 0;
  const plannedStop = Number(record.planned_stop_time) || 0;
  const unplannedStop = Number(record.unplanned_stop_time) || 0;

  const plannedOp = Math.max(0, workingTime - plannedStop);
  const actualOp = Math.max(0, plannedOp - unplannedStop);

  if (plannedOp <= 0) {
    return 0;
  }
  return Number(((actualOp / plannedOp) * 100).toFixed(2));
}

// 1. Average Availability Factor (A)
const avgValue = computed(() => {
  const list = props.filteredItems;
  const totalRecords = list.length;
  const overallAvg =
    totalRecords > 0
      ? list.reduce(
          (sum, item) => sum + calculateRowAvailabilityFactor(item),
          0,
        ) / totalRecords
      : 0;

  return Number(overallAvg.toFixed(2));
});

// 2. Longest operating time
const horizontalData = computed(() => {
  const list = props.filteredItems;

  // Group by equipment
  const eqMap: Record<
    string,
    {
      actualOp: number;
      factors: number[];
      id: string;
      name: string;
      unplannedStop: number;
    }
  > = {};

  list.forEach((item) => {
    const eqId = item.equipment_id;
    const eqCode = getEquipmentCode(eqId);

    const eq = props.equipments.find((e) => e.id === eqId);
    const lastMaintenanceDate = eq?.last_maintenance?.datetime;
    if (lastMaintenanceDate && item.start_time) {
      if (dayjs(item.start_time).isBefore(dayjs(lastMaintenanceDate))) {
        return;
      }
    }

    if (!eqMap[eqId]) {
      eqMap[eqId] = {
        actualOp: 0,
        factors: [],
        id: eqId,
        name: eqCode,
        unplannedStop: 0,
      };
    }

    const workingTime = Number(item.working_time) || 0;
    const plannedStop = Number(item.planned_stop_time) || 0;
    const unplannedStop = Number(item.unplanned_stop_time) || 0;

    const plannedOp = Math.max(0, workingTime - plannedStop);
    const actualOp = Math.max(0, plannedOp - unplannedStop);
    const factor = plannedOp > 0 ? (actualOp / plannedOp) * 100 : 0;

    eqMap[eqId]!.actualOp += actualOp;
    eqMap[eqId]!.unplannedStop += unplannedStop;
    eqMap[eqId]!.factors.push(factor);
  });

  const eqData = Object.values(eqMap);
  const sortedOperatingData = [...eqData].sort(
    (a, b) => b.actualOp - a.actualOp,
  );
  const topOperatingData = sortedOperatingData.slice(0, 5);
  return [...topOperatingData].reverse();
});

// 3. Maintenance Status Data
const finalMaintenanceData = computed(() => {
  let finalData = props.maintenanceStatusData;
  if (props.activeEquipmentId) {
    const activeEquip = props.equipments.find(
      (e) => e.id === props.activeEquipmentId,
    );
    if (activeEquip) {
      finalData = finalData.filter((item) => item.name === activeEquip.code);
    }
  }

  const topMaintenanceData = finalData.slice(0, 5);
  return [...topMaintenanceData].reverse();
});

watch(
  [() => props.filteredItems, () => props.maintenanceStatusData],
  () => {
    chartsLoading.value = true;
    nextTick(() => {
      chartsLoading.value = false;
    });
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <Spin :spinning="chartsLoading">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <AvgAvailabilityChart :avg-value="avgValue" :loading="props.loading || chartsLoading" />
      <LongestOperatingChart :data="horizontalData" :loading="props.loading || chartsLoading" />
      <MaintenanceStatusChart :data="finalMaintenanceData" :loading="props.loading || chartsLoading" />
    </div>
  </Spin>
</template>
