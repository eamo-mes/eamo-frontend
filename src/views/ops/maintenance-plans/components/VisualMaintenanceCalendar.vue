<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Calendar, Button, message } from 'ant-design-vue';

const router = useRouter();

function createPlanForDate(date: dayjs.Dayjs): void {
  router.push({ name: 'OpsMaintenancePlanDetail', query: { date: date.format('YYYY-MM-DD') } });
}
import { $t } from '#/locales';
import dayjs, { type Dayjs } from 'dayjs';
import { useUserStore } from '@vben/stores';
import { requestClient } from '#/api/request';
import {
  listEquipmentsApi,
  type EquipmentOption,
  type MaintenanceCategoryOption,
  type MaintenanceItemOption,
  type ScheduleRow,
} from '#/api/ops/maintenance-plans';
import ScheduleDetailDrawer from './ScheduleDetailDrawer.vue';
import LastMaintenanceDrawer from './LastMaintenanceDrawer.vue';

const route = useRoute();

interface LastMaintenanceInfo {
  equipment_id: string;
  maintenance_plan_id: string;
  datetime: string;
  user_id: string;
}

interface Equipment extends EquipmentOption {
  last_maintenance?: LastMaintenanceInfo | null;
}

interface LastMaintenanceNode {
  isLastMaintenance: boolean;
  label: string;
  equipmentId?: string;
  equipmentCode?: string;
  datetime?: string;
}

interface UserOption {
  label: string;
  value: string;
}

const props = withDefaults(
  defineProps<{
    schedules: ScheduleRow[];
    maintenanceItems: MaintenanceItemOption[];
    categories: MaintenanceCategoryOption[];
    userOptions: UserOption[];
    equipments?: EquipmentOption[];
    readOnly?: boolean;
    equipmentId?: string;
  }>(),
  {
    equipments: () => [],
    readOnly: false,
  }
);

const emit = defineEmits<{
  (e: 'update:schedules', newSchedules: ScheduleRow[]): void;
  (e: 'rangeChange', range: { start_date: string; end_date: string }): void;
  (e: 'createLog', schedule: ScheduleRow): void;
}>();

// --- Calendar logic ---
const calendarValue = ref<Dayjs>(dayjs());

function emitRange(date: Dayjs): void {
  const start_date = date.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
  const end_date = date.endOf('month').add(7, 'day').format('YYYY-MM-DD');
  emit('rangeChange', { start_date, end_date });
}

onMounted(() => {
  emitRange(calendarValue.value);
  fetchLocalEquipments();
});

function onPanelChange(date: Dayjs | string): void {
  const d = dayjs(date);
  calendarValue.value = d;
  emitRange(d);
}

function onSelect(date: Dayjs | string): void {
  const d = dayjs(date);
  const oldMonth = calendarValue.value.format('YYYY-MM');
  const newMonth = d.format('YYYY-MM');
  calendarValue.value = d;
  if (oldMonth !== newMonth) {
    emitRange(d);
  }
}

const schedulesWithNames = computed(() => {
  return props.schedules
    .map(s => {
      const item = props.maintenanceItems.find((i) => i.id === s.maintenance_item_id);
      return {
        ...s,
        itemName: s.item_name || (item ? item.name : '')
      };
    })
    .filter(s => s.itemName !== '');
});

function getSchedulesForDate(date: Dayjs) {
  const dateStr = date.format('YYYY-MM-DD');
  return schedulesWithNames.value.filter((s) => s.date === dateStr);
}

// --- Drawer logic ---
const drawerVisible = ref(false);
const selectedSchedule = ref<ScheduleRow | null>(null);

function showScheduleDetail(schedule: ScheduleRow): void {
  selectedSchedule.value = schedule;
  drawerVisible.value = true;
}

function getScheduleClass(result: string | undefined | null): string {
  switch (result) {
    case 'Completed':
      return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-250 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
    case 'Partial':
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-250 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40';
    case 'Failed':
      return 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-250 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40';
    default:
      return 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-250 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40';
  }
}

