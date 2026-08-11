<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import {
  Drawer,
  DatePicker,
  Button,
  Select,
  Tag,
  Popconfirm,
  message,
  Empty,
} from 'ant-design-vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import type {
  ChecklistSession,
  ChecklistDetailItem,
  ChecklistLog,
  JudgeDetailItem,
  UserOption,
} from './types';

const props = defineProps<{
  open: boolean;
  session: ChecklistSession | null;
  usersList: UserOption[];
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'submitted'): void;
}>();

import { useRoleAccess } from '#/utils/useRoleAccess';

const router = useRouter();
const { isManager, isEngineer, isAdmin } = useRoleAccess();

const submitting = ref(false);
const deletingSchedule = ref(false);
const judgeDetails = ref<JudgeDetailItem[]>([]);
const selectedUserIds = ref<string[]>([]);
const selectedTimestamp = ref<string>(dayjs().format('YYYY-MM-DD HH:mm:ss'));
const selectedExecutionDate = ref<string>(dayjs().format('YYYY-MM-DD'));
const selectedDeadline = ref<string | undefined>(undefined);

const userOptions = computed(() => {
  return props.usersList.map((u) => ({
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

function getLatestCompletedLog(detail: ChecklistDetailItem & { schedules?: Array<{ logs?: ChecklistLog[] }> }): ChecklistLog | undefined {
  let logs: ChecklistLog[] = detail.logs || [];
  if (logs.length === 0 && detail.schedules && detail.schedules.length > 0) {
    logs = detail.schedules.flatMap((s) => s.logs || []);
  }
  return logs
    .filter((log) => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

watch(
  () => [props.open, props.session] as const,
  ([isOpen, currentSession]) => {
    if (isOpen && currentSession) {
      judgeDetails.value = (currentSession.details || []).map((d) => {
        const latestLog = getLatestCompletedLog(d);
        return {
          checklist_id: d.checklist_id || '',
          description: d.description || '',
          result: latestLog?.result === 'pass' ? 'pass' : 'fail',
        };
      });

      selectedUserIds.value = currentSession.users && currentSession.users.length > 0
        ? currentSession.users.map((u) => u.id)
        : [];

      selectedTimestamp.value = currentSession.session_date
        ? dayjs(currentSession.session_date).format('YYYY-MM-DD HH:mm:ss')
        : dayjs().format('YYYY-MM-DD HH:mm:ss');
      selectedExecutionDate.value = currentSession.session_date
        ? dayjs(currentSession.session_date).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');
      selectedDeadline.value = normalizeDate(currentSession.session_date);
    }
  },
  { immediate: true },
);

async function handleJudgeOk(): Promise<void> {
  if (!props.session) return;
  submitting.value = true;

  try {
    try {
      const scheduleIds = props.session.details
        ?.map((detail) => detail.schedule_id)
        .filter((id): id is string => Boolean(id));

      await axios.put(
        `${API_BASE_URL}/v1/checklist-sessions/${props.session.id}`,
        {
          user_ids: selectedUserIds.value,
          schedules:
            scheduleIds && scheduleIds.length > 0
              ? scheduleIds.map((id) => ({
                  id,
                  date: selectedExecutionDate.value,
                  user_ids: selectedUserIds.value,
                }))
              : undefined,
        },
        { headers: getAuthHeaders() },
      );
    } catch (putErr) {
      // Non-managers may get 403 on session PUT, continue to judge POST
      console.warn('Session structure update skipped or unauthorized:', putErr);
    }

    const payload = {
      session_id: props.session.id,
      results: judgeDetails.value.map((item) => ({
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
    emit('update:open', false);
    emit('submitted');
  } catch (err: unknown) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
    message.error(apiError || $t('page.ops.judgeError'));
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteSchedule(): Promise<void> {
  const session = props.session;
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

    message.success($t('page.ops.deleteScheduleSuccess'));
    emit('update:open', false);
    emit('submitted');
  } catch (err: unknown) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
    message.error(apiError || $t('page.ops.deleteScheduleError'));
  } finally {
    deletingSchedule.value = false;
  }
}

function handleClose(): void {
  emit('update:open', false);
}

function goToChecklistDetail(): void {
  const sessionId = props.session?.id || (props.session as { checklist_id?: string })?.checklist_id;
  const eqId = props.session?.equipment_id || props.session?.equipment?.id;
  if (sessionId) {
    router.push({
      path: '/maintenance/checklist/detail',
      query: { id: sessionId, ...(eqId ? { equipment_id: eqId } : {}) },
    });
    handleClose();
  }
}
</script>

<template>
  <Drawer
    :open="props.open"
    :title="$t('page.ops.judgeChecklistTitle', { name: props.session?.equipment?.name || '' })"
    placement="right"
    width="800px"
    @close="handleClose"
  >
    <div v-if="props.session" class="space-y-6 px-1">
      <!-- Header Banner Card -->
      <div class="rounded-lg border border-border bg-card p-4 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold text-foreground leading-tight">
              {{ props.session.equipment?.name || props.session.name || props.session.equipment?.code || $t('page.ops.unidentified') }}
            </h3>
            <p v-if="props.session.session_date" class="text-xs text-muted-foreground mt-1">
              {{ props.session.session_date }}
            </p>
          </div>
          <Tag color="blue" class="m-0 font-medium">
            {{ props.session.equipment?.code || 'CHECKLIST' }}
          </Tag>
        </div>
      </div>

      <!-- Checker / Inspector & Expected Execution Date Section -->
      <div class="space-y-4 border-t border-border pt-4">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-foreground block">
            {{ $t('page.ops.checkerLabel') }}
          </label>
          <Select
            v-model:value="selectedUserIds"
            :disabled="!isManager"
            :placeholder="$t('page.ops.placeholderSelectChecker')"
            :options="userOptions"
            mode="multiple"
            option-filter-prop="label"
            show-search
            allow-clear
            class="w-full"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-foreground block">
            {{ $t('page.ops.expectedExecutionDate') }}
          </label>
          <DatePicker
            v-model:value="selectedExecutionDate"
            :disabled="!isManager"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            class="w-full"
            :placeholder="$t('page.ops.placeholderScheduleDate')"
          />
        </div>
      </div>

      <!-- Checklist Items Section -->
      <div class="space-y-3 border-t border-border pt-4">
        <label class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block">
          {{ $t('page.ops.detailItemsHeader') }}
        </label>

        <div v-if="judgeDetails.length === 0" class="py-6 flex justify-center">
          <Empty :description="$t('page.ops.noItemsToJudge')" />
        </div>

        <div v-else class="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          <div
            v-for="(item, index) in judgeDetails"
            :key="index"
            class="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card transition-all hover:border-muted-foreground/30"
          >
            <div class="flex-1 min-w-0">
              <span class="text-sm text-foreground leading-snug block">
                {{ item.description || $t('page.ops.judgeItemIndex', { index: index + 1 }) }}
              </span>
            </div>

            <Button
              type="default"
              size="small"
              :class="[
                'flex items-center gap-1 px-3 py-1 font-medium transition-colors shrink-0',
                item.result === 'pass'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600'
                  : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-600'
              ]"
              :title="item.result === 'pass' ? $t('page.ops.resultPass') : $t('page.ops.resultFail')"
              @click="item.result = item.result === 'pass' ? 'fail' : 'pass'"
            >
              <svg
                v-if="item.result === 'pass'"
                class="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <svg
                v-else
                class="w-4 h-4 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span class="text-xs uppercase tracking-wider">
                {{ item.result === 'pass' ? $t('page.ops.resultPass') : $t('page.ops.resultFail') }}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-2 py-1">
        <div class="flex items-center gap-2">
          <Popconfirm
            v-if="isManager"
            :title="$t('page.ops.confirmDeleteSchedule', { name: props.session?.equipment?.name || props.session?.name || '', date: props.session?.session_date?.slice(0, 10) || '' })"
            @confirm="handleDeleteSchedule"
          >
            <Button danger :loading="deletingSchedule">
              {{ $t('page.ops.btnDelete') || 'Xóa' }}
            </Button>
          </Popconfirm>
          <Button @click="handleClose">
            {{ $t('page.ops.btnCancel') || 'Hủy' }}
          </Button>
          <Button type="primary" @click="goToChecklistDetail">
            {{ $t('page.ops.btnGoToChecklist') || 'Đi tới Checklist' }}
          </Button>
        </div>
        <Button
          type="primary"
          :loading="submitting"
          @click="handleJudgeOk"
        >
          {{ $t('page.ops.btnSave') || 'Lưu' }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
