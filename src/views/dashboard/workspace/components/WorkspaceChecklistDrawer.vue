<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Drawer, Tag, Button, Empty, Select, Input, Form, FormItem,
  Popconfirm, Spin, message, InputNumber, DatePicker, Table,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { $t } from '#/locales';
import { useRoleAccess } from '#/utils/useRoleAccess';
import {
  createChecklistSessionApi,
  updateChecklistSessionApi,
  updateChecklistDetailsApi,
  deleteChecklistDetailApi,
  judgeChecklistSessionApi,
} from '#/api/ops/checklist';
import type {
  ChecklistSession,
  EquipmentOption,
  UserOption,
  UserSelectOption,
} from '../types';

interface DetailRowItem {
  id?: string;
  checklist_id: string;
  description: string;
  result?: 'pass' | 'fail';
}

const props = withDefaults(
  defineProps<{
    open: boolean;
    date: Dayjs | null;
    checklistSessions?: ChecklistSession[];
    equipments?: EquipmentOption[];
    userOptions?: Array<UserOption | UserSelectOption>;
    readOnly?: boolean;
  }>(),
  {
    checklistSessions: () => [],
    equipments: () => [],
    userOptions: () => [],
    readOnly: false,
  }
);

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'refresh'): void;
}>();

const router = useRouter();
const { isManager, isAdmin } = useRoleAccess();

const canManage = computed(() => isManager.value || isAdmin.value);

const visible = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
});

const formattedDate = computed(() =>
  props.date ? props.date.format('DD/MM/YYYY (dddd)') : ''
);

const activeMode = ref<'list' | 'edit' | 'create'>('list');
const selectedSessionId = ref<string | null>(null);
const loading = ref(false);
const submitting = ref(false);

const equipmentSelectOptions = computed(() =>
  props.equipments.map((e) => ({
    label: `${e.code}${e.name ? ` - ${e.name}` : ''}`,
    value: e.id,
  }))
);

const userSelectOptions = computed(() =>
  props.userOptions.map((u) => {
    if ('label' in u && 'value' in u) return { label: u.label, value: u.value };
    return { label: (u as UserOption).name, value: (u as UserOption).id };
  })
);

// Form state for creating or editing eamo_checklist_sessions & eamo_checklist_details
const sessionForm = ref({
  id: undefined as string | undefined,
  name: '',
  schedule_mode: 'repeating' as 'repeating' | 'single',
  equipment_id: undefined as string | undefined,
  session_date: '' as string,
  user_ids: [] as string[],
  cycle_type: 'daily' as string,
  cycle_interval: 1 as number,
  checklist_details: [] as DetailRowItem[],
});

function getSessionStatusTag(session: ChecklistSession) {
  if (!session.details || session.details.length === 0) {
    return { color: 'red', label: $t('page.ops.statusFailed') };
  }
  const allPassed = session.details.every((d) => {
    const lastLog = d.logs
      ?.filter((l) => l.status === 'completed')
      .sort((a, b) => (a.checked_at ?? '').localeCompare(b.checked_at ?? ''))
      .at(-1);
    return lastLog?.result === 'pass';
  });
  return allPassed
    ? { color: 'blue', label: $t('page.ops.statusPassed') }
    : { color: 'red', label: $t('page.ops.statusFailed') };
}

const sessionTableColumns = computed(() => [
  {
    title: $t('page.ops.checklistDrawer.fieldName') || 'Tên phiên kiểm tra',
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: $t('page.ops.colResult') || 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 130,
    align: 'center' as const,
  },
  {
    title: $t('page.ops.colEquipment') || 'Thiết bị',
    dataIndex: 'equipment',
    key: 'equipment',
    width: 260,
  },
  {
    title: $t('page.ops.colDate') || 'Ngày kiểm tra',
    dataIndex: 'session_date',
    key: 'session_date',
    width: 160,
  },
  {
    title: $t('page.ops.colActions') || 'Thao tác',
    key: 'actions',
    width: 110,
    align: 'center' as const,
  },
]);

const formRef = ref();

