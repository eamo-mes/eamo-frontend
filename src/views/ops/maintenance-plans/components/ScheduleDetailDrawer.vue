<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Drawer, Button, message, Input, Spin, DatePicker, Select, Empty, Tag, Popconfirm } from 'ant-design-vue';

const equipmentBannerInfo = computed(() => {
  if (!activeSchedule.value) return null;
  const eqId = activeSchedule.value.equipment_id;
  const eq = props.equipments.find((e) => e.id === eqId);
  const code = activeSchedule.value.equipment_code || eq?.code || '';
  const name = activeSchedule.value.equipment_name || eq?.name || '';

  let catName = activeSchedule.value.category_name || '';
  if (!catName && activeSchedule.value.maintenance_item_id) {
    const cat = props.categories.find((c) => c.id === activeSchedule.value?.maintenance_item_id);
    if (cat?.name) catName = cat.name;
  }

  let title = '';
  if (catName && name) {
    title = `${catName} — ${name}`;
  } else if (name) {
    title = name;
  } else if (catName) {
    title = catName;
  } else {
    title = activeSchedule.value.plan_code || $t('page.ops.scheduleDetailTitle') || 'Chi tiết lịch bảo trì';
  }

  return {
    title,
    code,
    date: drawerSchedule.value.date || activeSchedule.value.date,
  };
});
import dayjs from 'dayjs';
import { $t } from '#/locales';
import { requestClient } from '#/api/request';
import { useRoleAccess } from '#/utils/useRoleAccess';
import {
  createMaintenanceLogApi,
  deleteMaintenanceScheduleApi,
  type EquipmentOption,
  type MaintenanceCategoryOption,
  type MaintenanceItemOption,
  type ScheduleRow,
  type MaintenanceLog,
} from '#/api/ops/maintenance-plans';

interface UserOption {
  label: string;
  value: string;
}

interface ItemEvalState {
  schedule_id?: string;
  log_id?: string;
  result: 'Completed' | 'Pending';
  notes: string;
}

const props = defineProps<{
  open: boolean;
  selectedSchedule: ScheduleRow | null;
  schedules: ScheduleRow[];
  maintenanceItems: MaintenanceItemOption[];
  categories: MaintenanceCategoryOption[];
  userOptions: UserOption[];
  equipments: EquipmentOption[];
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'update:schedules', newSchedules: ScheduleRow[]): void;
}>();

const router = useRouter();
const { isManager, isAdmin } = useRoleAccess();

const drawerSchedule = ref<{ date: string; user_ids: string[] }>({
  date: dayjs().format('YYYY-MM-DD'),
  user_ids: [],
});

const itemEvaluations = ref<Record<string, ItemEvalState>>({});
const loadingLog = ref(false);
const submitting = ref(false);
const deleting = ref(false);

const activeSchedule = computed(() => props.selectedSchedule);

const planSchedules = computed(() => {
  if (!activeSchedule.value) return [];
  const planId = activeSchedule.value.maintenance_plan_id || activeSchedule.value.plan_code;
  const list = planId
    ? props.schedules.filter((s) => (s.maintenance_plan_id || s.plan_code) === planId)
    : [activeSchedule.value];

  const targetDate = activeSchedule.value.date
    ? dayjs(activeSchedule.value.date).format('YYYY-MM-DD')
    : '';

  if (targetDate) {
    const sameDateList = list.filter((s) => {
      const sDate = s.date ? dayjs(s.date).format('YYYY-MM-DD') : '';
      return sDate === targetDate;
    });
    if (sameDateList.length > 0) return sameDateList;
  }
  return list;
});

function isUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

function getItemName(schedule: ScheduleRow): string {
  let name = '';
  if (schedule.maintenance_item?.name) name = schedule.maintenance_item.name;
  else if (schedule.item_name && !isUuid(schedule.item_name)) name = schedule.item_name;
  else {
    const item = props.maintenanceItems.find((i) => i.id === schedule.maintenance_item_id);
    if (item?.name) name = item.name;
    else if (schedule.item_name && !isUuid(schedule.item_name)) name = schedule.item_name;
    else name = $t('page.ops.unidentified') || 'Chưa xác định';
  }
  return $t(name) || name;
}

