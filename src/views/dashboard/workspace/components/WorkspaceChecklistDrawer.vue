<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Drawer, Tag, Button, Empty, Select, Input, Form, FormItem,
  Popconfirm, Spin, message, InputNumber, DatePicker, Table,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { $t } from '#/locales';
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
    session_date: props.date ? props.date.format('YYYY-MM-DD HH:mm') : dayjs().format('YYYY-MM-DD HH:mm'),
    user_ids: [],
    cycle_type: 'daily',
    cycle_interval: 1,
    checklist_details: [],
  };
}

function openEditForm(session: ChecklistSession) {
  activeMode.value = 'edit';
  selectedSessionId.value = session.id;

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
    schedule_mode: session.schedule_mode === 'single' ? 'single' : 'repeating',
    equipment_id: session.equipment_id || session.equipment?.id || undefined,
    session_date: session.session_date ? dayjs(session.session_date).format('YYYY-MM-DD HH:mm') : (props.date ? props.date.format('YYYY-MM-DD HH:mm') : dayjs().format('YYYY-MM-DD HH:mm')),
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
    const sessionDateStr = sessionForm.value.session_date || (props.date ? props.date.format('YYYY-MM-DD HH:mm') : dayjs().format('YYYY-MM-DD HH:mm'));

    if (activeMode.value === 'create') {
      // 1. Create eamo_checklist_session + eamo_checklist_details
      await createChecklistSessionApi({
        name: sessionForm.value.name,
        schedule_mode: sessionForm.value.schedule_mode,
        equipment_id: sessionForm.value.equipment_id,
        session_date: sessionDateStr,
        cycle_type: sessionForm.value.cycle_type,
        cycle_interval: sessionForm.value.cycle_interval,
        user_ids: sessionForm.value.user_ids,
        details: validDetails.map((item) => ({
          checklist_id: item.checklist_id,
          description: item.description,
        })),
      });
      message.success($t('page.ops.checklistDrawer.msgCreateSuccess'));
    } else if (activeMode.value === 'edit' && sessionForm.value.id) {
      // 2. Update eamo_checklist_session + eamo_checklist_details
      await updateChecklistSessionApi(sessionForm.value.id, {
        name: sessionForm.value.name,
        schedule_mode: sessionForm.value.schedule_mode,
        equipment_id: sessionForm.value.equipment_id,
        session_date: sessionDateStr,
        cycle_type: sessionForm.value.cycle_type,
        cycle_interval: sessionForm.value.cycle_interval,
        user_ids: sessionForm.value.user_ids,
        details: validDetails.map((item) => ({
          id: item.id,
          checklist_id: item.checklist_id,
          description: item.description,
        })),
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

      // Submit judge results
      await judgeChecklistSessionApi({
        session_id: sessionForm.value.id,
        results: validDetails.map((item) => ({
          checklist_id: item.checklist_id,
          result: item.result || 'pass',
          description: item.description,
        })),
        user_ids: sessionForm.value.user_ids,
        timestamp: `${sessionDateStr}:00`,
      });

      message.success($t('page.ops.checklistDrawer.msgUpdateSuccess'));
    }

    activeMode.value = 'list';
    emit('refresh');
  } catch (err: unknown) {
    const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiMsg || $t('page.ops.checklistDrawer.msgSaveError'));
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
                    {{ (record as ChecklistSession).session_date ? dayjs((record as ChecklistSession).session_date).format('YYYY-MM-DD HH:mm') : '—' }}
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

          <Form ref="formRef" :model="sessionForm" :rules="rules" layout="vertical" class="space-y-3">
            <FormItem :label="$t('page.ops.checklistDrawer.fieldName')" name="name" class="mb-2">
              <Input v-model:value="sessionForm.name" :placeholder="$t('page.ops.checklistDrawer.placeholderName')" />
            </FormItem>

            <FormItem :label="$t('page.ops.checklistDrawer.fieldEquipment')" name="equipment_id" class="mb-2">
              <Select
                v-model:value="sessionForm.equipment_id"
                :placeholder="$t('page.ops.checklistDrawer.placeholderEquipment')"
                :options="equipmentSelectOptions"
                show-search
                option-filter-prop="label"
                allow-clear
              />
            </FormItem>

            <FormItem :label="$t('page.ops.scheduleMode')" name="schedule_mode" class="mb-2">
              <Select v-model:value="sessionForm.schedule_mode">
                <Select.Option value="repeating">{{ $t('page.ops.modeRepeating') }}</Select.Option>
                <Select.Option value="single">{{ $t('page.ops.modeSingle') }}</Select.Option>
              </Select>
            </FormItem>

            <FormItem :label="$t('page.ops.colDate')" name="session_date" class="mb-2">
              <DatePicker
                v-model:value="sessionForm.session_date"
                show-time
                value-format="YYYY-MM-DD HH:mm"
                format="YYYY-MM-DD HH:mm"
                class="w-full !w-full"
                style="width: 100%"
                :placeholder="$t('page.ops.placeholderDate')"
              />
            </FormItem>

            <div v-if="sessionForm.schedule_mode === 'repeating'" class="grid grid-cols-2 gap-3">
              <FormItem :label="$t('page.ops.colCycleType')" name="cycle_type" class="col-span-1 mb-2">
                <Select v-model:value="sessionForm.cycle_type" :placeholder="$t('page.ops.placeholderCycleType')">
                  <Select.Option value="daily">{{ $t('page.ops.cycleDaily') }}</Select.Option>
                  <Select.Option value="weekly">{{ $t('page.ops.cycleWeekly') }}</Select.Option>
                  <Select.Option value="monthly">{{ $t('page.ops.cycleMonthly') }}</Select.Option>
                  <Select.Option value="yearly">{{ $t('page.ops.cycleYearly') }}</Select.Option>
                </Select>
              </FormItem>

              <FormItem :label="$t('page.ops.colCycleInterval')" name="cycle_interval" class="col-span-1 mb-2">
                <InputNumber
                  v-model:value="sessionForm.cycle_interval"
                  :min="1"
                  class="w-full !w-full"
                  style="width: 100%"
                  :placeholder="$t('page.ops.placeholderCycleInterval')"
                />
              </FormItem>
            </div>

            <FormItem :label="$t('page.ops.checklistDrawer.fieldUsers')" name="user_ids" class="mb-2">
              <Select
                v-model:value="sessionForm.user_ids"
                mode="multiple"
                :placeholder="$t('page.ops.checklistDrawer.placeholderUsers')"
                :options="userSelectOptions"
                show-search
                option-filter-prop="label"
              />
            </FormItem>

            <!-- DYNAMIC EAMO_CHECKLIST_DETAILS TABLE / LIST -->
            <div class="mt-4 pt-4 border-t border-border">
              <div class="flex items-center justify-between mb-3">
                <div class="font-semibold text-foreground text-sm">
                  {{ $t('page.ops.checklistDrawer.checkItemsHeader') }}
                </div>
              </div>

              <div v-if="sessionForm.checklist_details.length === 0" class="py-6 flex justify-center">
                <Empty :description="$t('page.ops.checklistDrawer.emptyItems')" />
              </div>

              <div v-else class="max-h-[300px] overflow-y-auto divide-y divide-border pr-2 scrollbar-thin">
                <div
                  v-for="(item, index) in sessionForm.checklist_details"
                  :key="item.checklist_id || index"
                  class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <Input
                    v-model:value="item.description"
                    class="flex-1"
                    :placeholder="$t('page.ops.checklistDrawer.placeholderItemDesc')"
                  />
                  <Select v-model:value="item.result" class="w-28 shrink-0">
                    <Select.Option value="pass">{{ $t('page.ops.checklistDrawer.statusPass') }}</Select.Option>
                    <Select.Option value="fail">{{ $t('page.ops.checklistDrawer.statusFail') }}</Select.Option>
                  </Select>
                  <Popconfirm
                    :title="$t('page.ops.checklistDrawer.deleteConfirm')"
                    :ok-text="$t('page.ops.checklistDrawer.btnDelete')"
                    :cancel-text="$t('page.ops.checklistDrawer.btnCancel')"
                    @confirm="removeDetailRow(index)"
                  >
                    <Button type="text" danger class="shrink-0 px-2">
                      {{ $t('page.ops.checklistDrawer.btnDelete') }}
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <Button type="dashed" block class="mt-3" @click="addDetailRow">
                {{ $t('page.ops.checklistDrawer.btnAddItem') }}
              </Button>
            </div>
          </Form>
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
.vben-custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.vben-custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.vben-custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.35);
  border-radius: 9999px;
}
.vben-custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.65);
}
</style>
