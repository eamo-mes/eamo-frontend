<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import { useUserStore } from '@vben/stores';
import {
  Card,
  Button,
  Tag,
  Spin,
  Empty,
  DatePicker,
  Progress,
  message,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { requestClient } from '#/api/request';
import {
  getChecklistSessionsApi,
  judgeChecklistSessionApi,
} from '#/api/ops/checklist';
import type {
  ChecklistSession,
  ChecklistDetailItem,
  ChecklistLog,
  JudgeDetailItem,
} from '#/views/dashboard/workspace/types';

defineOptions({ name: 'MobilePortalChecklist' });

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();

const activeView = ref<'list' | 'judge'>('list');
const loading = ref(false);
const submitting = ref(false);

const selectedDate = ref<Dayjs>(dayjs());
const sessions = ref<ChecklistSession[]>([]);

// Judging View State
const selectedSession = ref<ChecklistSession | null>(null);
const judgeDetails = ref<JudgeDetailItem[]>([]);

const currentUserId = computed(() => userStore.userInfo?.userId || (userStore.userInfo as { id?: string } | null)?.id || '');

async function fetchSessions() {
  loading.value = true;
  try {
    const dateStr = selectedDate.value.format('YYYY-MM-DD');
    const raw = await getChecklistSessionsApi({
      include_details: true,
      start_date: dateStr,
      end_date: dateStr,
      per_page: 100,
    });
    const responseData = (raw as { data?: ChecklistSession[]; items?: ChecklistSession[] })?.data 
      ?? (raw as { items?: ChecklistSession[] })?.items 
      ?? (Array.isArray(raw) ? raw : []);

    sessions.value = Array.isArray(responseData) ? (responseData as ChecklistSession[]) : [];
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || t('page.ops.loadChecklistError') || 'Không thể tải danh sách kiểm tra');
  } finally {
    loading.value = false;
  }
}

