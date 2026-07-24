<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { Calendar, Spin, Switch, Select, Radio, Button, message } from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { $t } from '#/locales';
import { listEquipmentsApi, listMaintenanceSchedulesApi, type ScheduleRow } from '#/api/ops/maintenance-plans';
import type {
  EquipmentOption,
  MaintenanceCategoryOption,
  MaintenanceItemOption,
} from '../types';
import ScheduleDetailDrawer from '#/views/ops/maintenance-plans/components/ScheduleDetailDrawer.vue';
import MaintenanceCellDrawer from './MaintenanceCellDrawer.vue';

interface UserSelectOption {
  label: string;
  value: string;
}

export interface DailyPlanNode {
  key: string;
  plan_id: string;
  plan_code: string;
  date: string;
  equipment_code: string;
  equipment_name: string | null;
  maintenance_type: string;
  schedules: ScheduleRow[];
  total_items: number;
  completed_items: number;
  result: 'Completed' | 'Pending';
}

const props = withDefaults(
  defineProps<{
    schedules?: ScheduleRow[];
    maintenanceItems?: MaintenanceItemOption[];
    categories?: MaintenanceCategoryOption[];
    userOptions?: UserSelectOption[];
    equipments?: EquipmentOption[];
    readOnly?: boolean;
    equipmentId?: string;
  }>(),
  {
    schedules: () => [],
    maintenanceItems: () => [],
    categories: () => [],
    userOptions: () => [],
    equipments: () => [],
    readOnly: false,
  }
);

const emit = defineEmits<{
  (e: 'update:schedules', newSchedules: ScheduleRow[]): void;
  (e: 'rangeChange', range: { start_date: string; end_date: string }): void;
}>();

const loading = ref(false);
const filterFromCurrentWeek = ref(true);
const calendarContainerRef = ref<HTMLDivElement | null>(null);
const calendarValue = ref<Dayjs>(dayjs());

const fetchedSchedules = ref<ScheduleRow[]>([]);
const localEquipments = ref<EquipmentOption[]>([]);

const dateDetailVisible = ref(false);
const selectedDate = ref<Dayjs | null>(null);

const drawerVisible = ref(false);
const selectedSchedule = ref<ScheduleRow | null>(null);

function handleCellClick(date: Dayjs): void {
  selectedDate.value = date;
  dateDetailVisible.value = true;
}

function openCreateDrawer(date?: Dayjs): void {
  selectedDate.value = date || dayjs();
  dateDetailVisible.value = true;
}

defineExpose({
  openCreateDrawer,
  fetchSchedules,
});

function showScheduleDetail(schedule?: ScheduleRow | null): void {
  if (!schedule) return;
  selectedSchedule.value = schedule;
  drawerVisible.value = true;
}

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  label: dayjs().month(i).format('MMM'),
  value: i,
}));

function getYearOptions(currentDate: Dayjs) {
  const currentYear = currentDate.year();
  const years = [];
  for (let i = currentYear - 5; i <= currentYear + 5; i++) {
    years.push({
      label: `${i}`,
      value: i,
    });
  }
  return years;
}

function emitRange(date: Dayjs): void {
  const start_date = date.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
  const end_date = date.endOf('month').add(7, 'day').format('YYYY-MM-DD');
  emit('rangeChange', { start_date, end_date });
}

async function fetchLocalEquipments(): Promise<void> {
  try {
    const raw = await listEquipmentsApi();
    localEquipments.value = Array.isArray(raw) ? raw : [];
  } catch {
    localEquipments.value = [...(props.equipments || [])];
  }
}

async function fetchSchedules(): Promise<void> {
  loading.value = true;
  try {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const startOfMonth = calendarValue.value.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
    const startDate = filterFromCurrentWeek.value && startOfMonth < todayStr ? todayStr : startOfMonth;
    const endDate = calendarValue.value.endOf('month').add(7, 'day').format('YYYY-MM-DD');

    const params: { start_date: string; end_date: string; equipment_id?: string; per_page: number } = {
      start_date: startDate,
      end_date: endDate,
      per_page: 500,
    };
    if (props.equipmentId) {
      params.equipment_id = props.equipmentId;
    }

    const raw = await listMaintenanceSchedulesApi(params);
    const scheduleArray = Array.isArray(raw) ? raw : [];
    
    fetchedSchedules.value = scheduleArray.map((s) => ({
      ...s,
      _key: s._key || `sch-${s.id}-${Math.random().toString(36).slice(2)}`,
      result: s.result || s.maintenance_logs?.[0]?.result || null,
      plan_code: s.plan_code || s.maintenance_plan?.plan_code || '—',
      equipment_code: s.equipment_code || s.maintenance_plan?.equipment?.code || '',
      equipment_name: s.equipment_name || s.maintenance_plan?.equipment?.name || null,
      item_name: s.item_name || s.maintenance_item_id || '',
    }));

    nextTick(() => {
      applyWeekFilter();
    });
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || $t('page.ops.loadSchedulesError') || 'Error loading maintenance schedules');
  } finally {
    loading.value = false;
  }
}

