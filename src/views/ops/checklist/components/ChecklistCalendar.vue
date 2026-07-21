<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Calendar,
  DatePicker,
  Drawer,
  Button,
  Popconfirm,
  Select,
  Spin,
  Tag,
  message,
} from 'ant-design-vue';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { listUsersApi } from '#/api/core/users';
import { $t } from '#/locales';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface EquipmentDetail {
  id: string;
  code: string;
  name: string;
}

interface ChecklistDetailItem {
  id: string;
  schedule_id?: string;
  checklist_id: string;
  description: string;
  logs?: ChecklistLog[];
}

interface ChecklistLog {
  id: string;
  status: 'pending' | 'completed';
  result: 'pass' | 'fail' | null;
  checked_at?: string | null;
}

interface ChecklistSchedule {
  id: string;
  date: string;
  checklist_detail_id: string;
  checklist_id: string;
  description: string;
  logs: ChecklistLog[];
}

interface ChecklistSession {
  id: string;
  name?: string;
  equipment_id: string | null;
  equipment?: EquipmentDetail | null;
  session_date: string | null;
  details?: ChecklistDetailItem[];
  schedules?: ChecklistSchedule[];
  users?: UserOption[];
}

interface JudgeDetailItem {
  checklist_id: string;
  description: string;
  result: 'pass' | 'fail';
}

const router = useRouter();

const props = defineProps<{
  equipments: EquipmentDetail[];
  equipmentId?: string;
}>();

const emit = defineEmits(['refresh-list']);

const loading = ref(false);
const sessions = ref<ChecklistSession[]>([]);
const calendarValue = ref<Dayjs>(dayjs());

const isModalOpen = ref(false);
const submitting = ref(false);
const deletingSchedule = ref(false);
const selectedSession = ref<ChecklistSession | null>(null);
const judgeDetails = ref<JudgeDetailItem[]>([]);

const usersList = ref<UserOption[]>([]);
const selectedUserIds = ref<string[]>([]);
const selectedTimestamp = ref<string>(dayjs().format('YYYY-MM-DD HH:mm:ss'));
const selectedExecutionDate = ref<string>(dayjs().format('YYYY-MM-DD'));
const selectedDeadline = ref<string | undefined>(undefined);

const userOptions = computed(() => {
  return usersList.value.map(u => ({
    label: u.name,
    value: u.id,
  }));
});

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function normalizeDate(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
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
  judgeDetails.value = session.details?.map(d => {
    const latestLog = getLatestCompletedLog(d);
    return {
      checklist_id: d.checklist_id,
      description: d.description || '',
      result: latestLog?.result || 'fail',
    };
  }) || [];

  if (session.users && session.users.length > 0) {
    selectedUserIds.value = session.users.map(u => u.id);
  } else {
    selectedUserIds.value = [];
  }

  selectedTimestamp.value = session.session_date
    ? dayjs(session.session_date).format('YYYY-MM-DD HH:mm:ss')
    : dayjs().format('YYYY-MM-DD HH:mm:ss');
  selectedExecutionDate.value = session.session_date
    ? dayjs(session.session_date).format('YYYY-MM-DD')
    : dayjs().format('YYYY-MM-DD');
  selectedDeadline.value = normalizeDate(session.session_date);
  isModalOpen.value = true;
}

async function handleJudgeOk(): Promise<void> {
  if (!selectedSession.value) return;
  submitting.value = true;

  try {
    const scheduleIds = selectedSession.value.details
      ?.map(detail => detail.schedule_id)
      .filter((id): id is string => Boolean(id));

    await axios.put(
      `${API_BASE_URL}/v1/checklist-sessions/${selectedSession.value.id}`,
      {
        user_ids: selectedUserIds.value,
        schedules: (scheduleIds && scheduleIds.length > 0)
          ? scheduleIds.map(id => ({
              id,
              date: selectedExecutionDate.value,
              user_ids: selectedUserIds.value,
            }))
          : undefined,
      },
      { headers: getAuthHeaders() },
    );

    const payload = {
      session_id: selectedSession.value.id,
      results: judgeDetails.value.map(item => ({
        checklist_id: item.checklist_id,
        result: item.result,
        description: item.description,
      })),
      user_ids: selectedUserIds.value,
      timestamp: selectedExecutionDate.value
        ? `${selectedExecutionDate.value} ${selectedTimestamp.value.slice(11)}`
        : undefined,
    };

    await axios.post(`${API_BASE_URL}/v1/checklist-sessions/judge`, payload, {
      headers: getAuthHeaders(),
    });

    message.success($t('page.ops.judgeSuccess'));
    isModalOpen.value = false;
    await fetchSessions();
    emit('refresh-list');
  } catch (err: unknown) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
    message.error(apiError || $t('page.ops.judgeError'));
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteSchedule(): Promise<void> {
  const session = selectedSession.value;
  const date = session?.session_date?.slice(0, 10);
  if (!session?.equipment_id || !date) return;

  deletingSchedule.value = true;
  try {
    await axios.delete(`${API_BASE_URL}/v1/checklist-schedules/daily`, {
      headers: getAuthHeaders(),
      data: {
        session_id: session.id,
        equipment_id: session.equipment_id,
        date,
      },
    });

    message.success('Đã xóa schedule của ngày đã chọn');
    isModalOpen.value = false;
    await fetchSessions();
    emit('refresh-list');
  } catch (err: unknown) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
    message.error(apiError || 'Không thể xóa schedule của ngày đã chọn');
  } finally {
    deletingSchedule.value = false;
  }
}