const userStore = useUserStore();
const localEquipments = ref<Equipment[]>([]);
const lastMaintenanceDrawerVisible = ref(false);
const markingLastMaintenance = ref(false);

async function fetchLocalEquipments(): Promise<void> {
  try {
    const raw = await listEquipmentsApi();
    localEquipments.value = Array.isArray(raw) ? (raw as Equipment[]) : [];
  } catch {
    localEquipments.value = [...props.equipments];
  }
}

async function markCurrentAsLastMaintenance(): Promise<void> {
  const equipmentId = props.equipmentId || props.schedules[0]?.equipment_id;
  const planId = props.schedules[0]?.maintenance_plan_id || (route.query.id as string);

  if (!equipmentId || !planId) {
    message.error('Không tìm thấy thông tin thiết bị hoặc kế hoạch');
    return;
  }

  const eq = localEquipments.value.find((e) => e.id === equipmentId);
  if (!eq) {
    message.error($t('page.ops.notFoundEquipment'));
    return;
  }

  markingLastMaintenance.value = true;
  try {
    const payload = {
      code: eq.code,
      name: eq.name,
      last_maintenance: {
        equipment_id: equipmentId,
        maintenance_plan_id: planId,
        datetime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        user_id: userStore.userInfo?.userId || '',
      },
    };

    await requestClient.put(`/v1/equipment/${equipmentId}`, payload);
    message.success($t('page.ops.lastMaintenanceSetSuccess'));
    await fetchLocalEquipments();
  } catch (err: unknown) {
    const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || $t('page.ops.markError');
    message.error(errMsg);
  } finally {
    markingLastMaintenance.value = false;
  }
}

const lastMaintenanceFilterDate = ref<string | null>(null);

function getLastMaintenanceForDate(date: Dayjs): LastMaintenanceNode[] {
  const dateStr = date.format('YYYY-MM-DD');

  if (!props.readOnly) {
    const eqId = props.equipmentId || props.schedules[0]?.equipment_id;
    if (!eqId) return [];
    const eq = localEquipments.value.find((e) => e.id === eqId);
    if (!eq || !eq.last_maintenance || !eq.last_maintenance.datetime) return [];

    const planId = route.query.id as string;
    if (eq.last_maintenance.maintenance_plan_id !== planId) return [];

    const matches = dayjs(eq.last_maintenance.datetime).format('YYYY-MM-DD') === dateStr;
    if (matches) {
      return [{
        isLastMaintenance: true,
        label: eq.code || '',
        equipmentId: eq.id,
        equipmentCode: eq.code,
        datetime: eq.last_maintenance.datetime
      }];
    }
    return [];
  }

  const list: LastMaintenanceNode[] = [];
  localEquipments.value.forEach((eq) => {
    if (!eq.last_maintenance || !eq.last_maintenance.datetime) return;
    if (dayjs(eq.last_maintenance.datetime).format('YYYY-MM-DD') === dateStr) {
      list.push({
        isLastMaintenance: true,
        label: eq.code || '',
        equipmentId: eq.id,
        equipmentCode: eq.code,
        datetime: eq.last_maintenance.datetime
      });
    }
  });
  return list;
}

const hasLastMaintenance = computed(() => {
  return localEquipments.value.some((e) => e.last_maintenance && e.last_maintenance.equipment_id);
});

function showLastMaintenanceDrawer(): void {
  lastMaintenanceFilterDate.value = null;
  lastMaintenanceDrawerVisible.value = true;
}

function showLastMaintenanceForDate(dateStr: string): void {
  lastMaintenanceFilterDate.value = dateStr;
  lastMaintenanceDrawerVisible.value = true;
}

function handleUpdateSchedules(newSchedules: ScheduleRow[]): void {
  emit('update:schedules', newSchedules);
}
</script>