const rules = computed(() => ({
  name: [{ required: true, message: $t('page.ops.checklistDrawer.validationName') }],
  equipment_id: [{ required: true, message: $t('page.ops.checklistDrawer.validationEquipment') }],
  session_date: [{ required: true, message: $t('page.ops.validationDate') }],
  cycle_type: [{ required: sessionForm.value.schedule_mode === 'repeating', message: $t('page.ops.placeholderCycleType') }],
  cycle_interval: [{ required: sessionForm.value.schedule_mode === 'repeating', type: 'number' as const, min: 1, message: 'Vui lòng nhập khoảng chu kỳ lặp hợp lệ' }],
}));

function addDetailRow() {
  sessionForm.value.checklist_details.push({
    checklist_id: crypto.randomUUID(),
    description: '',
    result: 'pass',
  });
}

async function removeDetailRow(index: number) {
  const item = sessionForm.value.checklist_details[index];
  if (item && item.id) {
    try {
      loading.value = true;
      await deleteChecklistDetailApi(item.id);
      message.success($t('page.ops.checklistDrawer.msgDeleteSuccess'));
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(apiMsg || $t('page.ops.checklistDrawer.msgDeleteError'));
      return;
    } finally {
      loading.value = false;
    }
  }
  sessionForm.value.checklist_details.splice(index, 1);
}

function openCreateForm() {
  activeMode.value = 'create';
  selectedSessionId.value = null;
  sessionForm.value = {
    id: undefined,
    name: '',
    schedule_mode: 'repeating',
    equipment_id: undefined,
    session_date: props.date ? props.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    user_ids: [],
    cycle_type: 'daily',
    cycle_interval: 1,
    checklist_details: [],
  };
}

function openEditForm(session: ChecklistSession) {
  activeMode.value = 'edit';
  selectedSessionId.value = session.id;

  const scheduleMode = session.schedule_mode
    ?? ((session.cycle_type === 'daily' && session.cycle_interval === 1) ? 'single' : 'repeating');

  const detailsList: DetailRowItem[] = (session.details || []).map((d) => {
    const latestLog = d.logs
      ?.filter((l) => l.status === 'completed')
      .sort((a, b) => (a.checked_at ?? '').localeCompare(b.checked_at ?? ''))
      .at(-1);
    return {
      id: d.id,
      checklist_id: d.checklist_id || d.id,
      description: d.description || '',
      result: (latestLog?.result === 'fail' ? 'fail' : 'pass'),
    };
  });

  sessionForm.value = {
    id: session.id,
    name: session.name || session.equipment?.name || '',
    schedule_mode: scheduleMode,
    equipment_id: session.equipment_id || session.equipment?.id || undefined,
    session_date: session.session_date ? dayjs(session.session_date).format('YYYY-MM-DD') : (props.date ? props.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')),
    user_ids: session.users?.map((u) => u.id) || [],
    cycle_type: session.cycle_type || 'daily',
    cycle_interval: session.cycle_interval || 1,
    checklist_details: detailsList,
  };
}

async function handleSaveSession() {
  try {
    await formRef.value.validateFields();
  } catch {
    return;
  }

  const validDetails = sessionForm.value.checklist_details.filter((d) => d.description.trim());
  if (validDetails.length === 0) {
    message.warning($t('page.ops.checklistDrawer.msgValidationAtLeastOneItem'));
    return;
  }

  submitting.value = true;
  try {
    const isSingle = sessionForm.value.schedule_mode === 'single';
    const effectiveCycleType = isSingle ? 'daily' : sessionForm.value.cycle_type;
    const effectiveCycleInterval = isSingle ? 1 : sessionForm.value.cycle_interval;
    const sessionDateStr = sessionForm.value.session_date || (props.date ? props.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));

    if (activeMode.value === 'create') {
      await createChecklistSessionApi({
        name: sessionForm.value.name,
        equipment_id: sessionForm.value.equipment_id,
        session_date: sessionDateStr,
        schedule_mode: sessionForm.value.schedule_mode,
        cycle_type: effectiveCycleType,
        cycle_interval: effectiveCycleInterval,
        user_ids: sessionForm.value.user_ids,
        details: validDetails.map((item) => ({
          checklist_id: item.checklist_id,
          description: item.description,
        })),
      });
      message.success($t('page.ops.checklistDrawer.msgCreateSuccess'));
    } else if (activeMode.value === 'edit' && sessionForm.value.id) {
      try {
        await updateChecklistSessionApi(sessionForm.value.id, {
          name: sessionForm.value.name,
          equipment_id: sessionForm.value.equipment_id,
          session_date: sessionDateStr,
          schedule_mode: sessionForm.value.schedule_mode,
          cycle_type: effectiveCycleType,
          cycle_interval: effectiveCycleInterval,
          user_ids: sessionForm.value.user_ids,
        });

        await updateChecklistDetailsApi({
          session_id: sessionForm.value.id,
          date: sessionDateStr,
          checklists: validDetails.map((item) => ({
            id: item.id,
            checklist_id: item.checklist_id,
            description: item.description,
          })),
        });
      } catch (structureErr: unknown) {
        // Non-manager engineers might get 403 on structure updates, ignore & allow judge API to proceed
        console.warn('Session structure update skipped or unauthorized:', structureErr);
      }

      // Submit judge results
      await judgeChecklistSessionApi({
        session_id: sessionForm.value.id,
        results: validDetails.map((item) => ({
          checklist_id: item.checklist_id,
          result: item.result || 'pass',
          description: item.description,
        })),
        user_ids: sessionForm.value.user_ids,
        timestamp: `${sessionDateStr} 00:00:00`,
      });

      message.success($t('page.ops.checklistDrawer.msgUpdateSuccess'));
    }

    activeMode.value = 'list';
    emit('refresh');
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== 403 && status !== 401) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(apiMsg || $t('page.ops.checklistDrawer.msgSaveError'));
    }
  } finally {
    submitting.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      activeMode.value = 'list';
    }
  }
);

