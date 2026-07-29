<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Card,
  Button,
  Spin,
  Empty,
  message,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { requestClient } from '#/api/request';
import {
  getChecklistSessionDetailApi,
  judgeChecklistSessionApi,
} from '#/api/ops/checklist';
import type {
  ChecklistSession,
  ChecklistDetailItem,
  ChecklistLog,
} from '#/views/dashboard/workspace/types';

defineOptions({ name: 'MobilePortalChecklistDetail' });

interface JudgeDetailItem {
  id?: string;
  checklist_id: string;
  description: string;
  result: 'pass' | 'fail';
}

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const submitting = ref(false);

const session = ref<ChecklistSession | null>(null);
const judgeDetails = ref<JudgeDetailItem[]>([]);

function getLatestCompletedLog(detail: ChecklistDetailItem): ChecklistLog | undefined {
  return detail.logs
    ?.filter((log) => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

async function loadSessionDetail() {
  const sessionId = route.params.id as string;
  if (!sessionId) {
    message.error('Không tìm thấy mã phiên kiểm tra');
    router.push('/portal/checklist');
    return;
  }

  loading.value = true;
  try {
    const raw = await getChecklistSessionDetailApi(sessionId);
    const data = (raw as { data?: ChecklistSession })?.data ?? (raw as ChecklistSession);
    if (data) {
      session.value = data;

      // If equipment relation is missing on detail response, fetch it using equipment_id
      if (!data.equipment && data.equipment_id) {
        try {
          const eqRaw = await requestClient.get(`/v1/equipment/${data.equipment_id}`);
          const eqData = (eqRaw as { data?: { id?: string; code?: string; name?: string } })?.data ?? eqRaw;
          if (eqData && typeof eqData === 'object' && 'code' in eqData) {
            session.value = {
              ...data,
              equipment: {
                id: eqData.id || '',
                code: String(eqData.code || ''),
                name: String(eqData.name || ''),
              },
            };
          }
        } catch {
          // ignore equipment fetch error
        }
      }

      judgeDetails.value = (data.details || []).map((detail) => {
        const latestLog = getLatestCompletedLog(detail);
        return {
          id: detail.id,
          checklist_id: detail.checklist_id || detail.id || '',
          description: detail.description || 'Hạng mục kiểm tra',
          result: latestLog?.result === 'fail' ? 'fail' : 'pass',
        };
      });
    } else {
      message.error('Phiên kiểm tra không tồn tại');
    }
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || t('page.ops.loadDetailsError') || 'Không thể tải chi tiết checklist');
  } finally {
    loading.value = false;
  }
}

function handleBack() {
  router.push('/portal/checklist');
}

async function handleJudgeSubmit() {
  if (!session.value?.id) return;
  submitting.value = true;
  try {
    await judgeChecklistSessionApi({
      session_id: session.value.id,
      results: judgeDetails.value.map((item) => ({
        checklist_id: item.checklist_id,
        result: item.result,
        description: item.description,
      })),
    });

    message.success(t('page.ops.judgeSuccess') || 'Đã lưu kết quả đánh giá thành công');
    router.push('/portal/checklist');
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || t('page.ops.judgeError') || 'Không thể lưu kết quả đánh giá');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadSessionDetail();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-24">
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
        {{ t('page.ops.checklistDrawer.btnDetail') || 'Đánh giá Checklist' }}
      </h1>
    </div>

    <!-- ─── LOADING STATE ─── -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── JUDGING VIEW ─── -->
    <div v-else-if="session" class="space-y-4 px-4">
      <!-- Session General Info Card -->
      <Card class="rounded-2xl border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-0 overflow-hidden shadow-3xs" :body-style="{ padding: '0px' }">
        <div class="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
          <div class="min-w-0 pr-3">
            <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 truncate">
              {{ session.name || session.equipment?.name || t('page.ops.checklistDrawer.sessionText') }}
              <span v-if="session.name && session.equipment?.name" class="font-normal text-slate-400 dark:text-zinc-500">— {{ session.equipment.name }}</span>
            </h3>
            <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-1 mb-0">
              <span v-if="session.equipment?.code" class="font-bold text-slate-600 dark:text-zinc-400">{{ session.equipment.code }}</span>
              <span v-if="session.equipment?.name && !session.name" class="font-sans"> — {{ session.equipment.name }}</span>
              <span v-if="session.session_date && session.equipment?.code" class="mx-1.5">·</span>
              <span v-if="session.session_date">{{ dayjs(session.session_date).format('YYYY-MM-DD HH:mm') }}</span>
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
            class="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-3xs"
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
      <div class="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-zinc-800 p-4 z-50 flex items-center justify-between gap-3">
        <Button class="flex-1 h-10 font-bold rounded-xl text-xs" @click="handleBack">
          {{ t('page.ops.btnCancel') || 'Hủy' }}
        </Button>
        <Button
          type="primary"
          class="flex-1 h-10 font-bold bg-indigo-600 hover:bg-indigo-700 border-none rounded-xl text-xs"
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
:deep(.ant-card) {
  margin-bottom: 0 !important;
}
</style>