function getSchedulesForDay(date: Dayjs): ScheduleRow[] {
  const currentWeekStart = dayjs().startOf('week');
  if (filterFromCurrentWeek.value && date.isBefore(currentWeekStart, 'day')) {
    return [];
  }

  const dateStr = date.format('YYYY-MM-DD');
  const source = fetchedSchedules.value.length > 0 ? fetchedSchedules.value : props.schedules || [];
  return source.filter((s) => s.date && s.date.startsWith(dateStr));
}

/**
 * Group eamo_maintenance_schedules by unique eamo_maintenance_plans per date to eliminate duplicate cards
 */
function getDailyPlanNodes(date: Dayjs): DailyPlanNode[] {
  const daySchedules = getSchedulesForDay(date);
  if (daySchedules.length === 0) return [];

  const planMap = new Map<string, DailyPlanNode>();

  for (const s of daySchedules) {
    const planKey = s.maintenance_plan_id || s.plan_code || s.id || 'unknown';
    const isCompleted = s.result === 'Completed';

    const eqCode = s.equipment_code || s.maintenance_plan?.equipment?.code || '—';
    const eqName = s.equipment_name || s.maintenance_plan?.equipment?.name || null;

    if (!planMap.has(planKey)) {
      planMap.set(planKey, {
        key: `plan-${planKey}-${date.format('YYYY-MM-DD')}`,
        plan_id: s.maintenance_plan_id || '',
        plan_code: s.plan_code || s.maintenance_plan?.plan_code || '—',
        date: date.format('YYYY-MM-DD'),
        equipment_code: eqCode,
        equipment_name: eqName,
        maintenance_type: s.maintenance_type || s.maintenance_plan?.maintenance_type || '—',
        schedules: [s],
        total_items: 1,
        completed_items: isCompleted ? 1 : 0,
        result: isCompleted ? 'Completed' : 'Pending',
      });
    } else {
      const node = planMap.get(planKey)!;
      node.schedules.push(s);
      node.total_items += 1;
      if (isCompleted) {
        node.completed_items += 1;
      }

      if (node.completed_items === node.total_items) {
        node.result = 'Completed';
      } else {
        node.result = 'Pending';
      }
    }
  }

  return Array.from(planMap.values());
}

function getCellCompletionStats(date: Dayjs) {
  const daySchedules = getSchedulesForDay(date);
  if (daySchedules.length === 0) return null;
  const completed = daySchedules.filter((s) => s.result === 'Completed').length;
  const percent = Math.round((completed / daySchedules.length) * 100);
  return { completed, total: daySchedules.length, percent };
}

function getScheduleClass(result: string | undefined | null): string {
  switch (result) {
    case 'Completed':
      return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
    case 'Partial':
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40';
    case 'Failed':
      return 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40';
    default:
      return 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40';
  }
}

function applyWeekFilter(): void {
  if (!calendarContainerRef.value) return;
  const trs = calendarContainerRef.value.querySelectorAll('.ant-picker-content tbody tr');
  const currentWeekStart = dayjs().startOf('week').format('YYYY-MM-DD');

  trs.forEach((tr) => {
    const htmlTr = tr as HTMLElement;
    if (!filterFromCurrentWeek.value) {
      htmlTr.style.display = '';
      return;
    }

    const tds = tr.querySelectorAll('td');
    if (tds.length === 0) return;

    let allBefore = true;
    tds.forEach((td) => {
      const title = td.getAttribute('title');
      if (title && title >= currentWeekStart) {
        allBefore = false;
      }
    });

    if (allBefore) {
      htmlTr.style.display = 'none';
    } else {
      htmlTr.style.display = '';
    }
  });
}

function handleUpdateSchedules(newSchedules: ScheduleRow[]): void {
  emit('update:schedules', newSchedules);
  fetchSchedules();
}

watch(
  [calendarValue, filterFromCurrentWeek, () => props.equipmentId],
  () => {
    fetchSchedules();
  },
  { immediate: true },
);

onMounted(() => {
  emitRange(calendarValue.value);
  fetchLocalEquipments();
  nextTick(() => {
    applyWeekFilter();
  });
  if (calendarContainerRef.value) {
    const observer = new MutationObserver(() => {
      applyWeekFilter();
    });
    observer.observe(calendarContainerRef.value, { childList: true, subtree: true });
  }
});

function onPanelChange(date: Dayjs | string): void {
  const d = dayjs(date);
  calendarValue.value = d;
  emitRange(d);
  nextTick(() => {
    applyWeekFilter();
  });
}

function onSelect(date: Dayjs | string): void {
  const d = dayjs(date);
  const oldMonth = calendarValue.value.format('YYYY-MM');
  const newMonth = d.format('YYYY-MM');
  calendarValue.value = d;
  if (oldMonth !== newMonth) {
    emitRange(d);
  }
  nextTick(() => {
    applyWeekFilter();
  });
}
</script>

