<script lang="ts" setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { Calendar, Spin, Switch, Select, Radio, Button, message } from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';
import { requestClient } from '#/api/request';
import { listUsersApi } from '#/api/core/users';
import { $t } from '#/locales';
import type { EquipmentOption, ChecklistSession, ChecklistDetailItem, ChecklistLog, UserOption } from '../types';
import WorkspaceChecklistDrawer from './WorkspaceChecklistDrawer.vue';
import ChecklistJudgeDrawer from '../../../ops/checklist/components/ChecklistJudgeDrawer.vue';

const dateDetailVisible = ref(false);
const selectedDate = ref<Dayjs | null>(null);

function openCreateDrawer(date?: Dayjs): void {
  selectedDate.value = date || dayjs();
  dateDetailVisible.value = true;
}

defineExpose({
  openCreateDrawer,
});

const props = defineProps<{
  equipments: EquipmentOption[];
  equipmentId?: string;
}>();

const emit = defineEmits<{
  (e: 'refresh-list'): void;
}>();

const loading = ref(false);
const filterFromCurrentWeek = ref(false);
const calendarContainerRef = ref<HTMLDivElement | null>(null);
const calendarValue = ref<Dayjs>(dayjs());
const sessions = ref<ChecklistSession[]>([]);

const isModalOpen = ref(false);
const selectedSession = ref<ChecklistSession | null>(null);
const usersList = ref<UserOption[]>([]);

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

function onPanelChange(date: Dayjs | string): void {
  const d = dayjs(date);
  calendarValue.value = d;
  nextTick(() => {
    applyWeekFilter();
  });
}

function onSelect(date: Dayjs | string): void {
  const d = dayjs(date);
  calendarValue.value = d;
  nextTick(() => {
    applyWeekFilter();
  });
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

watch(
  [filterFromCurrentWeek, calendarValue],
  () => {
    nextTick(() => {
      applyWeekFilter();
    });
  },
  { immediate: true }
);

async function fetchSessions(): Promise<void> {
  loading.value = true;
  try {
    const startOfMonth = calendarValue.value.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
    const endOfMonth = calendarValue.value.endOf('month').add(7, 'day').format('YYYY-MM-DD');

    const params: Record<string, string | number | boolean> = {
      include_details: true,
      start_date: startOfMonth,
      end_date: endOfMonth,
      per_page: 500,
    };
    if (props.equipmentId) {
      params.equipment_id = props.equipmentId;
    }

    const raw = await requestClient.get('/v1/checklist-sessions', { params });
    const responseData = (raw as { data?: ChecklistSession[]; items?: ChecklistSession[] })?.data 
      ?? (raw as { items?: ChecklistSession[] })?.items 
      ?? (Array.isArray(raw) ? raw : []);

    sessions.value = Array.isArray(responseData) ? (responseData as ChecklistSession[]) : [];
    nextTick(() => {
      applyWeekFilter();
    });
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || $t('page.ops.loadChecklistError'));
  } finally {
    loading.value = false;
  }
}

async function fetchUsers(): Promise<void> {
  try {
    const raw = await listUsersApi({ per_page: 1000 });
    usersList.value = Array.isArray(raw) ? (raw as unknown as UserOption[]) : [];
  } catch {
    // silently fail
  }
}

