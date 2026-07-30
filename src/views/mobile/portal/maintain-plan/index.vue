<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Spin,
  Empty,
  DatePicker,
  message,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import {
  listMaintenanceSchedulesApi,
  type ScheduleRow,
} from '#/api/ops/maintenance-plans';

defineOptions({ name: 'MobilePortalMaintainPlan' });

export interface DailyPlanGroup {
  key: string;
  plan_id: string;
  plan_code: string;
  date: string;
  equipment_code: string;
  equipment_name: string | null;
  maintenance_type?: string;
  schedules: ScheduleRow[];
  total_items: number;
  completed_items: number;
  status: 'pass' | 'fail' | 'pending';
}

const router = useRouter();
const { t } = useI18n();

const loading = ref(false);
const selectedDate = ref<Dayjs>(dayjs());
const planGroups = ref<DailyPlanGroup[]>([]);

function getLatestResult(schedule: ScheduleRow): string | null {
  if (schedule.result) return schedule.result;
  if (schedule.maintenance_logs && schedule.maintenance_logs.length > 0) {
    return schedule.maintenance_logs[0]?.result || null;
  }
  return null;
}

function groupSchedulesByPlan(rows: ScheduleRow[], dateStr: string): DailyPlanGroup[] {
  const planMap = new Map<string, DailyPlanGroup>();
  const planItemSeenMap = new Map<string, Set<string>>();
  const dayRows = rows.filter((s) => s.date && s.date.startsWith(dateStr));

  for (const s of dayRows) {
    const planKey = s.maintenance_plan_id || s.plan_code || s.id || 'unknown';
    const itemKey = s.maintenance_item_id || s.item_name || s.maintenance_item?.name || s.id || '';

    if (!planItemSeenMap.has(planKey)) {
      planItemSeenMap.set(planKey, new Set());
    }
    const itemSeenSet = planItemSeenMap.get(planKey)!;
    if (itemSeenSet.has(itemKey)) {
      continue;
    }
    itemSeenSet.add(itemKey);

    const latestRes = getLatestResult(s);
    const isCompleted = Boolean(latestRes);
    const isPassed = latestRes === 'pass' || latestRes === 'normal' || latestRes === 'completed';
    const isFailed = latestRes === 'fail' || latestRes === 'abnormal';

    const eqCode = s.equipment_code || s.maintenance_plan?.equipment?.code || '—';
    const eqName = s.equipment_name || s.maintenance_plan?.equipment?.name || null;
    const planCode = s.plan_code || s.maintenance_plan?.plan_code || 'KẾ HOẠCH BẢO TRÌ';
    const mType = s.maintenance_type || s.maintenance_plan?.maintenance_type || '—';

    if (!planMap.has(planKey)) {
      planMap.set(planKey, {
        key: `plan-${planKey}-${dateStr}`,
        plan_id: s.maintenance_plan_id || s.id || '',
        plan_code: planCode,
        date: dateStr,
        equipment_code: eqCode,
        equipment_name: eqName,
        maintenance_type: mType,
        schedules: [s],
        total_items: 1,
        completed_items: isCompleted ? 1 : 0,
        status: isFailed ? 'fail' : isCompleted && isPassed ? 'pass' : 'pending',
      });
    } else {
      const node = planMap.get(planKey)!;
      node.schedules.push(s);
      node.total_items += 1;
      if (isCompleted) {
        node.completed_items += 1;
      }

      if (isFailed || node.status === 'fail') {
        node.status = 'fail';
      } else if (node.completed_items === node.total_items) {
        node.status = 'pass';
      } else {
        node.status = 'pending';
      }
    }
  }

  return Array.from(planMap.values());
}

async function fetchSchedules() {
  loading.value = true;
  try {
    const dateStr = selectedDate.value.format('YYYY-MM-DD');
    const rawSchedules = await listMaintenanceSchedulesApi({
      start_date: dateStr,
      end_date: dateStr,
      with_logs: true,
    });
    const scheduleArray = Array.isArray(rawSchedules) ? rawSchedules : [];
    planGroups.value = groupSchedulesByPlan(scheduleArray, dateStr);
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || t('page.ops.loadSchedulesError') || 'Không thể tải danh sách bảo trì');
  } finally {
    loading.value = false;
  }
}

