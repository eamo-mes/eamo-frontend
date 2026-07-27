<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Card,
  Button,
  Tag,
  Spin,
  Empty,
  DatePicker,
  Progress,
  Input,
  message,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import {
  listMaintenanceSchedulesApi,
  createMaintenanceLogApi,
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

export interface JudgeScheduleItem {
  schedule_id: string;
  equipment_id?: string;
  item_name: string;
  item_description?: string;
  result: 'pass' | 'fail';
  notes: string;
}

const router = useRouter();
const { t } = useI18n();

const activeView = ref<'list' | 'judge'>('list');
const loading = ref(false);
const submitting = ref(false);

const selectedDate = ref<Dayjs>(dayjs());
const planGroups = ref<DailyPlanGroup[]>([]);

// Judging View State
const selectedPlanGroup = ref<DailyPlanGroup | null>(null);
const judgeItems = ref<JudgeScheduleItem[]>([]);

function getLatestResult(schedule: ScheduleRow): string | null {
  if (schedule.result) return schedule.result;
  if (schedule.maintenance_logs && schedule.maintenance_logs.length > 0) {
    return schedule.maintenance_logs[0]?.result || null;
  }
  return null;
}

function groupSchedulesByPlan(rows: ScheduleRow[], dateStr: string): DailyPlanGroup[] {
  const planMap = new Map<string, DailyPlanGroup>();
  // Filter rows strictly to ensure only items matching dateStr are included for that date
  const dayRows = rows.filter((s) => s.date && s.date.startsWith(dateStr));

  for (const s of dayRows) {
    const planKey = s.maintenance_plan_id || s.plan_code || s.id || 'unknown';
    const latestRes = getLatestResult(s);
    const isCompleted = Boolean(latestRes);
    const isPassed = latestRes === 'pass' || latestRes === 'normal' || latestRes === 'completed';
    const isFailed = latestRes === 'fail' || latestRes === 'abnormal';

    const eqCode = s.equipment_code || s.maintenance_plan?.equipment?.code || '—';
    const eqName = s.equipment_name || s.maintenance_plan?.equipment?.name || null;
    const planCode = s.plan_code || s.maintenance_plan?.plan_code || 'KE HOACH BÁO TRÌ';
    const mType = s.maintenance_type || s.maintenance_plan?.maintenance_type || '—';

    if (!planMap.has(planKey)) {
      planMap.set(planKey, {
        key: `plan-${planKey}-${dateStr}`,
        plan_id: s.maintenance_plan_id || '',
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

function getPlanStatusTag(group: DailyPlanGroup) {
  if (group.status === 'pass') {
    return { color: 'success', label: t('page.ops.statusPassed') || 'Đạt' };
  } else if (group.status === 'fail') {
    return { color: 'error', label: t('page.ops.statusFailed') || 'Không đạt' };
  }
  return { color: 'warning', label: t('page.ops.statusPending') || 'Chưa xong' };
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
  if (activeView.value === 'list') {
    router.push('/portal');
  } else {
    activeView.value = 'list';
  }
}

function startJudge(group: DailyPlanGroup) {
  selectedPlanGroup.value = group;
  const dateStr = selectedDate.value.format('YYYY-MM-DD');
  const daySchedules = group.schedules.filter((s) => s.date && s.date.startsWith(dateStr));

  judgeItems.value = daySchedules.map((s) => {
    const latestRes = getLatestResult(s);
    const existingNotes = (s.maintenance_logs?.[0] as { notes?: string } | undefined)?.notes || '';
    return {
      schedule_id: s.id || '',
      equipment_id: s.equipment_id || s.maintenance_plan?.equipment_id,
      item_name: s.maintenance_item?.name || s.item_name || s.item_name_text || 'Hạng mục bảo trì',
      item_description: s.item_description || s.maintenance_item?.description || '',
      result: latestRes === 'fail' || latestRes === 'abnormal' ? 'fail' : 'pass',
      notes: existingNotes,
    };
  });
  activeView.value = 'judge';
}

async function handleSaveEvaluation() {
  if (!selectedPlanGroup.value) return;
  submitting.value = true;
  try {
    const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss');
    for (const item of judgeItems.value) {
      if (!item.schedule_id) continue;
      await createMaintenanceLogApi({
        maintenance_schedule_id: item.schedule_id,
        equipment_id: item.equipment_id,
        datetime: nowStr,
        result: item.result,
        notes: item.notes.trim() || null,
      });
    }

    message.success(t('page.ops.saveLogSuccess') || 'Đã lưu kết quả bảo trì thành công');
    activeView.value = 'list';
    await fetchSchedules();
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || t('page.ops.saveLogError') || 'Không thể lưu kết quả bảo trì');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchSchedules();
});

watch(selectedDate, () => {
  fetchSchedules();
});
</script>

<template>
  <div class="p-4 sm:p-6 min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-20">
    <!-- ─── HEADER / ACTION BAR ─── -->
    <div class="mb-5 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button
          type="default"
          size="small"
          class="flex items-center justify-center p-1.5 rounded-lg"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <h1 class="text-base font-bold text-slate-800 dark:text-zinc-200 m-0">
          <template v-if="activeView === 'list'">{{ t('page.ops.maintenancePlan') || 'Kế hoạch bảo trì' }}</template>
          <template v-else>{{ t('page.ops.evalMaintenance') || 'Đánh giá Kế hoạch Bảo trì' }}</template>
        </h1>
      </div>
    </div>

    <!-- ─── LOADING SPIN ─── -->
    <div v-if="loading && activeView === 'list'" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── VIEW 1: MAINTENANCE PLAN CARDS LIST ─── -->
    <div v-else-if="activeView === 'list'" class="space-y-4">
      <!-- Date Switcher input component -->
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

      <!-- Maintenance Plan Cards List -->
      <div v-if="planGroups.length > 0" class="flex flex-col gap-3.5">
        <Card
          v-for="group in planGroups"
          :key="group.key"
          class="rounded-2xl shadow-3xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden"
          :body-style="{ padding: '16px' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate m-0">
                {{ group.plan_code }} <span v-if="group.equipment_name">— {{ group.equipment_name }}</span>
              </h3>
              <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-1 mb-0">
                {{ group.equipment_code }}
              </p>
            </div>
            <Tag :color="getPlanStatusTag(group).color" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0">
              {{ getPlanStatusTag(group).label }}
            </Tag>
          </div>

          <div class="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400 mt-3.5">
            <span class="font-semibold text-[11px]">
              {{ t('page.ops.colMaintenanceType') || 'Loại bảo trì' }}: {{ group.maintenance_type || 'Bảo trì định kỳ' }}
            </span>
            <span class="font-medium text-[11px]">
              {{ t('page.ops.checklistDrawer.checkItemsHeader') || 'Tiến độ' }}: {{ group.completed_items }}/{{ group.total_items }}
            </span>
          </div>

          <div class="mt-2.5">
            <Progress
              :percent="getProgressPercent(group)"
              :show-info="false"
              size="small"
              class="m-0"
              :stroke-color="getProgressColor(group)"
            />
          </div>

          <div class="flex items-center gap-2 mt-4">
            <Button
              type="primary"
              class="flex-1 bg-indigo-600 hover:bg-indigo-700 border-none text-xs h-8.5 rounded-xl font-bold"
              @click="startJudge(group)"
            >
              {{ t('page.ops.colResult') || 'Đánh giá' }}
            </Button>
          </div>
        </Card>
      </div>

      <div v-else class="py-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
        <Empty :description="t('page.ops.emptySchedules') || 'Không có kế hoạch bảo trì nào cho ngày này.'" />
      </div>
    </div>

    <!-- ─── VIEW 2: PLAN ITEMS JUDGING SUB-VIEW ─── -->
    <div v-else-if="activeView === 'judge' && selectedPlanGroup" class="space-y-5">
      <Card class="rounded-2xl border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-0 overflow-hidden shadow-xs" :body-style="{ padding: '0px' }">
        <div class="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
          <div class="min-w-0 pr-3">
            <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 truncate">
              {{ selectedPlanGroup.plan_code }} <span v-if="selectedPlanGroup.equipment_name">— {{ selectedPlanGroup.equipment_name }}</span>
            </h3>
            <p class="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-1 mb-0">
              {{ selectedPlanGroup.equipment_code }} | {{ selectedPlanGroup.date }}
            </p>
          </div>
          <Tag color="blue" class="m-0 font-bold text-[9px] uppercase px-2 py-0.5 rounded-md shrink-0">
            {{ selectedPlanGroup.total_items }} HẠNG MỤC
          </Tag>
        </div>
      </Card>

      <!-- Child Items Loop -->
      <div class="space-y-3">
        <label class="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block px-1">
          {{ t('page.ops.dailyMaintenanceItemsHeader') || 'Hạng mục bảo trì trong ngày' }} ({{ judgeItems.length }})
        </label>

        <div v-if="judgeItems.length === 0" class="py-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl flex justify-center">
          <Empty :description="t('page.ops.noItemsToJudge') || 'Không có hạng mục nào để đánh giá.'" />
        </div>

        <div v-else class="flex flex-col gap-3.5">
          <div
            v-for="(item, index) in judgeItems"
            :key="item.schedule_id || index"
            class="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-3xs space-y-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <span class="text-xs font-bold text-slate-800 dark:text-zinc-200 leading-snug block">
                  {{ item.item_name }}
                </span>
                <p v-if="item.item_description" class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 mb-0 line-clamp-2">
                  {{ item.item_description }}
                </p>
              </div>

              <Button
                type="default"
                size="small"
                :class="[
                  'flex items-center gap-1 px-2.5 py-1 font-bold transition-all rounded-lg shrink-0 border text-[10px]',
                  item.result === 'pass'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600'
                    : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-600'
                ]"
                @click="item.result = item.result === 'pass' ? 'fail' : 'pass'"
              >
                <svg
                  v-if="item.result === 'pass'"
                  class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <svg
                  v-else
                  class="w-3.5 h-3.5 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span class="uppercase tracking-wider">
                  {{ item.result === 'pass' ? t('page.ops.checklistDrawer.statusPass') : t('page.ops.checklistDrawer.statusFail') }}
                </span>
              </Button>
            </div>

            <!-- Optional Notes -->
            <div>
              <Input.Textarea
                v-model:value="item.notes"
                :rows="2"
                class="rounded-xl border-slate-200/80 dark:border-zinc-800 text-[11px]"
                :placeholder="t('page.ops.notesPlaceholder') || 'Ghi chú cho hạng mục này (nếu có)...'"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 p-4 z-50 flex items-center justify-between gap-3">
        <Button class="flex-1 h-10 font-bold rounded-xl" @click="activeView = 'list'">
          {{ t('page.ops.btnCancel') || 'Hủy' }}
        </Button>
        <Button
          type="primary"
          class="flex-1 h-10 font-bold bg-indigo-600 hover:bg-indigo-700 border-none rounded-xl"
          :loading="submitting"
          @click="handleSaveEvaluation"
        >
          {{ t('page.ops.btnSave') || 'Lưu kết quả' }}
        </Button>
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

:deep(.ant-card) {
  margin-bottom: 0 !important;
}
</style>