<template>
  <div ref="calendarContainerRef" class="space-y-4">
    <Spin :spinning="loading">
      <Calendar
        v-model:value="calendarValue"
        @panel-change="onPanelChange"
        @select="onSelect"
      >
        <template #headerRender="{ value, type, onChange, onTypeChange }">
          <div class="flex items-center justify-between pb-4">
            <div class="flex items-center gap-4">
              <h3 class="font-semibold text-foreground text-base m-0">
                {{ value.format('MMMM YYYY') }}
              </h3>
              <div class="flex items-center gap-1.5 h-6">
                <Switch v-model:checked="filterFromCurrentWeek" size="small" />
                <span class="text-xs font-medium text-foreground">{{ $t('page.ops.filterFromCurrentWeek') }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Select
                size="small"
                :value="value.year()"
                :options="getYearOptions(value)"
                class="w-24"
                @change="(y) => onChange(value.year(y as number))"
              />

              <Select
                size="small"
                :value="value.month()"
                :options="monthOptions"
                class="w-20"
                @change="(m) => onChange(value.month(m as number))"
              />

              <Radio.Group
                size="small"
                :value="type"
                @change="(e) => onTypeChange(e.target.value)"
              >
                <Radio.Button value="month">Month</Radio.Button>
                <Radio.Button value="year">Year</Radio.Button>
              </Radio.Group>

              <Button
                type="primary"
                size="small"
                class="flex items-center gap-1 font-medium shadow-xs"
                @click="openCreateDrawer()"
              >
                {{ $t('page.ops.btnAddPlanShort') }}
              </Button>
            </div>
          </div>
        </template>

        <template #dateCellRender="{ current }">
          <div class="cell-content flex flex-col justify-between h-full min-h-[85px]">
            <div>
              
              <!-- Maintenance Plan Nodes (Grouped uniquely by eamo_maintenance_plans per Date) -->
              <div
                v-for="planNode in getDailyPlanNodes(current)"
                :key="planNode.key"
                class="mb-1 p-1.5 text-xs rounded border cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-[0.5px] hover:shadow-sm"
                :class="getScheduleClass(planNode.result)"
                :title="`${planNode.plan_code} (${planNode.completed_items}/${planNode.total_items})`"
                @click.stop="planNode.schedules[0] && showScheduleDetail(planNode.schedules[0])"
              >
                <div class="font-semibold text-xs truncate leading-tight flex justify-between items-center">
                  <span>{{ planNode.plan_code }}</span>
                </div>
                <div class="text-[10px] opacity-80 mt-0.5 font-medium leading-tight truncate flex items-center gap-1">
                  <span class="font-semibold">{{ planNode.equipment_code }}</span>
                  <span v-if="planNode.equipment_name" class="opacity-75">— {{ planNode.equipment_name }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Calendar>
    </Spin>

    <!-- Schedule Detail Drawer -->
    <ScheduleDetailDrawer
      v-model:open="drawerVisible"
      :selected-schedule="selectedSchedule"
      :schedules="fetchedSchedules.length > 0 ? fetchedSchedules : props.schedules"
      :maintenance-items="props.maintenanceItems"
      :categories="props.categories"
      :user-options="props.userOptions"
      :equipments="props.equipments"
      :read-only="props.readOnly"
      @update:schedules="handleUpdateSchedules"
    />

    <!-- Maintenance Cell Drawer -->
    <MaintenanceCellDrawer
      v-model:open="dateDetailVisible"
      :date="selectedDate"
      :schedules="selectedDate ? getSchedulesForDay(selectedDate) : []"
      :equipments="localEquipments.length > 0 ? localEquipments : props.equipments"
      :categories="props.categories"
      :maintenance-items="props.maintenanceItems"
      :user-options="props.userOptions"
      :read-only="props.readOnly"
      @schedule-added="fetchSchedules"
      @refresh="fetchSchedules"
    />
  </div>
</template>

<style scoped>
/* Expand calendar cell height so all cells in a row match the tallest cell */
:deep(.ant-picker-cell) {
  height: 100% !important;
}

:deep(.ant-picker-cell-inner) {
  height: 100% !important;
  min-height: 120px !important;
  display: flex !important;
  flex-direction: column !important;
  position: relative;
}

:deep(.ant-picker-calendar-date) {
  height: 100% !important;
  min-height: 120px !important;
  flex: 1 1 auto !important;
  display: flex !important;
  flex-direction: column !important;
}

:deep(.ant-picker-calendar-date-content) {
  flex: 1 1 auto !important;
  height: 100% !important;
  max-height: none !important;
  overflow: visible !important;
  overflow-y: visible !important;
}

:deep(.ant-picker-content) {
  height: auto !important;
}

/* Cell content wrapper */
.cell-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1 1 auto;
  min-height: 100px;
  padding-bottom: 4px;
  position: relative;
}

/* Accent progress bar pinned to top of cell */
.cell-progress-strip-top {
  width: 100%;
  height: 5px;
  background-color: rgba(148, 163, 184, 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
  cursor: default;
}

.cell-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.fill-done {
  background-color: #10b981;
}

.fill-wip {
  background-color: #1890ff;
}

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