watch([calendarValue, () => props.equipmentId], () => {
  fetchSessions();
}, { immediate: true });

function goToDetail(session: ChecklistSession): void {
  if (session && session.id) {
    router.push({
      name: 'OpsCheckListDetail',
      query: {
        id: session.id,
        equipment_id: session.equipment_id,
        date: session.session_date,
      },
    });
  }
}

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

    <Drawer
      v-model:open="isModalOpen"
      :title="$t('page.ops.judgeChecklistTitle', { name: selectedSession?.equipment?.name || '' })"
      placement="right"
      :width="460"
    >
      <div v-if="selectedSession" class="space-y-6 px-2">
        <div class="space-y-1 pb-1">
          <Tag color="blue" class="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border-blue-200 text-blue-700 bg-blue-50/60 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-850">
            {{ selectedSession.equipment?.code || 'CHECKLIST' }}
          </Tag>
          <div class="flex items-center gap-2 mt-2">
            <h3
              class="text-lg font-semibold leading-snug cursor-pointer transition-colors duration-200 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
              @click="goToDetail(selectedSession)"
            >
              {{ selectedSession.equipment?.name || $t('page.ops.unidentified') }}
            </h3>
          </div>
        </div>
        <div class="space-y-4 border-t border-border pt-4">
          <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block">
            {{ $t('page.ops.detailItemsHeader') }}
          </span>

          <div
            v-if="judgeDetails.length === 0"
            class="text-sm text-gray-400 dark:text-gray-550 italic bg-gray-50/20 p-3 rounded-lg border border-gray-100 dark:border-gray-850"
          >
            {{ $t('page.ops.noItemsToJudge') }}
          </div>

          <div v-else class="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            <div
              v-for="(item, index) in judgeDetails"
              :key="index"
              class="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-850 rounded-lg flex flex-col gap-3"
            >
              <div class="flex items-center justify-between gap-2">
                <span
                  class="font-medium text-gray-750 dark:text-gray-300 text-sm leading-tight cursor-pointer transition-colors duration-200 hover:text-blue-600 dark:hover:text-blue-400"
                  @click="goToDetail(selectedSession)"
                >
                  {{ item.description || $t('page.ops.judgeItemIndex', { index: index + 1 }) }}
                </span>

                <div class="shrink-0 flex items-center justify-end min-w-[70px]">
                  <Tag
                    v-if="item.result === 'pass'"
                    color="success"
                    class="cursor-pointer px-2.5 py-0.5 rounded-full font-semibold text-xs transition-all duration-200 hover:opacity-80 select-none border-emerald-250 dark:border-emerald-800/50"
                    @click="item.result = 'fail'"
                  >
                    {{ $t('page.ops.resultPass') }}
                  </Tag>

                  <Tag
                    v-else
                    color="error"
                    class="cursor-pointer px-2.5 py-0.5 rounded-full font-semibold text-xs transition-all duration-200 hover:opacity-80 select-none border-rose-250 dark:border-rose-800/50"
                    @click="item.result = 'pass'"
                  >
                    {{ $t('page.ops.resultFail') }}
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2 border-t border-border pt-4">
          <span class="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-1">
            {{ $t('page.ops.checkerLabel') }}
          </span>
          <Select
            v-model:value="selectedUserIds"
            :placeholder="$t('page.ops.placeholderSelectChecker')"
            :options="userOptions"
            mode="multiple"
            option-filter-prop="label"
            show-search
            allow-clear
            class="w-full"
          />
        </div>

        <div class="space-y-2 border-t border-border pt-4">
          <span class="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-1">
            {{ $t('page.ops.deadlineLabel') }}
          </span>
          <DatePicker
            v-model:value="selectedDeadline"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            class="w-full"
            :placeholder="$t('page.ops.placeholderSelectDeadline')"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-2 py-2">
          <Popconfirm
            v-bind="{ title: $t('page.ops.deleteScheduleConfirm') }"
            title="Xóa toàn bộ schedule của ngày này?"
            :ok-text="$t('page.ops.btnConfirm')"
            :cancel-text="$t('page.ops.btnCancel')"
            @confirm="handleDeleteSchedule"
          >
            <Button danger :loading="deletingSchedule">
              {{ $t('page.ops.deleteSchedule') }}
            </Button>
          </Popconfirm>
          <div class="flex justify-end gap-2">
            <Button @click="isModalOpen = false">
              {{ $t('page.ops.btnCancel') }}
            </Button>
            <Button
              type="primary"
              class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded text-white"
              :loading="submitting"
              @click="handleJudgeOk"
            >
              {{ $t('page.ops.btnConfirm') }}
            </Button>
          </div>
        </div>
      </template>
    </Drawer>
  </div>
</template>

<style scoped>
</style>
