<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { Calendar, Spin, message } from 'ant-design-vue';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { listUsersApi } from '#/api/core/users';
import { $t } from '#/locales';
import type { EquipmentDetail, ChecklistSession, ChecklistDetailItem, ChecklistLog, UserOption } from './types';
import ChecklistJudgeDrawer from './ChecklistJudgeDrawer.vue';

const props = defineProps<{
  equipments: EquipmentDetail[];
  equipmentId?: string;
}>();

const emit = defineEmits<{
  (e: 'refresh-list'): void;
}>();

const loading = ref(false);
const sessions = ref<ChecklistSession[]>([]);
const calendarValue = ref<Dayjs>(dayjs());

const isModalOpen = ref(false);
const selectedSession = ref<ChecklistSession | null>(null);
const usersList = ref<UserOption[]>([]);

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function fetchSessions(): Promise<void> {
  loading.value = true;
  try {
    const startOfMonth = calendarValue.value.startOf('month').format('YYYY-MM-DD');
    const endOfMonth = calendarValue.value.endOf('month').format('YYYY-MM-DD');

    const params: Record<string, string | number | boolean> = {
      include_details: true,
      start_date: startOfMonth,
      end_date: endOfMonth,
      per_page: 200,
    };
    if (props.equipmentId) {
      params.equipment_id = props.equipmentId;
    }

    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions`, {
      headers: getAuthHeaders(),
      params,
    });

    const raw = res.data?.data ?? res.data ?? [];
    sessions.value = Array.isArray(raw) ? raw : [];
  } catch (err: unknown) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
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
    ?.filter(log => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

function getSessionStatus(session: ChecklistSession): 'warning' | 'error' | 'success' {
  if (!session.details || session.details.length === 0) return 'warning';

  const completedLogs = session.details.map(getLatestCompletedLog);
  if (completedLogs.some(log => !log)) return 'warning';

  const hasFail = completedLogs.some(log => log?.result === 'fail');
  return hasFail ? 'error' : 'success';
}

function getSessionStatusLabel(session: ChecklistSession): string {
  const status = getSessionStatus(session);
  if (status === 'error') return $t('page.ops.statusFailed');
  if (status === 'success') return $t('page.ops.statusPassed');
  return $t('page.ops.statusPending');
}

function getSessionClass(session: ChecklistSession): string {
  const status = getSessionStatus(session);
  switch (status) {
    case 'success':
      return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-250 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
    case 'error':
      return 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-250 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40';
    default:
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-250 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40';
  }
}

function getSessionsForDay(date: Dayjs): ChecklistSession[] {
  const dateStr = date.format('YYYY-MM-DD');
  const dailySessions = new Map<string, ChecklistSession>();

  for (const session of sessions.value) {
    const schedules = session.schedules ?? [];
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
});
</script>

<template>
  <div>
    <div class="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div class="flex justify-between items-center">
        <div class="font-semibold text-gray-700 dark:text-gray-300">
          {{ $t('page.ops.checklistCalendarTitle') }}
        </div>
      </div>

      <Spin :spinning="loading">
        <Calendar v-model:value="calendarValue">
          <template #dateCellRender="{ current }">
            <ul class="relative z-10 list-none p-0 m-0 overflow-y-auto max-h-[85px]">
              <li
                v-for="session in getSessionsForDay(current)"
                :key="session.id"
                class="mb-1 py-0.5 px-2 text-xs rounded border truncate cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-[0.5px] hover:shadow-sm font-semibold flex items-center justify-between gap-1"
                :class="getSessionClass(session)"
                :title="session.equipment?.name || ''"
                @click.stop="openJudgeModal(session)"
              >
                <span class="truncate">
                  {{ session.equipment?.name || $t('page.ops.placeholderEquipment') }}
                </span>
                <span class="text-[10px] opacity-80 shrink-0 font-medium">
                  {{ getSessionStatusLabel(session) }}
                </span>
              </li>
            </ul>
          </template>
        </Calendar>
      </Spin>
    </div>

    <ChecklistJudgeDrawer
      v-model:open="isModalOpen"
      :session="selectedSession"
      :users-list="usersList"
      @submitted="handleSubmitted"
    />
  </div>
</template>