function getProgressPercent(group: DailyPlanGroup): number {
  if (group.total_items === 0) return 0;
  return Math.round((group.completed_items / group.total_items) * 100);
}

function getProgressColor(group: DailyPlanGroup): string {
  if (group.status === 'pass') return '#52c41a';
  if (group.status === 'fail') return '#f5222d';
  return '#1890ff';
}

function changeDate(days: number) {
  selectedDate.value = selectedDate.value.add(days, 'day');
}

function handleDateChange(val: unknown) {
  if (val) {
    selectedDate.value = dayjs(val as string | Date);
  }
}

function handleBack() {
  router.push('/portal');
}

function startJudge(group: DailyPlanGroup) {
  const targetId = group.plan_id || group.schedules[0]?.id || group.plan_code;
  const dateStr = selectedDate.value.format('YYYY-MM-DD');
  router.push(`/portal/maintain-plan/${targetId}?date=${dateStr}`);
}

onMounted(() => {
  fetchSchedules();
});

watch(selectedDate, () => {
  fetchSchedules();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-20">
    <!-- ─── HEADER ─── -->
    <div class="bg-white dark:bg-zinc-900 border-b border-slate-200/70 dark:border-zinc-800 px-4 pt-4 pb-3 flex items-center gap-3 mb-4">
      <button
        type="button"
        class="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
        @click="handleBack"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 flex-1 truncate">
        {{ t('page.ops.maintenancePlan') || 'Kế hoạch bảo trì' }}
      </h1>
    </div>

    <!-- ─── LOADING SPIN ─── -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── MAINTENANCE PLAN LIST ─── -->
    <div v-else class="space-y-4 px-4">
      <!-- Date Switcher -->
      <div class="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-3xs">
        <button
          type="button"
          class="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
          @click="changeDate(-1)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>

        <DatePicker
          :value="selectedDate"
          @change="handleDateChange"
          format="YYYY-MM-DD"
          :allow-clear="false"
          class="flex-1 border-none bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl py-1 px-2 cursor-pointer"
          style="width: 100%"
        />

        <button
          type="button"
          class="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
          @click="changeDate(1)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      <!-- Maintenance Plan Rows -->
      <div v-if="planGroups.length > 0" class="space-y-3">
        <div
          v-for="group in planGroups"
          :key="group.key"
          class="group flex items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl px-3.5 py-3.5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800/60 hover:shadow-sm active:scale-[0.99] transition-all duration-150"
          @click="startJudge(group)"
        >
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
              {{ group.plan_code }}
            </p>
            <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 mb-0 truncate">
              {{ group.equipment_code }}
              <span class="text-slate-300 dark:text-zinc-600 mx-1">·</span>
              {{ group.maintenance_type }}
            </p>
          </div>

          <!-- Progress ring -->
          <div class="shrink-0 w-10 h-10 relative flex items-center justify-center">
            <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke-width="2.5" class="stroke-slate-100 dark:stroke-zinc-800" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke-width="2.5"
                :stroke="getProgressColor(group)"
                :stroke-dasharray="`${getProgressPercent(group) * 0.974} 97.4`"
                stroke-linecap="round" />
            </svg>
            <span class="absolute text-[9px] font-bold text-slate-600 dark:text-zinc-400">
              {{ getProgressPercent(group) }}%
            </span>
          </div>

          <!-- Chevron -->
          <svg class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 shrink-0 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>

      <div v-else class="py-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
        <Empty :description="t('page.ops.emptySchedules') || 'Không có kế hoạch bảo trì nào cho ngày này.'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Override datepicker default borders and align centered date & icon */
:deep(.ant-picker) {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  padding: 4px 8px !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

:deep(.ant-picker-input) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-direction: row !important;
  gap: 6px !important;
}

:deep(.ant-picker-input > input) {
  text-align: center !important;
  font-weight: 700 !important;
  color: inherit !important;
  flex: 0 1 auto !important;
  width: 105px !important;
}

:deep(.ant-picker-suffix) {
  margin-left: 0 !important;
  display: flex !important;
  align-items: center !important;
  color: #94a3b8 !important;
}
</style>