function getItemDescription(schedule: ScheduleRow): string | null {
  let desc = schedule.item_description;
  if (!desc) {
    const item = props.maintenanceItems.find((i) => i.id === schedule.maintenance_item_id);
    desc = item?.description || null;
  }
  if (!desc) return null;
  return $t(desc) || desc;
}

function getEquipmentName(schedule: ScheduleRow): string {
  if (schedule.equipment_name) return schedule.equipment_name;
  if (!schedule.equipment_id) return '';
  const eq = props.equipments.find((e) => e.id === schedule.equipment_id);
  return eq ? `${eq.code}${eq.name ? ` — ${eq.name}` : ''}` : '';
}

const drawerTitle = computed(() => {
  const base = $t('page.ops.scheduleDetailTitle') || 'Chi tiết & Đánh giá bảo trì';
  if (activeSchedule.value) {
    const eqName = getEquipmentName(activeSchedule.value);
    if (eqName) {
      return `${base} - ${eqName}`;
    }
  }
  return base;
});

function getEvalKey(sched: ScheduleRow): string {
  return sched.id || sched._key || 'unknown';
}

function getItemEvalState(sched: ScheduleRow): ItemEvalState {
  const key = getEvalKey(sched);
  if (!itemEvaluations.value[key]) {
    itemEvaluations.value[key] = {
      schedule_id: sched.id,
      result: sched.result === 'Completed' ? 'Completed' : 'Pending',
      notes: '',
    };
  }
  return itemEvaluations.value[key];
}

function setItemResult(sched: ScheduleRow, result: 'Completed' | 'Pending'): void {
  const state = getItemEvalState(sched);
  state.result = result;
}

async function fetchLogsForPlanSchedules(): Promise<void> {
  loadingLog.value = true;
  const evalMap: Record<string, ItemEvalState> = {};

  for (const s of planSchedules.value) {
    const key = getEvalKey(s);
    evalMap[key] = {
      schedule_id: s.id,
      result: s.result === 'Completed' ? 'Completed' : 'Pending',
      notes: '',
    };

    if (s.id) {
      try {
        const res = await requestClient.get<MaintenanceLog[]>('/v1/maintenance-logs', {
          params: { maintenance_schedule_id: s.id },
        });
        const logs = Array.isArray(res) ? res : [];
        const firstLog = logs[0];
        if (firstLog) {
          evalMap[key].log_id = firstLog.id;
          evalMap[key].result = firstLog.result === 'Completed' ? 'Completed' : 'Pending';
          evalMap[key].notes = (firstLog as any).note || firstLog.notes || '';
        }
      } catch {
        // ignore
      }
    }
  }

  itemEvaluations.value = evalMap;
  loadingLog.value = false;
}

watch(
  () => [props.open, props.selectedSchedule] as const,
  ([isOpen, sched]) => {
    if (isOpen && sched) {
      let initialUserIds: string[] = [];
      if (Array.isArray(sched.user_ids) && sched.user_ids.length > 0) {
        initialUserIds = [...sched.user_ids];
      } else if (Array.isArray(sched.users)) {
        initialUserIds = sched.users.map((u) => u.id);
      }

      // Fallback to maintenance item's default user_ids
      if (initialUserIds.length === 0 && sched.maintenance_item_id) {
        const item = props.maintenanceItems.find((i) => i.id === sched.maintenance_item_id);
        if (item && Array.isArray(item.user_ids)) {
          initialUserIds = [...item.user_ids];
        }
      }

      drawerSchedule.value = {
        date: sched.date || dayjs().format('YYYY-MM-DD'),
        user_ids: initialUserIds,
      };
      fetchLogsForPlanSchedules();
    }
  },
  { immediate: true, deep: true }
);