function getLatestCompletedLog(detail: ChecklistDetailItem): ChecklistLog | undefined {
  return detail.logs
    ?.filter((log) => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

function getSessionStatus(session: ChecklistSession): 'error' | 'success' {
  if (!session.details || session.details.length === 0) return 'error';

  const completedLogs = session.details.map(getLatestCompletedLog);
  const allCompleted = completedLogs.every((log) => log !== undefined);
  const allPassed = allCompleted && completedLogs.every((log) => log?.result === 'pass');

  return allPassed ? 'success' : 'error';
}

function getSessionClass(session: ChecklistSession): string {
  const status = getSessionStatus(session);
  if (status === 'success') {
    return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
  }
  return 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40';
}

function getSessionsForDay(date: Dayjs): ChecklistSession[] {
  const dateStr = date.format('YYYY-MM-DD');
  const dailySessions = new Map<string, ChecklistSession>();

  for (const session of sessions.value) {
    const schedules = session.schedules ?? [];
    if (schedules.length > 0) {
      for (const schedule of schedules) {
        if (!schedule.date.startsWith(dateStr)) {
          continue;
        }

        const key = `${session.id}-${dateStr}`;
        const dailySession = dailySessions.get(key) ?? {
          ...session,
          session_date: schedule.date,
          details: [],
        };

        dailySession.details?.push({
          id: schedule.checklist_detail_id,
          schedule_id: schedule.id,
          checklist_id: schedule.checklist_id,
          description: schedule.description,
          logs: schedule.logs,
        });
        dailySessions.set(key, dailySession);
      }
    } else if (session.session_date?.startsWith(dateStr) || (session.created_at && session.created_at.startsWith(dateStr))) {
      dailySessions.set(session.id, session);
    }
  }

  return [...dailySessions.values()];
}

function openJudgeModal(session: ChecklistSession): void {
  selectedSession.value = session;
  isModalOpen.value = true;
}

async function handleSubmitted(): Promise<void> {
  await fetchSessions();
  emit('refresh-list');
}

watch([calendarValue, () => props.equipmentId], () => {
  fetchSessions();
}, { immediate: true });

onMounted(() => {
  fetchUsers();
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
</script>

<template>
  <div ref="calendarContainerRef" class="space-y-4">
    <Spin :spinning="loading">
      <Calendar
        v-model:value="calendarValue"
        @panelChange="onPanelChange"
        @select="onSelect"
      >
        <template #headerRender="{ value, type, onChange, onTypeChange }">
          <div class="flex items-center justify-between pb-3 border-b border-border mb-3">
            <div class="flex items-center gap-4">
              <h3 class="font-semibold text-foreground text-base m-0">
                {{ value.format('MMMM YYYY') }}
              </h3>
              <div class="flex items-center gap-2">
                <Switch v-model:checked="filterFromCurrentWeek" />
                <span class="text-xs font-medium text-foreground">{{ $t('page.ops.filterFromCurrentWeek') }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <Select
                :value="value.year()"
                :options="getYearOptions(value)"
                class="w-28"
                @change="(y) => onChange(value.year(y as number))"
              />

              <Select
                :value="value.month()"
                :options="monthOptions"
                class="w-24"
                @change="(m) => onChange(value.month(m as number))"
              />

              <Radio.Group
                :value="type"
                @change="(e) => onTypeChange(e.target.value)"
              >
                <Radio.Button value="month">Month</Radio.Button>
                <Radio.Button value="year">Year</Radio.Button>
              </Radio.Group>

              <Button
                type="primary"
                class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white px-3.5 flex items-center"
                @click="openCreateDrawer()"
              >
                {{ $t('page.ops.checklistDrawer.btnCreateSession') || 'Tạo phiên kiểm tra mới' }}
              </Button>
            </div>
          </div>
        </template>

        <template #dateCellRender="{ current }">
          <div class="cell-content flex flex-col justify-between h-full min-h-[85px]">
            <div>
              <!-- Progress bar at top of cell -->
              <!-- Checklist Sessions -->
              <div
                v-for="session in getSessionsForDay(current)"
                :key="session.id"
                class="mb-1 p-1.5 text-xs rounded border cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-[0.5px] hover:shadow-sm"
                :class="getSessionClass(session)"
                :title="session.equipment?.name || session.name || ''"
                @click.stop="openJudgeModal(session)"
              >
                <div class="font-semibold text-xs truncate leading-tight">
                  {{ session.name || session.equipment?.name || $t('page.ops.checklistDrawer.sessionText') }}
                </div>
                <div class="text-[10px] opacity-80 mt-1 font-medium leading-tight truncate">
                  {{ session.equipment?.code || '—' }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </Calendar>
    </Spin>

    <!-- Workspace Checklist Drawer (Manage eamo_checklist_sessions & eamo_checklist_details) -->
    <WorkspaceChecklistDrawer
      v-model:open="dateDetailVisible"
      :date="selectedDate"
      :checklist-sessions="selectedDate ? getSessionsForDay(selectedDate) : []"
      :equipments="props.equipments"
      :user-options="usersList"
      @refresh="fetchSessions"
    />

    <!-- Checklist Judge Drawer (Evaluate specific checklist session node) -->
    <ChecklistJudgeDrawer
      v-model:open="isModalOpen"
      :session="selectedSession"
      :users-list="usersList"
      @submitted="handleSubmitted"
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