function getLatestCompletedLog(detail: ChecklistDetailItem): ChecklistLog | undefined {
  return detail.logs
    ?.filter((log) => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

function getSessionStatus(session: ChecklistSession): 'pass' | 'fail' | 'pending' {
  if (!session.details || session.details.length === 0) return 'pending';
  const completedLogs = session.details.map(getLatestCompletedLog);
  const allCompleted = completedLogs.every((log) => log !== undefined);
  if (!allCompleted) return 'pending';
  const allPassed = completedLogs.every((log) => log?.result === 'pass');
  return allPassed ? 'pass' : 'fail';
}

function getSessionStatusTag(session: ChecklistSession) {
  const status = getSessionStatus(session);
  if (status === 'pass') {
    return { color: 'success', label: t('page.ops.statusPassed') || 'Đạt' };
  } else if (status === 'fail') {
    return { color: 'error', label: t('page.ops.statusFailed') || 'Không đạt' };
  }
  return { color: 'warning', label: t('page.ops.statusPending') || 'Chưa xong' };
}

function getCompletedCount(session: ChecklistSession): number {
  if (!session.details) return 0;
  return session.details.filter((d) => getLatestCompletedLog(d) !== undefined).length;
}

function getProgressPercent(session: ChecklistSession): number {
  if (!session.details || session.details.length === 0) return 0;
  return Math.round((getCompletedCount(session) / session.details.length) * 100);
}

function getProgressColor(session: ChecklistSession): string {
  const status = getSessionStatus(session);
  if (status === 'pass') return '#52c41a';
  if (status === 'fail') return '#f5222d';
  return '#1890ff';
}

function getCycleText(type?: string): string {
  switch (type) {
    case 'daily':
      return t('page.ops.cycleDaily') || 'Hàng ngày';
    case 'weekly':
      return t('page.ops.cycleWeekly') || 'Hàng tuần';
    case 'monthly':
      return t('page.ops.cycleMonthly') || 'Hàng tháng';
    case 'yearly':
      return t('page.ops.cycleYearly') || 'Hàng năm';
    default:
      return type || '—';
  }
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

// Open judging view
function startJudge(session: ChecklistSession) {
  selectedSession.value = session;
  judgeDetails.value = (session.details || []).map((d) => {
    const latestLog = getLatestCompletedLog(d);
    return {
      checklist_id: d.checklist_id || '',
      description: d.description || '',
      result: latestLog?.result === 'pass' ? 'pass' : 'fail',
    };
  });

  activeView.value = 'judge';
}

async function handleJudgeSubmit(): Promise<void> {
  if (!selectedSession.value) return;
  submitting.value = true;
  try {
    const session = selectedSession.value;
    const scheduleIds = session.details
      ?.map((detail) => detail.schedule_id)
      .filter((id): id is string => Boolean(id));

    // Prefill user_ids: reuse session users or fall back to currently logged-in user
    let userIds = session.users && session.users.length > 0
      ? session.users.map((u) => u.id)
      : [];
    if (userIds.length === 0 && currentUserId.value) {
      userIds = [currentUserId.value];
    }

    // Prefill date and time
    const executionDate = session.session_date
      ? dayjs(session.session_date).format('YYYY-MM-DD')
      : selectedDate.value.format('YYYY-MM-DD');
    const executionTime = session.session_date
      ? dayjs(session.session_date).format('HH:mm:ss')
      : dayjs().format('HH:mm:ss');

    // Update checklist session assignment and dates in background
    await requestClient.put(`/v1/checklist-sessions/${session.id}`, {
      user_ids: userIds,
      schedules:
        scheduleIds && scheduleIds.length > 0
          ? scheduleIds.map((id) => ({
              id,
              date: executionDate,
              user_ids: userIds,
            }))
          : undefined,
    });

    // Submit judge results
    const payload = {
      session_id: session.id,
      results: judgeDetails.value.map((item) => ({
        checklist_id: item.checklist_id,
        result: item.result,
        description: item.description,
      })),
      user_ids: userIds,
      timestamp: `${executionDate} ${executionTime}`,
    };

    await judgeChecklistSessionApi(payload);

    message.success(t('page.ops.judgeSuccess') || 'Đánh giá checklist thành công');
    activeView.value = 'list';
    await fetchSessions();
  } catch (err: unknown) {
    const apiErr = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiErr || 'Không thể lưu đánh giá');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchSessions();
});

watch(selectedDate, () => {
  fetchSessions();
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
          <template v-if="activeView === 'list'">{{ t('page.ops.checklist') || 'Kiểm tra thiết bị' }}</template>
          <template v-else>{{ t('page.ops.checklistDrawer.btnDetail') || 'Đánh giá Checklist' }}</template>
        </h1>
      </div>
    </div>

    <!-- ─── LOADING SPIN ─── -->
    <div v-if="loading && activeView === 'list'" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── VIEW 1: CHECKLIST SESSION LIST ─── -->
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

      <!-- Sessions List -->
      <div v-if="sessions.length > 0" class="flex flex-col gap-3.5">
        <Card
          v-for="session in sessions"
          :key="session.id"
          class="rounded-2xl shadow-3xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden"
          :body-style="{ padding: '16px' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate m-0">
                {{ session.name || session.equipment?.name || t('page.ops.checklistDrawer.sessionText') }}
              </h3>
              <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-1 mb-0">
                {{ session.equipment?.code || '—' }} <span v-if="session.equipment?.name">— {{ session.equipment.name }}</span>
              </p>
            </div>
            <Tag :color="getSessionStatusTag(session).color" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0">
              {{ getSessionStatusTag(session).label }}
            </Tag>
          </div>

          <div class="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400 mt-3.5">
            <span class="font-semibold text-[11px]">
              {{ t('page.ops.colCycleType') || 'Chu kỳ' }}: {{ getCycleText(session.cycle_type) }}
              <span v-if="session.cycle_interval && session.cycle_interval > 1">({{ session.cycle_interval }})</span>
            </span>
            <span class="font-medium text-[11px]">{{ t('page.ops.checklistDrawer.checkItemsHeader') || 'Tiến độ' }}: {{ getCompletedCount(session) }}/{{ session.details?.length || 0 }}</span>
          </div>

          <div class="mt-2.5">
            <Progress
              :percent="getProgressPercent(session)"
              :show-info="false"
              size="small"
              class="m-0"
              :stroke-color="getProgressColor(session)"
            />
          </div>

          <div class="flex items-center gap-2 mt-4">
            <Button
              type="primary"
              class="flex-1 bg-indigo-600 hover:bg-indigo-700 border-none text-xs h-8.5 rounded-xl font-bold"
              @click="startJudge(session)"
            >
              {{ t('page.ops.colResult') || 'Đánh giá' }}
            </Button>
          </div>
        </Card>
      </div>

      <div v-else class="py-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
        <Empty :description="t('page.ops.checklistDrawer.emptySessions') || 'Không có phiên kiểm tra nào cho ngày này.'" />
      </div>
    </div>

    <!-- ─── VIEW 2: CHECKLIST JUDGING SUB-VIEW ─── -->
    <div v-else-if="activeView === 'judge' && selectedSession" class="space-y-5">
      <Card class="rounded-2xl border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-0 overflow-hidden shadow-xs" :body-style="{ padding: '0px' }">
        <div class="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
          <div class="min-w-0 pr-3">
            <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 truncate">
              {{ selectedSession.equipment?.name || selectedSession.name || t('page.ops.checklistDrawer.sessionText') }}
            </h3>
            <p class="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-1 mb-0">
              {{ selectedSession.session_date ? dayjs(selectedSession.session_date).format('YYYY-MM-DD HH:mm') : '—' }}
            </p>
          </div>
        </div>
      </Card>

      <!-- Checklist Items Loop -->
      <div class="space-y-3">
        <label class="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block px-1">
          {{ t('page.ops.dailyChecklistItemsHeader') || 'Hạng mục checklist trong ngày' }} ({{ judgeDetails.length }})
        </label>

        <div v-if="judgeDetails.length === 0" class="py-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl flex justify-center">
          <Empty :description="t('page.ops.noItemsToJudge') || 'Không có hạng mục nào để đánh giá.'" />
        </div>

        <div v-else class="flex flex-col gap-3">
          <div
            v-for="(item, index) in judgeDetails"
            :key="index"
            class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-3xs"
          >
            <div class="flex-1 min-w-0">
              <span class="text-xs font-bold text-slate-700 dark:text-zinc-300 leading-snug block break-words">
                {{ item.description || `Hạng mục ${index + 1}` }}
              </span>
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
          @click="handleJudgeSubmit"
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