function goToChecklistDetail(): void {
  const sessionId = selectedSessionId.value;
  const eqId = sessionForm.value.equipment_id;
  if (sessionId) {
    router.push({
      path: '/maintenance/checklist/detail',
      query: { id: sessionId, ...(eqId ? { equipment_id: eqId } : {}) },
    });
    visible.value = false;
  }
}
</script>

<template>
  <Drawer
    v-model:open="visible"
    :title="`${$t('page.ops.checklistDrawer.title')}${formattedDate ? ` (${formattedDate})` : ''}`"
    width="800px"
    placement="right"
    destroy-on-close
  >
    <Spin :spinning="loading">
      <div v-if="date" class="space-y-5 px-1">
        <!-- MODE 1: LIST OF SESSIONS (eamo_checklist_sessions) -->
        <div v-if="activeMode === 'list'" class="space-y-3">
          <div class="text-xs font-bold text-foreground uppercase tracking-wider">
            {{ $t('page.ops.checklistDrawer.checklistSessionList') }}
          </div>

          <div v-if="checklistSessions.length > 0" class="bg-card overflow-hidden">
            <Table
              :columns="sessionTableColumns"
              :data-source="checklistSessions"
              row-key="id"
              size="middle"
              :pagination="false"
              :bordered="false"
              :scroll="{ x: 'max-content' }"
              class="w-full vben-thick-table vben-noborder-table"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <span class="font-medium text-foreground text-sm">
                    {{ (record as ChecklistSession).name || (record as ChecklistSession).equipment?.name || $t('page.ops.checklistDrawer.sessionText') }}
                  </span>
                </template>

                <template v-else-if="column.key === 'status'">
                  <Tag :color="getSessionStatusTag(record as ChecklistSession).color" class="m-0 font-medium text-xs rounded-md">
                    {{ getSessionStatusTag(record as ChecklistSession).label }}
                  </Tag>
                </template>

                <template v-else-if="column.key === 'equipment'">
                  <span class="text-sm text-foreground font-normal">
                    <template v-if="(record as ChecklistSession).equipment">
                      {{ (record as ChecklistSession).equipment?.name }} <br> ({{ (record as ChecklistSession).equipment?.code }})
                    </template>
                    <template v-else-if="(record as ChecklistSession).equipment_id">
                      {{ (record as ChecklistSession).equipment_id }}
                    </template>
                    <template v-else>—</template>
                  </span>
                </template>

                <template v-else-if="column.key === 'session_date'">
                  <span class="text-sm text-foreground/90 font-normal">
                    {{ (record as ChecklistSession).session_date ? dayjs((record as ChecklistSession).session_date).format('YYYY-MM-DD') : '—' }}
                  </span>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <Button
                    size="small"
                    class="rounded border border-border hover:border-primary hover:text-primary font-medium px-3 shadow-2xs"
                    @click="openEditForm(record as ChecklistSession)"
                  >
                    {{ $t('page.ops.checklistDrawer.btnDetail') || 'Chi tiết' }}
                  </Button>
                </template>
              </template>
            </Table>
          </div>

          <div v-else class="py-10 flex justify-center border border-dashed border-border rounded-xl bg-muted/20">
            <Empty :description="$t('page.ops.checklistDrawer.emptySessions')" />
          </div>

          <Button
            v-if="canManage"
            type="primary"
            block
            class="mt-4 bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md text-white font-medium h-10 text-sm"
            @click="openCreateForm"
          >
            {{ $t('page.ops.checklistDrawer.btnCreateSession') }}
          </Button>
        </div>

        <!-- MODE 2: FORM FOR CREATING / EDITING SESSIONS & DETAILS (eamo_checklist_details) -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-bold text-foreground uppercase tracking-wider">
              {{ activeMode === 'create' ? $t('page.ops.checklistDrawer.formTitleCreate') : $t('page.ops.checklistDrawer.formTitleEdit') }}
            </div>
            <Button size="small" @click="activeMode = 'list'">
              &larr; {{ $t('page.ops.checklistDrawer.btnBackToList') }}
            </Button>
          </div>

          <Spin :spinning="submitting">
            <Form ref="formRef" :model="sessionForm" :rules="rules" layout="vertical" class="space-y-6">
              <!-- Main Information -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-x-4">
                <!-- Name -->
                <FormItem :label="$t('page.ops.colName')" name="name" class="col-span-1">
                  <Input
                    v-model:value="sessionForm.name"
                    :disabled="!canManage"
                    :placeholder="$t('page.ops.checklistDrawer.placeholderName')"
                  />
                </FormItem>

                <!-- Equipment -->
                <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id" class="col-span-1">
                  <Select
                    v-model:value="sessionForm.equipment_id"
                    :disabled="!canManage"
                    :placeholder="$t('page.ops.checklistDrawer.placeholderEquipment')"
                    :options="equipmentSelectOptions"
                    show-search
                    option-filter-prop="label"
                    allow-clear
                  />
                </FormItem>

                <!-- Schedule Mode -->
                <FormItem :label="$t('page.ops.scheduleMode')" name="schedule_mode" class="col-span-1">
                  <Select v-model:value="sessionForm.schedule_mode" :disabled="!canManage">
                    <Select.Option value="repeating">{{ $t('page.ops.modeRepeating') }}</Select.Option>
                    <Select.Option value="single">{{ $t('page.ops.modeSingle') }}</Select.Option>
                  </Select>
                </FormItem>

                <!-- Session Date -->
                <FormItem :label="$t('page.ops.colDate')" name="session_date" class="col-span-1">
                  <DatePicker
                    v-model:value="sessionForm.session_date"
                    :disabled="!canManage"
                    value-format="YYYY-MM-DD"
                    format="YYYY-MM-DD"
                    class="w-full"
                    style="width: 100%"
                    :placeholder="$t('page.ops.placeholderDate')"
                  />
                </FormItem>

                <!-- Cycle Type (only for repeating) -->
                <FormItem
                  v-if="sessionForm.schedule_mode === 'repeating'"
                  :label="$t('page.ops.colCycleType')"
                  name="cycle_type"
                  class="col-span-1"
                >
                  <Select v-model:value="sessionForm.cycle_type" :disabled="!canManage" :placeholder="$t('page.ops.placeholderCycleType')">
                    <Select.Option value="daily">{{ $t('page.ops.cycleDaily') }}</Select.Option>
                    <Select.Option value="weekly">{{ $t('page.ops.cycleWeekly') }}</Select.Option>
                    <Select.Option value="monthly">{{ $t('page.ops.cycleMonthly') }}</Select.Option>
                    <Select.Option value="yearly">{{ $t('page.ops.cycleYearly') }}</Select.Option>
                  </Select>
                </FormItem>

                <!-- Cycle Interval (only for repeating) -->
                <FormItem
                  v-if="sessionForm.schedule_mode === 'repeating'"
                  :label="$t('page.ops.colCycleInterval')"
                  name="cycle_interval"
                  class="col-span-1"
                >
                  <InputNumber
                    v-model:value="sessionForm.cycle_interval"
                    :disabled="!canManage"
                    :min="1"
                    :max="365"
                    class="w-full"
                    style="width: 100%"
                    :placeholder="$t('page.ops.placeholderCycleInterval')"
                  />
                </FormItem>

                <!-- Users (full width) -->
                <FormItem :label="$t('page.ops.colExecutor')" name="user_ids" class="col-span-1 md:col-span-3">
                  <Select
                    v-model:value="sessionForm.user_ids"
                    :disabled="!canManage"
                    mode="multiple"
                    :placeholder="$t('page.ops.checklistDrawer.placeholderUsers')"
                    :options="userSelectOptions"
                    show-search
                    option-filter-prop="label"
                    allow-clear
                  />
                </FormItem>
              </div>

              <!-- Checklist Details Section -->
              <div class="pt-4 border-t border-border">
                <div class="mb-3 flex items-end justify-between gap-3">
                  <div class="font-semibold text-foreground text-sm">
                    {{ $t('page.ops.detailItemsHeader') }}
                  </div>
                </div>

                <div class="py-1">
                  <div v-if="sessionForm.checklist_details.length === 0" class="py-6 flex justify-center">
                    <Empty :description="$t('page.ops.noDetailItems')" />
                  </div>

                  <div v-else class="max-h-[300px] overflow-y-auto divide-y divide-border pr-2 scrollbar-thin">
                    <div
                      v-for="(item, index) in sessionForm.checklist_details"
                      :key="item.checklist_id || index"
                      class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <Input
                        v-model:value="item.description"
                        :disabled="!canManage"
                        class="flex-1"
                        :placeholder="$t('page.ops.itemNamePlaceholder')"
                      />
                      <!-- Engineers CAN modify item.result (pass/fail) in edit mode -->
                      <Select v-if="activeMode === 'edit'" v-model:value="item.result" class="w-28 shrink-0">
                        <Select.Option value="pass">{{ $t('page.ops.checklistDrawer.statusPass') }}</Select.Option>
                        <Select.Option value="fail">{{ $t('page.ops.checklistDrawer.statusFail') }}</Select.Option>
                      </Select>
                      <Popconfirm
                        v-if="canManage"
                        :title="$t('page.ops.deleteItemConfirm')"
                        :ok-text="$t('page.ops.btnConfirm')"
                        :cancel-text="$t('page.ops.btnCancel')"
                        @confirm="removeDetailRow(index)"
                      >
                        <Button type="text" danger class="shrink-0 px-2">
                          {{ $t('page.ops.btnDelete') }}
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </div>

                <Button v-if="canManage" type="dashed" block class="mt-3" @click="addDetailRow">
                  {{ $t('page.ops.btnAddCheck') }}
                </Button>
              </div>
            </Form>
          </Spin>
        </div>
      </div>
    </Spin>

    <template #footer>
      <div class="flex items-center justify-between gap-2 py-1">
        <div class="flex items-center gap-2">
          <Button @click="activeMode === 'list' ? (visible = false) : (activeMode = 'list')">
            {{ $t('page.ops.btnCancel') || 'Hủy' }}
          </Button>
          <Button v-if="selectedSessionId" type="primary" @click="goToChecklistDetail">
            {{ $t('page.ops.btnGoToChecklist') || 'Đi tới Checklist' }}
          </Button>
        </div>
        <Button v-if="activeMode !== 'list'" type="primary" :loading="submitting" @click="handleSaveSession">
          {{ $t('page.ops.btnSave') || 'Lưu' }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.vben-thick-table :deep(.ant-table-cell) {
  padding-top: 14px !important;
  padding-bottom: 14px !important;
}
.vben-noborder-table :deep(.ant-table),
.vben-noborder-table :deep(.ant-table-container),
.vben-noborder-table :deep(.ant-table-content) {
  border: none !important;
}
</style>
