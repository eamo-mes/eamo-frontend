<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Card,
  Button,
  Spin,
  Empty,
  Input,
  message,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { requestClient } from '#/api/request';
import {
  listMaintenanceSchedulesApi,
  getMaintenancePlanDetailApi,
  judgeMaintenancePlanApi,
  type ScheduleRow,
  type MaintenancePlanRecord,
  type MaintenanceLog,
} from '#/api/ops/maintenance-plans';
import JudgeResultButton from '#/components/JudgeResultButton.vue';

import { useRoleAccess } from '#/utils/useRoleAccess';

defineOptions({ name: 'MobilePortalMaintainPlanDetail' });

const { isEngineer } = useRoleAccess();

interface JudgeScheduleItem {
  schedule_id: string;
  log_id?: string;
  equipment_id?: string;
  item_name: string;
  item_description?: string;
  result: 'Completed' | 'Pending';
  notes: string;
}

interface PlanHeaderInfo {
  plan_code: string;
  equipment_name?: string | null;
  equipment_code?: string | null;
  date: string;
  maintenance_type?: string;
}

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const submitting = ref(false);

const planHeader = ref<PlanHeaderInfo | null>(null);
const judgeItems = ref<JudgeScheduleItem[]>([]);

function isUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

function getItemName(schedule: ScheduleRow): string {
  if (schedule.maintenance_item?.name) return schedule.maintenance_item.name;
  if (schedule.item_name && !isUuid(schedule.item_name)) return schedule.item_name;
  if (schedule.item_name_text && !isUuid(schedule.item_name_text)) return schedule.item_name_text;
  return t('page.ops.unidentified') || 'Chưa xác định';
}

function getItemDescription(schedule: ScheduleRow): string {
  if (schedule.item_description) return schedule.item_description;
  if (schedule.maintenance_item?.description) return schedule.maintenance_item.description;
  return '';
}

