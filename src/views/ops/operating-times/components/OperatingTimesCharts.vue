<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import dayjs from 'dayjs';
import { SkeletonInput } from 'ant-design-vue';

import type { EquipmentOption, OperatingTimeItem } from '../types';

import AvgAvailabilityChart from './AvgAvailabilityChart.vue';
import LongestOperatingChart from './LongestOperatingChart.vue';
import MaintenanceStatusChart from './MaintenanceStatusChart.vue';

interface MaintenanceStatusItem {
  name: string;
  remaining: number;
}

const props = withDefaults(defineProps<{
  activeEquipmentId?: string;
  equipments: EquipmentOption[];
  filteredItems: OperatingTimeItem[];
  loading?: boolean;
  maintenanceStatusData: MaintenanceStatusItem[];
  vertical?: boolean;
}>(), {
  vertical: false,
});

const chartsLoading = ref(false);

const isComponentLoading = computed(() => props.loading || chartsLoading.value);

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

    const eq = props.equipments.find((e) => String(e.id) === String(eqId));
    let lastMaintenanceDate: string | null = null;
    if (eq?.last_maintenance) {
      if (typeof eq.last_maintenance === 'string') {
        try {
          const parsed = JSON.parse(eq.last_maintenance);
          lastMaintenanceDate = parsed?.datetime || null;
        } catch {
          lastMaintenanceDate = null;
        }
      } else {
        lastMaintenanceDate = eq.last_maintenance.datetime || null;
      }
    }

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
  <div v-if="isComponentLoading" :class="props.vertical ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 lg:grid-cols-3 gap-4'">
    <!-- Skeleton Card 1: Avg Availability Factor -->
    <div :class="['border border-border rounded-xl p-4 bg-card flex flex-col justify-between', props.vertical ? 'h-[240px]' : 'h-[360px]']">
      <SkeletonInput active size="small" style="width: 55%; height: 16px;" class="mb-2" />
      <div class="flex-1 flex flex-col justify-center items-center p-4">
        <div class="w-36 h-36 rounded-full border-8 border-muted/30 dark:border-muted/20 border-t-primary/40 animate-spin flex items-center justify-center">
          <div class="w-20 h-6 bg-muted/40 dark:bg-muted/30 rounded-md animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Skeleton Card 2: Longest Operating Time -->
    <div :class="['border border-border rounded-xl p-4 bg-card flex flex-col justify-between', props.vertical ? 'h-[240px]' : 'h-[360px]']">
      <SkeletonInput active size="small" style="width: 65%; height: 16px;" class="mb-2" />
      <div class="flex-1 flex flex-col justify-center p-3 space-y-3.5">
        <div class="space-y-1.5" v-for="i in 4" :key="i">
          <div class="flex justify-between items-center text-xs">
            <div class="h-3 bg-muted/50 rounded w-16 animate-pulse"></div>
            <div class="h-3 bg-muted/40 rounded w-10 animate-pulse"></div>
          </div>
          <div class="h-3.5 bg-muted/30 rounded-full overflow-hidden flex gap-1 animate-pulse">
            <div class="bg-primary/30 h-full rounded-l-full" :style="{ width: `${70 - i * 12}%` }"></div>
            <div class="bg-slate-400/30 h-full" :style="{ width: `${10 + i * 5}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Skeleton Card 3: Maintenance Status -->
    <div :class="['border border-border rounded-xl p-4 bg-card flex flex-col justify-between', props.vertical ? 'h-[240px]' : 'h-[360px]']">
      <SkeletonInput active size="small" style="width: 60%; height: 16px;" class="mb-2" />
      <div class="flex-1 flex flex-col justify-center p-3 space-y-3.5">
        <div class="space-y-1.5" v-for="i in 4" :key="i">
          <div class="flex justify-between items-center text-xs">
            <div class="h-3 bg-muted/50 rounded w-14 animate-pulse"></div>
            <div class="h-3 bg-muted/40 rounded w-12 animate-pulse"></div>
          </div>
          <div class="h-3.5 bg-muted/30 rounded-full overflow-hidden animate-pulse">
            <div class="bg-primary/30 h-full rounded-full" :style="{ width: `${85 - i * 15}%` }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else :class="props.vertical ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 lg:grid-cols-3 gap-4'">
    <AvgAvailabilityChart :avg-value="avgValue" :loading="false" :compact="props.vertical" />
    <LongestOperatingChart :data="horizontalData" :loading="false" :compact="props.vertical" />
    <MaintenanceStatusChart :data="finalMaintenanceData" :loading="false" :compact="props.vertical" />
  </div>
</template>
