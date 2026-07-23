<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Drawer, DatePicker, Select, Popconfirm, Button, Tag, message, Input, Spin, Descriptions } from 'ant-design-vue';
import { $t } from '#/locales';
import { requestClient } from '#/api/request';
import {
  createMaintenanceLogApi,
  deleteMaintenanceLogApi,
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

const drawerSchedule = ref<{ date: string; user_ids: string[] } | null>(null);
const logResult = ref<string | undefined>('');
const logNote = ref('');
const logSubmitting = ref(false);
const existingLog = ref<MaintenanceLog | null>(null);
const loadingLog = ref(false);

const resultOptions = computed(() => [
  { label: $t('page.ops.logResultPending'), value: '' },
  { label: $t('page.ops.logResultCompleted'), value: 'Completed' },
  { label: $t('page.ops.logResultPartial'), value: 'Partial' },
  { label: $t('page.ops.logResultFailed'), value: 'Failed' },
]);

const selectedItemDetails = computed(() => {
  if (!props.selectedSchedule) return null;
  if (props.selectedSchedule.item_description !== undefined) {
    return {
      description: props.selectedSchedule.item_description,
    };
  }
  return (
    props.maintenanceItems.find((i) => i.id === props.selectedSchedule?.maintenance_item_id) ||
    null
  );
});

function getItemName(schedule: ScheduleRow): string {
  if (schedule.item_name) return schedule.item_name;
  const item = props.maintenanceItems.find((i) => i.id === schedule.maintenance_item_id);
  return item ? item.name : $t('page.ops.unidentified');
}

function getCategoryName(schedule: ScheduleRow): string {
  if (schedule.category_name) return schedule.category_name;
  const item = props.maintenanceItems.find((i) => i.id === schedule.maintenance_item_id);
  if (!item) return '';
  const category = props.categories.find((c) => c.id === item.maintenance_category_id);
  return category ? category.name : '';
}

function getEquipmentName(schedule: ScheduleRow): string {
  if (schedule.equipment_name) return schedule.equipment_name;
  if (!schedule.equipment_id) return '';
  const eq = props.equipments.find((e) => e.id === schedule.equipment_id);
  return eq ? `${eq.code}${eq.name ? ` — ${eq.name}` : ''}` : '';
}

async function fetchLogForSchedule(scheduleId: string): Promise<void> {
  loadingLog.value = true;
  existingLog.value = null;
  try {
    const res = await requestClient.get<MaintenanceLog[]>('/v1/maintenance-logs', {
      params: { maintenance_schedule_id: scheduleId },
    });
    const logs = Array.isArray(res) ? res : [];
    const firstLog = logs[0];
    if (firstLog) {
      existingLog.value = firstLog;
      logResult.value = firstLog.result;
      logNote.value = firstLog.notes || '';
    } else {
      logResult.value = '';
    }
  } catch {
    logResult.value = '';
  } finally {
    loadingLog.value = false;
  }
}

watch(
  () => [props.open, props.selectedSchedule] as const,
  ([isOpen, sched]) => {
    if (isOpen && sched) {
      drawerSchedule.value = {
        date: sched.date,
        user_ids: [...sched.user_ids],
      };
      logResult.value = sched.result || '';
      logNote.value = '';
      existingLog.value = null;
      if (sched.id) {
        fetchLogForSchedule(sched.id);
      }
    }
  },
  { immediate: true }
);

async function handleSaveDrawer(): Promise<void> {
  if (props.selectedSchedule && drawerSchedule.value) {
    if (props.selectedSchedule.id) {
      logSubmitting.value = true;
      try {
        if (!logResult.value || logResult.value === '') {
          if (existingLog.value) {
            await deleteMaintenanceLogApi(existingLog.value.id);
            existingLog.value = null;
          }
        } else {
          if (existingLog.value) {
            const res = await requestClient.put<MaintenanceLog>(`/v1/maintenance-logs/${existingLog.value.id}`, {
              result: logResult.value,
              notes: logNote.value || null,
            });
            existingLog.value = res;
          } else {
            const res = await createMaintenanceLogApi({
              maintenance_schedule_id: props.selectedSchedule.id,
              result: logResult.value,
              notes: logNote.value || null,
            });
            existingLog.value = res;
          }
        }
      } catch (err: unknown) {
        const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        message.error(apiError || $t('page.ops.logSaveError'));
        return;
      } finally {
        logSubmitting.value = false;
      }
    }

    const updatedSchedules = props.schedules.map((s) => {
      if (s._key === props.selectedSchedule?._key) {
        return {
          ...s,
          date: drawerSchedule.value!.date,
          user_ids: [...drawerSchedule.value!.user_ids],
          result: logResult.value || null,
        };
      }
      return s;
    });
    emit('update:schedules', updatedSchedules);
    emit('update:open', false);
    message.success($t('page.ops.drawerSaveSuccess'));
  }
}

function handleCancelDrawer(): void {
  emit('update:open', false);
}

function handleDeleteDrawer(): void {
  if (props.selectedSchedule) {
    const updatedSchedules = props.schedules.filter((s) => s._key !== props.selectedSchedule?._key);
    emit('update:schedules', updatedSchedules);
    emit('update:open', false);
    message.success($t('page.ops.drawerDeleteSuccess'));
  }
}

function goToPlan(): void {
  if (props.selectedSchedule?.maintenance_plan_id) {
    router.push({ name: 'OpsMaintenancePlanDetail', query: { id: props.selectedSchedule.maintenance_plan_id } });
  }
}
</script>

<template>
  <Drawer
    :open="props.open"
    :title="$t('page.ops.scheduleDetailTitle')"
    placement="right"
    :width="600"
    @close="handleCancelDrawer"
  >
    <div v-if="drawerSchedule && props.selectedSchedule" class="space-y-6 px-1">
      <!-- Header Banner Card -->
      <div class="rounded-lg border border-border bg-card p-4 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold text-foreground leading-tight">
              {{ getItemName(props.selectedSchedule) }}
            </h3>
            <p v-if="getEquipmentName(props.selectedSchedule)" class="text-xs text-muted-foreground mt-1">
              {{ getEquipmentName(props.selectedSchedule) }}
            </p>
          </div>
          <Tag v-if="getCategoryName(props.selectedSchedule)" color="blue" class="m-0 font-medium">
            {{ getCategoryName(props.selectedSchedule) }}
          </Tag>
        </div>
      </div>

      <!-- Read-Only Information Descriptions -->
      <div v-if="props.readOnly" class="space-y-2 border-t border-border pt-4">
        <label class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2">
          {{ $t('page.ops.title') }}
        </label>
        <Descriptions bordered size="small" :column="1">
          <Descriptions.Item :label="$t('page.ops.colPlanCode')">
            <span class="text-foreground">{{ props.selectedSchedule?.plan_code || '—' }}</span>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.ops.colMaintenanceType')">
            <span class="text-foreground">{{ props.selectedSchedule?.maintenance_type || '—' }}</span>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.ops.placeholderEquipment')">
            <span class="text-foreground">{{ getEquipmentName(props.selectedSchedule) || '—' }}</span>
          </Descriptions.Item>
        </Descriptions>
      </div>

      <!-- Item Detailed Description -->
      <div class="space-y-2 border-t border-border pt-4">
        <label class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block">
          {{ $t('page.ops.itemDetailDescriptionLabel') }}
        </label>
        <div v-if="selectedItemDetails?.description" class="text-sm text-foreground leading-relaxed whitespace-pre-line bg-card p-3 rounded-lg border border-border">
          {{ selectedItemDetails.description }}
        </div>
        <div v-else class="flex flex-col items-center justify-center py-6 px-4 text-center rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground text-sm">
          <span>{{ $t('page.ops.noItemDescription') }}</span>
        </div>
      </div>

      <!-- Expected Execution Date -->
      <div class="space-y-1.5 border-t border-border pt-4">
        <label class="text-sm font-medium text-foreground block">
          {{ $t('page.ops.expectedExecutionDate') }}
        </label>
        <DatePicker
          v-model:value="drawerSchedule.date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          :placeholder="$t('page.ops.placeholderScheduleDate')"
          class="w-full"
        />
      </div>

      <!-- Assigned Technicians -->
      <div class="space-y-1.5 border-t border-border pt-4">
        <label class="text-sm font-medium text-foreground block">
          {{ $t('page.ops.assignedTechnicians') }}
        </label>
        <Select
          v-model:value="drawerSchedule.user_ids"
          :options="props.userOptions"
          :placeholder="$t('page.ops.placeholderAssignedUsers')"
          mode="multiple"
          option-filter-prop="label"
          show-search
          allow-clear
          class="w-full"
        />
      </div>

      <!-- Maintenance Log Section Card -->
      <div class="space-y-3 border-t border-border pt-4">
        <label class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block">
          {{ $t('page.ops.logTitle') }}
        </label>

        <div v-if="!props.selectedSchedule?.id" class="text-sm text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-300 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50">
          {{ $t('page.ops.logRequiredToSavePlan') }}
        </div>

        <Spin v-else :spinning="loadingLog">
          <div class="rounded-lg border border-border bg-card p-4 space-y-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-foreground block">
                {{ $t('page.ops.logResultLabel') }} <span class="text-red-500">*</span>
              </label>
              <Select
                v-model:value="logResult"
                :placeholder="$t('page.ops.logResultPlaceholder')"
                :options="resultOptions"
                class="w-full"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-sm font-medium text-foreground block">
                {{ $t('page.ops.logNoteLabel') }}
              </label>
              <Input.TextArea
                v-model:value="logNote"
                :placeholder="$t('page.ops.logNotePlaceholder')"
                :rows="3"
                class="w-full"
              />
            </div>
          </div>
        </Spin>
      </div>

    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-2 py-1">
        <template v-if="props.readOnly">
          <div class="flex items-center justify-between w-full gap-2">
            <div class="flex gap-2">
              <Button @click="handleCancelDrawer">
                {{ $t('page.ops.btnCancel') }}
              </Button>
              <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" @click="goToPlan">
                {{ $t('page.ops.btnGoToPlan') }}
              </Button>
            </div>
            <Button
              type="primary"
              class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] text-white"
              :loading="logSubmitting"
              :disabled="!props.selectedSchedule?.id"
              @click="handleSaveDrawer"
            >
              {{ $t('page.ops.btnSave') }}
            </Button>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-end w-full gap-2">
            <Button @click="handleCancelDrawer">
              {{ $t('page.ops.btnCancel') }}
            </Button>
            <Button
              type="primary"
              class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] text-white"
              :loading="logSubmitting"
              @click="handleSaveDrawer"
            >
              {{ $t('page.ops.btnSave') }}
            </Button>
          </div>
        </template>
      </div>
    </template>
  </Drawer>
</template>
