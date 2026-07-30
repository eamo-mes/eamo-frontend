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
import { getChecklistSessionsApi } from '#/api/ops/checklist';
import type {
  ChecklistSession,
  ChecklistDetailItem,
  ChecklistLog,
} from '#/views/dashboard/workspace/types';

defineOptions({ name: 'MobilePortalChecklist' });

const router = useRouter();
const { t } = useI18n();

const loading = ref(false);
const selectedDate = ref<Dayjs>(dayjs());
const sessions = ref<ChecklistSession[]>([]);

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
  const hasFail = session.details.some((d) => getLatestCompletedLog(d)?.result === 'fail');
  if (hasFail) return 'fail';
  const allPassed = session.details.every((d) => getLatestCompletedLog(d)?.result === 'pass');
  return allPassed ? 'pass' : 'pending';
}

function getPassCount(session: ChecklistSession): number {
  if (!session.details) return 0;
  return session.details.filter((d) => getLatestCompletedLog(d)?.result === 'pass').length;
}

function getProgressPercent(session: ChecklistSession): number {
  if (!session.details || session.details.length === 0) return 0;
  return Math.round((getPassCount(session) / session.details.length) * 100);
}

function getProgressColor(session: ChecklistSession): string {
  const status = getSessionStatus(session);
  if (status === 'fail') return '#f5222d';
  const percent = getProgressPercent(session);
  if (percent >= 100) return '#52c41a';
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

function startJudge(session: ChecklistSession) {
  if (session.id) {
    router.push(`/portal/checklist/${session.id}`);
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
        {{ t('page.ops.checklist') || 'Kiểm tra thiết bị' }}
      </h1>
    </div>

    <!-- ─── LOADING SPIN ─── -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── CHECKLIST SESSION LIST ─── -->
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

      <!-- Sessions List -->
      <div v-if="sessions.length > 0" class="space-y-3">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="group flex items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl px-3.5 py-3.5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800/60 hover:shadow-sm active:scale-[0.99] transition-all duration-150"
          @click="startJudge(session)"
        >
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
              {{ session.name || session.equipment?.name || '—' }}
            </p>
            <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 mb-0 truncate">
              {{ session.equipment?.code || '—' }}
            </p>
          </div>

          <!-- Progress ring -->
          <div class="shrink-0 w-10 h-10 relative flex items-center justify-center">
            <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke-width="2.5" class="stroke-slate-100 dark:stroke-zinc-800" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke-width="2.5"
                :stroke="getProgressColor(session)"
                :stroke-dasharray="`${getProgressPercent(session) * 0.974} 97.4`"
                stroke-linecap="round" />
            </svg>
            <span class="absolute text-[9px] font-bold text-slate-600 dark:text-zinc-400">
              {{ getProgressPercent(session) }}%
            </span>
          </div>

          <!-- Chevron -->
          <svg class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 shrink-0 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>

      <div v-else class="py-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
        <Empty :description="t('page.ops.checklistDrawer.emptySessions') || 'Không có phiên kiểm tra nào cho ngày này.'" />
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