async function loadPlanDetail() {
  const planId = route.params.id as string;
  let dateStr = route.query.date as string;

  if (!planId) {
    message.error('Không tìm thấy mã kế hoạch bảo trì');
    router.push('/portal/maintain-plan');
    return;
  }

  loading.value = true;
  try {
    const queryDate = dateStr || dayjs().format('YYYY-MM-DD');
    const rawSchedules = await listMaintenanceSchedulesApi({
      start_date: queryDate,
      end_date: queryDate,
      with_logs: true,
    });
    let scheduleArray = Array.isArray(rawSchedules) ? rawSchedules : [];

    let matchingSchedules = scheduleArray.filter(
      (s) =>
        s.maintenance_plan_id === planId ||
        s.plan_code === planId ||
        s.maintenance_plan?.plan_code === planId ||
        s.id === planId
    );

    // Fallback: If no schedules match for query date, query all schedules to find matching plan node
    if (matchingSchedules.length === 0) {
      const allSchedules = await listMaintenanceSchedulesApi({ with_logs: true });
      scheduleArray = Array.isArray(allSchedules) ? allSchedules : [];
      const allMatches = scheduleArray.filter(
        (s) =>
          s.maintenance_plan_id === planId ||
          s.plan_code === planId ||
          s.maintenance_plan?.plan_code === planId ||
          s.id === planId
      );
      if (allMatches.length > 0) {
        const firstMatchDate = allMatches[0]?.date ? dayjs(allMatches[0].date).format('YYYY-MM-DD') : queryDate;
        dateStr = firstMatchDate;
        matchingSchedules = allMatches.filter(
          (s) => s.date && s.date.startsWith(firstMatchDate)
        );
      }
    }

    const rawPlan = await getMaintenancePlanDetailApi(planId).catch(() => null as MaintenancePlanRecord | null);

    // Deduplicate schedules by maintenance item to prevent repeated item rows
    const seenItems = new Set<string>();
    const deduplicatedSchedules: ScheduleRow[] = [];
    for (const s of matchingSchedules) {
      const itemKey = s.maintenance_item_id || s.item_name || s.maintenance_item?.name || s.id || '';
      if (!seenItems.has(itemKey)) {
        seenItems.add(itemKey);
        deduplicatedSchedules.push(s);
      }
    }

    const targetSchedules = deduplicatedSchedules;
    const firstSchedule = targetSchedules[0];

    planHeader.value = {
      plan_code: rawPlan?.plan_code || firstSchedule?.plan_code || firstSchedule?.maintenance_plan?.plan_code || 'KẾ HOẠCH BẢO TRÌ',
      equipment_name: firstSchedule?.equipment_name || firstSchedule?.maintenance_plan?.equipment?.name || null,
      equipment_code: firstSchedule?.equipment_code || firstSchedule?.maintenance_plan?.equipment?.code || '—',
      date: dateStr || (firstSchedule?.date ? dayjs(firstSchedule.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')),
      maintenance_type: firstSchedule?.maintenance_type || firstSchedule?.maintenance_plan?.maintenance_type || rawPlan?.maintenance_type || '—',
    };

    const items: JudgeScheduleItem[] = [];
    for (const s of targetSchedules) {
      let logId: string | undefined;
      let isPass = false;
      let notes = '';

      if (s.id) {
        try {
          const res = await requestClient.get<MaintenanceLog[]>('/v1/maintenance-logs', {
            params: { maintenance_schedule_id: s.id },
          });
          const logs = Array.isArray(res) ? res : [];
          const firstLog = logs[0];
          if (firstLog) {
            logId = firstLog.id;
            isPass = firstLog.result === 'Completed' || firstLog.result === 'pass' || firstLog.result === 'completed';
            notes = firstLog.notes || '';
          } else {
            isPass = s.result === 'Completed' || s.result === 'pass' || s.result === 'completed';
          }
        } catch {
          isPass = s.result === 'Completed' || s.result === 'pass' || s.result === 'completed';
        }
      }

      items.push({
        schedule_id: s.id || '',
        log_id: logId,
        equipment_id: s.equipment_id || s.maintenance_plan?.equipment_id,
        item_name: getItemName(s),
        item_description: getItemDescription(s),
        result: isPass ? 'Completed' : 'Pending',
        notes,
      });
    }
    judgeItems.value = items;
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || t('page.ops.loadSchedulesError') || 'Không thể tải chi tiết kế hoạch bảo trì');
  } finally {
    loading.value = false;
  }
}

function handleBack() {
  router.push('/portal/maintain-plan');
}

async function handleSaveEvaluation() {
  if (judgeItems.value.length === 0) return;

  const dateStr = planHeader.value?.date;
  if (dateStr && dayjs(dateStr).isAfter(dayjs(), 'day')) {
    message.error(t('page.ops.dateCannotBeInFuture') || 'Ngày thực hiện không được vượt quá ngày hôm nay');
    return;
  }

  submitting.value = true;
  try {
    const planId = route.params.id as string;
    const results = judgeItems.value
      .map((item) => {
        if (!item.schedule_id) return null;
        return {
          schedule_id: item.schedule_id,
          result: item.result === 'Completed' ? 'Completed' : 'Failed',
          note: item.notes ? item.notes.trim() : null,
        };
      })
      .filter((item): item is { schedule_id: string; result: 'Completed' | 'Failed'; note: string | null } => Boolean(item));

    const payload = {
      plan_id: planId,
      timestamp: dateStr
        ? `${dateStr} ${dayjs().format('HH:mm:ss')}`
        : dayjs().format('YYYY-MM-DD HH:mm:ss'),
      results: results as any[],
    };

    await judgeMaintenancePlanApi(payload);

    message.success(t('page.ops.saveLogSuccess') || 'Đã lưu kết quả bảo trì thành công');
    router.push('/portal/maintain-plan');
  } catch (err: unknown) {
    console.error(err);
  } finally {
    submitting.value = false;
  }
}

async function handleSingleMaintenanceJudge(item: JudgeScheduleItem, nextResult: string): Promise<void> {
  if (!item.schedule_id) return;

  const dateStr = planHeader.value?.date;
  if (dateStr && dayjs(dateStr).isAfter(dayjs(), 'day')) {
    message.error(t('page.ops.dateCannotBeInFuture') || 'Ngày thực hiện không được vượt quá ngày hôm nay');
    throw new Error('Date in future');
  }

  const planId = route.params.id as string;
  const payload = {
    plan_id: planId,
    timestamp: dateStr
      ? `${dateStr} ${dayjs().format('HH:mm:ss')}`
      : dayjs().format('YYYY-MM-DD HH:mm:ss'),
    results: [
      {
        schedule_id: item.schedule_id,
        result: nextResult,
        note: item.notes ? item.notes.trim() : null,
      },
    ],
  };

  await judgeMaintenancePlanApi(payload as any);
  item.result = nextResult as 'Completed' | 'Pending';
}

onMounted(() => {
  loadPlanDetail();
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
        {{ t('page.ops.evalMaintenance') || 'Đánh giá Kế hoạch Bảo trì' }}
      </h1>
    </div>

    <!-- ─── LOADING STATE ─── -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── JUDGING VIEW ─── -->
    <div v-else-if="planHeader" class="space-y-4 px-4">
      <!-- General Plan Info Card -->
      <Card class="rounded-2xl border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-0 overflow-hidden shadow-3xs" :body-style="{ padding: '0px' }">
        <div class="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
          <div class="min-w-0 pr-3">
            <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 truncate">
              {{ planHeader.equipment_name ? `${planHeader.equipment_name} (${planHeader.equipment_code})` : planHeader.plan_code }}
            </h3>
            <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-1 mb-0">
              Mã KH: {{ planHeader.plan_code }} <span class="text-slate-300 dark:text-zinc-600 mx-1">·</span> Ngày: {{ planHeader.date }}
            </p>
          </div>
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

              <JudgeResultButton
                v-model:value="item.result"
                pass-value="Completed"
                fail-value="Failed"
                :disabled="!isEngineer"
                :pass-label="t('page.ops.resultPass') || 'Đạt'"
                :fail-label="t('page.ops.resultFail') || 'Chưa đạt'"
                :on-judge="(nextRes) => handleSingleMaintenanceJudge(item, nextRes)"
              />
            </div>

            <!-- Optional Notes -->
            <div v-if="isEngineer">
              <Input.Textarea
                v-model:value="item.notes"
                :rows="2"
                class="rounded-xl border-slate-200/80 dark:border-zinc-800 text-[11px]"
                :placeholder="t('page.ops.notesPlaceholder') || 'Ghi chú cho hạng mục này (nếu có)...'"
              />
            </div>
            <div v-else-if="item.notes" class="text-[11px] text-slate-500 italic">
              {{ item.notes }}
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-zinc-800 p-4 z-50 flex items-center justify-between gap-3">
        <Button :class="[isEngineer ? 'flex-1' : 'w-full', 'h-10 font-bold rounded-xl text-xs']" @click="handleBack">
          {{ isEngineer ? (t('page.ops.btnCancel') || 'Hủy') : (t('page.ops.btnBack') || 'Quay lại') }}
        </Button>
        <Button
          v-if="isEngineer"
          type="primary"
          class="flex-1 h-10 font-bold bg-indigo-600 hover:bg-indigo-700 border-none rounded-xl text-xs"
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
:deep(.ant-card) {
  margin-bottom: 0 !important;
}
</style>