async function handleSaveDrawer(): Promise<void> {
  if (!activeSchedule.value) return;

  submitting.value = true;
  try {
    const updatedSchedules = [...props.schedules];

    for (const s of planSchedules.value) {
      const key = getEvalKey(s);
      const evalState = itemEvaluations.value[key];

      if (evalState && s.id) {
        const logResult = evalState.result === 'Completed' ? 'Completed' : 'Failed';
        const logNote = evalState.notes ? evalState.notes.trim() : null;

        if (evalState.log_id) {
          await requestClient.put<MaintenanceLog>(`/v1/maintenance-logs/${evalState.log_id}`, {
            result: logResult,
            note: logNote,
            notes: logNote,
          });
        } else {
          const newLog = await createMaintenanceLogApi({
            maintenance_schedule_id: s.id,
            result: logResult,
            note: logNote,
            notes: logNote,
          });
          evalState.log_id = newLog.id;
        }
      }

      // Update schedule in local list
      const idx = updatedSchedules.findIndex((x) => (x.id && x.id === s.id) || x._key === s._key);
      if (idx !== -1) {
        const target = updatedSchedules[idx];
        if (target) {
          updatedSchedules[idx] = {
            ...target,
            date: drawerSchedule.value.date,
            user_ids: Array.isArray(drawerSchedule.value.user_ids) ? [...drawerSchedule.value.user_ids] : [],
            result: evalState ? evalState.result : target.result,
          };
        }
      }
    }

    emit('update:schedules', updatedSchedules);
    emit('update:open', false);
    message.success($t('page.ops.drawerSaveSuccess') || 'Đã ghi nhận kết quả đánh giá bảo trì');
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== 403 && status !== 401) {
      const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(apiError || $t('page.ops.logSaveError') || 'Không thể lưu nhật ký đánh giá');
    }
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteSchedule(): Promise<void> {
  if (!activeSchedule.value) return;

  deleting.value = true;
  try {
    const updatedSchedules = [...props.schedules];

    for (const s of planSchedules.value) {
      if (s.id) {
        await deleteMaintenanceScheduleApi(s.id);
      }
      const idx = updatedSchedules.findIndex((x) => (x.id && x.id === s.id) || (x._key && x._key === s._key));
      if (idx !== -1) {
        updatedSchedules.splice(idx, 1);
      }
    }

    emit('update:schedules', updatedSchedules);
    emit('update:open', false);
    message.success($t('page.ops.deleteScheduleSuccess') || 'Đã xóa lịch bảo trì thành công');
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== 403 && status !== 401) {
      const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(apiError || $t('page.ops.deleteScheduleError') || 'Không thể xóa lịch bảo trì');
    }
  } finally {
    deleting.value = false;
  }
}

async function handleDeleteItemSchedule(sched: ScheduleRow): Promise<void> {
  deleting.value = true;
  try {
    if (sched.id) {
      await deleteMaintenanceScheduleApi(sched.id);
    }
    const updatedSchedules = props.schedules.filter(
      (x) => !((x.id && x.id === sched.id) || (x._key && x._key === sched._key))
    );
    emit('update:schedules', updatedSchedules);
    message.success($t('page.ops.deleteScheduleSuccess') || 'Đã xóa lịch bảo trì thành công');

    if (planSchedules.value.length <= 1) {
      emit('update:open', false);
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== 403 && status !== 401) {
      const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(apiError || $t('page.ops.deleteScheduleError') || 'Không thể xóa lịch bảo trì');
    }
  } finally {
    deleting.value = false;
  }
}

function handleCancelDrawer(): void {
  emit('update:open', false);
}

function goToPlan(): void {
  if (activeSchedule.value?.maintenance_plan_id) {
    router.push({ name: 'OpsMaintenancePlanDetail', query: { id: activeSchedule.value.maintenance_plan_id } });
  }
}
</script>

