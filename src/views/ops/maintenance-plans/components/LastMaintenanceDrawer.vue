<script setup lang="ts">
import { computed } from 'vue';
import { Drawer, Button, Tag, Input } from 'ant-design-vue';
import { $t } from '#/locales';
import type { EquipmentOption, ScheduleRow } from '#/api/ops/maintenance-plans';

interface LastMaintenanceInfo {
  equipment_id: string;
  maintenance_plan_id: string;
  datetime: string;
  user_id: string;
}

interface Equipment extends EquipmentOption {
  last_maintenance?: LastMaintenanceInfo | null;
}

interface UserOption {
  label: string;
  value: string;
}

const props = defineProps<{
  open: boolean;
  equipments: Equipment[];
  filterDate: string | null;
  schedules: ScheduleRow[];
  userOptions: UserOption[];
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const equipmentsWithLastMaintenance = computed(() => {
  return props.equipments.filter(
    (e) => e.last_maintenance && e.last_maintenance.equipment_id
  );
});

const displayedLastMaintenanceEquipments = computed<Equipment[]>(() => {
  if (props.filterDate) {
    return equipmentsWithLastMaintenance.value.filter((eq) => {
      if (!eq.last_maintenance || !eq.last_maintenance.datetime) return false;
      return eq.last_maintenance.datetime.startsWith(props.filterDate!);
    });
  }
  return equipmentsWithLastMaintenance.value;
});

function getPlanCodeById(planId: string): string {
  const schedule = props.schedules.find((s) => s.maintenance_plan_id === planId);
  return schedule?.plan_code || '';
}

function getUserLabel(userId: string): string {
  const opt = props.userOptions.find((o) => o.value === userId);
  return opt ? opt.label : userId;
}

function handleClose(): void {
  emit('update:open', false);
}
</script>

<template>
  <Drawer
    :open="props.open"
    :title="$t('page.ops.lastMaintenanceDeviceTitle')"
    placement="right"
    :width="690"
    @close="handleClose"
  >
    <div class="space-y-6 px-2">
      <div 
        v-for="(eq, index) in displayedLastMaintenanceEquipments" 
        :key="eq.id"
        class="space-y-4"
      >
        <div v-if="index > 0" class="border-t border-border pt-4 mt-4"></div>

        <div class="flex justify-between items-center pb-2 border-b border-border">
          <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">
            {{ $t('page.ops.placeholderEquipment') }} {{ eq.code }}
          </span>
          <Tag color="green">{{ $t('page.ops.maintainedLabel') }}</Tag>
        </div>

        <div class="space-y-3">
          <div>
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.placeholderEquipment') }}
            </span>
            <Input
              :value="eq.code + (eq.name ? ` — ${eq.name}` : '')"
              disabled
              class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
          <div>
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.colPlanCode') }}
            </span>
            <Input
              :value="eq.last_maintenance ? (getPlanCodeById(eq.last_maintenance.maintenance_plan_id) || eq.last_maintenance.maintenance_plan_id) : ''"
              disabled
              class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
          <div>
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.maintenanceTime') }}
            </span>
            <Input
              :value="eq.last_maintenance?.datetime || ''"
              disabled
              class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
          <div>
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.executor') }}
            </span>
            <Input
              :value="eq.last_maintenance ? getUserLabel(eq.last_maintenance.user_id) : ''"
              disabled
              class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
        </div>
      </div>
      <div v-if="displayedLastMaintenanceEquipments.length === 0" class="text-center py-8 text-gray-400 italic">
        {{ $t('page.ops.noLastMaintenanceDevice') }}
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end py-2">
        <Button @click="handleClose">{{ $t('page.ops.btnClose') }}</Button>
      </div>
    </template>
  </Drawer>
</template>