<template>
  <div>
    <!-- ── Calendar View Section ────────────────────────── -->
    <div>
      <div class="flex justify-between items-center mb-3">
        <div class="font-semibold text-gray-700 dark:text-gray-300">{{ $t('page.ops.visualScheduleTitle') }}</div>
        <div class="flex gap-2">
          <!-- Standalone Mark Button -->
          <Button
            v-if="!props.readOnly"
            type="primary"
            size="small"
            class="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 rounded text-white flex items-center gap-1.5 font-medium"
            :loading="markingLastMaintenance"
            @click="markCurrentAsLastMaintenance"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ $t('page.ops.markAsLastMaintenance') }}
          </Button>

          <!-- View Button -->
          <Button 
            v-if="hasLastMaintenance" 
            type="default" 
            size="small" 
            class="rounded flex items-center gap-1.5 font-medium"
            @click="showLastMaintenanceDrawer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ $t('page.ops.viewLastMaintenanceDevice') }}
          </Button>
        </div>
      </div>
      <Calendar
        v-model:value="calendarValue"
        @panelChange="onPanelChange"
        @select="onSelect"
      >
        <template #dateCellRender="{ current }">
          <div class="cell-content flex flex-col justify-between h-full min-h-[75px]">
            <ul class="relative z-10 list-none p-0 m-0 overflow-y-auto max-h-[85px]">
              <li
                v-for="node in getLastMaintenanceForDate(current)"
                :key="node.equipmentId"
                class="mb-1 py-0.5 px-2 text-xs rounded border truncate cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-[0.5px] hover:shadow-sm bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-250 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 font-semibold flex items-center gap-1"
                :title="node.label"
                @click="showLastMaintenanceForDate(current.format('YYYY-MM-DD'))"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ node.label }}</span>
              </li>
              <li
                v-for="s in getSchedulesForDate(current)"
                :key="s._key"
                class="mb-1 py-0.5 px-2 text-xs rounded border truncate cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-[0.5px] hover:shadow-sm"
                :class="getScheduleClass(s.result)"
                :title="s.itemName"
                @click="showScheduleDetail(s)"
              >
                {{ s.itemName }}
              </li>
            </ul>

            <!-- Fitted Action Button under cell -->
            <div v-if="!props.readOnly" class="mt-1 pt-1 border-t border-dashed border-border/50">
              <Button
                type="dashed"
                size="small"
                block
                class="!h-5 !text-[10px] !px-1 flex items-center justify-center gap-1 opacity-80 hover:opacity-100 transition-opacity !rounded-md"
                @click.stop="createPlanForDate(current)"
              >
                <span class="truncate">{{ $t('page.ops.btnAddPlanShort') || 'Maintenance Plan' }}</span>
              </Button>
            </div>
          </div>
        </template>
      </Calendar>
    </div>

    <!-- Drawer Chi Tiết Hạng Mục Lịch Trình -->
    <ScheduleDetailDrawer
      v-model:open="drawerVisible"
      :selected-schedule="selectedSchedule"
      :schedules="props.schedules"
      :maintenance-items="props.maintenanceItems"
      :categories="props.categories"
      :user-options="props.userOptions"
      :equipments="props.equipments"
      :read-only="props.readOnly"
      @update:schedules="handleUpdateSchedules"
    />

    <!-- Drawer hiển thị thông tin log bảo trì gần nhất -->
    <LastMaintenanceDrawer
      v-model:open="lastMaintenanceDrawerVisible"
      :equipments="localEquipments"
      :filter-date="lastMaintenanceFilterDate"
      :schedules="props.schedules"
      :user-options="props.userOptions"
    />
  </div>
</template>

<style scoped>
/* Selection highlight effect when clicking calendar cell - blue top line and subtle blue bg */
:deep(.ant-picker-calendar-full .ant-picker-cell-selected .ant-picker-calendar-date),
:deep(.ant-picker-cell-selected .ant-picker-cell-inner),
:deep(.ant-picker-cell-selected .ant-picker-calendar-date) {
  border-top: 2px solid #1890ff !important;
  background-color: rgba(24, 144, 255, 0.08) !important;
}

:deep(.ant-picker-calendar-date-selected) {
  background-color: rgba(24, 144, 255, 0.08) !important;
  border-top: 2px solid #1890ff !important;
}
</style>