<template>
  <Drawer
    :open="props.open"
    :title="drawerTitle"
    placement="right"
    width="800px"
    @close="handleCancelDrawer"
  >
    <Spin :spinning="loadingLog">
        <div v-if="activeSchedule" class="space-y-6 px-1 pb-4">
        <!-- Header Banner Card (Matching ChecklistJudgeDrawer layout) -->
        <div v-if="equipmentBannerInfo" class="p-3 bg-card dark:bg-zinc-900 rounded-lg border border-border flex justify-between items-center shadow-xs">
          <div>
            <div class="font-semibold text-sm text-foreground">
              {{ equipmentBannerInfo.title }}
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              {{ equipmentBannerInfo.date }}
            </div>
          </div>
          <Tag v-if="equipmentBannerInfo.code" color="blue">
            {{ equipmentBannerInfo.code }}
          </Tag>
        </div>
        <!-- Expected Execution Date & Technicians (Grid Layout at the top) -->
        <div class="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div class="space-y-1.5 col-span-1">
            <label class="text-xs font-semibold text-foreground block">
              {{ $t('page.ops.expectedExecutionDate') || 'Ngày thực hiện dự kiến' }}
            </label>
            <DatePicker
              v-model:value="drawerSchedule.date"
              :disabled="!isManager"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              :placeholder="$t('page.ops.placeholderScheduleDate')"
              class="w-full"
            />
          </div>

          <div class="space-y-1.5 col-span-1">
            <label class="text-xs font-semibold text-foreground block">
              {{ $t('page.ops.assignedTechnicians') || 'Người thực hiện' }}
            </label>
            <Select
              v-model:value="drawerSchedule.user_ids"
              :disabled="!isManager"
              :options="props.userOptions"
              :placeholder="$t('page.ops.placeholderAssignedUsers')"
              mode="multiple"
              option-filter-prop="label"
              show-search
              allow-clear
              class="w-full"
            />
          </div>
        </div>

        <div class="border-t border-border pt-4 space-y-4">
          <!-- Title block -->
          <div>
            <h3 class="text-xs font-bold text-foreground uppercase tracking-wider m-0">
              {{ $t('page.ops.evalTitle') || 'Đánh giá hạng mục bảo trì' }} ({{ planSchedules.length }})
            </h3>
          </div>
          <div v-if="planSchedules.length === 0" class="py-10 flex justify-center">
            <Empty :description="$t('page.ops.noSchedules') || 'Chưa có lịch bảo trì cho ngày này.'" />
          </div>

          <div v-else class="space-y-2.5">
            <div
              v-for="(sched, index) in planSchedules"
              :key="sched.id || sched._key || index"
              class="rounded-lg border border-border p-3 space-y-2.5"
            >
              <!-- Item Header: Index + Name & Description -->
              <div class="min-w-0">
                <h4 class="text-sm font-semibold text-foreground leading-snug m-0">
                  {{ getItemName(sched) }}
                </h4>
                <p v-if="getItemDescription(sched)" class="text-xs text-muted-foreground mt-1 whitespace-pre-line leading-relaxed m-0">
                  {{ getItemDescription(sched) }}
                </p>
              </div>

              <!-- Notes TextArea -->
              <Input.TextArea
                v-model:value="getItemEvalState(sched).notes"
                :disabled="!isManager"
                :rows="2"
                :placeholder="$t('page.ops.judgeNotesPlaceholder') || 'Ghi chú hoặc nguyên nhân không đạt...'"
                class="w-full text-xs resize-none"
              />

              <!-- Pass/Fail Button placed below input, aligned to far right -->
              <div class="flex items-center justify-end pt-2">
                <Button
                  type="default"
                  size="small"
                  :class="[
                    'flex items-center gap-1 px-3 py-1 font-medium transition-colors shrink-0',
                    getItemEvalState(sched).result === 'Completed'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600'
                      : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-600'
                  ]"
                  :title="getItemEvalState(sched).result === 'Completed' ? $t('page.ops.resultPass') : $t('page.ops.resultFail')"
                  @click="setItemResult(sched, getItemEvalState(sched).result === 'Completed' ? 'Pending' : 'Completed')"
                >
                  <svg
                    v-if="getItemEvalState(sched).result === 'Completed'"
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
                    {{ getItemEvalState(sched).result === 'Completed' ? $t('page.ops.resultPass') : $t('page.ops.resultFail') }}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Spin>

    <template #footer>
      <div class="flex items-center justify-between gap-2 py-1">
        <div class="flex items-center gap-2">
          <Popconfirm
            v-if="isManager"
            :title="$t('page.ops.deleteScheduleConfirm') || 'Bạn có chắc chắn muốn xóa lịch bảo trì này không?'"
            :ok-text="$t('page.ops.btnConfirm') || 'Xóa'"
            :cancel-text="$t('page.ops.btnCancel') || 'Hủy'"
            ok-type="danger"
            @confirm="handleDeleteSchedule"
          >
            <Button danger :loading="deleting">
              {{ $t('page.ops.btnDelete') || 'Xóa' }}
            </Button>
          </Popconfirm>
          <Button @click="handleCancelDrawer">
            {{ $t('page.ops.btnCancel') || 'Hủy' }}
          </Button>
          <Button type="primary" @click="goToPlan">
            {{ $t('page.ops.btnGoToPlan') || 'Đi tới Kế hoạch' }}
          </Button>
        </div>
        <Button
          type="primary"
          :loading="submitting"
          @click="handleSaveDrawer"
        >
          {{ $t('page.ops.btnSave') || 'Lưu' }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
