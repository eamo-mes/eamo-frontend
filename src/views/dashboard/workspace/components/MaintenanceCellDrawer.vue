<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Drawer, Tag, Button, Select, Form, FormItem, Input, InputNumber, Popconfirm, Spin, Divider, Empty, message,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { $t } from '#/locales';
import {
  listCategoriesApi,
  getMaintenancePlanDetailApi,
  createMaintenancePlanApi,
  updateMaintenancePlanApi,
  type EquipmentOption,
  type MaintenanceCategoryOption,
  type MaintenanceItemOption,
  type ScheduleRow,
  type ScheduleUser,
  type SaveScheduleItemPayload,
} from '#/api/ops/maintenance-plans';
import type { UserOption, UserSelectOption } from '../types';

interface LastMaintenanceNode {
  isLastMaintenance: boolean;
  label: string;
  equipmentId?: string;
  equipmentCode?: string;
  datetime?: string;
}

const props = withDefaults(
  defineProps<{
    open: boolean;
    date: Dayjs | null;
    schedules?: ScheduleRow[];
    lastMaintenances?: LastMaintenanceNode[];
    equipments?: EquipmentOption[];
    categories?: MaintenanceCategoryOption[];
    maintenanceItems?: MaintenanceItemOption[];
    userOptions?: Array<UserOption | UserSelectOption>;
    readOnly?: boolean;
  }>(),
  {
    schedules: () => [],
    lastMaintenances: () => [],
    equipments: () => [],
    categories: () => [],
    maintenanceItems: () => [],
    userOptions: () => [],
    readOnly: false,
  }
);

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'scheduleAdded'): void;
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

// Multi-mode state: 'list' | 'create' | 'edit'
const activeMode = ref<'list' | 'create' | 'edit'>('list');
const selectedPlanId = ref<string | null>(null);
const loading = ref(false);
const submitting = ref(false);
const localCategories = ref<MaintenanceCategoryOption[]>([]);

const formRef = ref();

// Form state for creating / editing eamo_maintenance_plans & schedules (matching detail.vue)
const planForm = ref({
  id: undefined as string | undefined,
  plan_code: '',
  equipment_id: undefined as string | undefined,
  maintenance_category_id: undefined as string | undefined,
  maintenance_type: undefined as string | undefined,
  date: '',
  cycle_type: undefined as string | undefined,
  cycle_interval: undefined as number | undefined,
  occurrences: undefined as number | undefined,
  notes: '',
  schedules: [] as ScheduleRow[],
});

const rules = computed(() => ({
  equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') || 'Vui lòng chọn thiết bị' }],
  maintenance_category_id: [{ required: true, message: $t('page.ops.validationCategoryRequired') || 'Vui lòng chọn danh mục bảo trì' }],
  maintenance_type: [{ required: true, message: $t('page.ops.validationMaintenanceType') || 'Vui lòng chọn loại bảo trì' }],
  date: [{ required: true, message: $t('page.ops.validationPlanDate') || 'Vui lòng chọn ngày kế hoạch' }],
}));

const equipmentSelectOptions = computed(() =>
  props.equipments.map((e) => ({
    label: `${e.code}${e.name ? ` - ${e.name}` : ''}`,
    value: e.id,
  }))
);

const categorySelectOptions = computed(() => {
  const source = props.categories.length > 0 ? props.categories : localCategories.value;
  return source.map((c) => ({
    label: c.name,
    value: c.id,
  }));
});

const maintenanceItemOptions = computed(() => {
  const catId = planForm.value.maintenance_category_id;
  if (!catId) return [];
  return props.maintenanceItems
    .filter((item) => item.maintenance_category_id === catId)
    .map((item) => ({
      label: item.name,
      value: item.id,
    }));
});

const userSelectOptions = computed(() =>
  props.userOptions.map((u) => {
    if ('label' in u && 'value' in u) return { label: u.label, value: u.value };
    return { label: (u as UserOption).name, value: (u as UserOption).id };
  })
);

const maintenanceTypeOptions = computed(() => [
  { label: $t('page.ops.typePreventive') || 'Bảo trì phòng ngừa', value: 'Preventive' },
  { label: $t('page.ops.typeCorrective') || 'Bảo trì khắc phục', value: 'Corrective' },
  { label: $t('page.ops.typePredictive') || 'Bảo trì dự đoán', value: 'Predictive' },
  { label: $t('page.ops.typeInspection') || 'Kiểm tra', value: 'Inspection' },
]);

const cycleTypeOptions = computed(() => [
  { label: $t('page.ops.cycleDaily') || 'Hàng ngày', value: 'daily' },
  { label: $t('page.ops.cycleWeekly') || 'Hàng tuần', value: 'weekly' },
  { label: $t('page.ops.cycleMonthly') || 'Hàng tháng', value: 'monthly' },
  { label: $t('page.ops.cycleQuarterly') || 'Hàng quý', value: 'quarterly' },
  { label: $t('page.ops.cycleYearly') || 'Hàng năm', value: 'yearly' },
]);

export interface DrawerPlanNode {
  key: string;
  plan_id: string;
  plan_code: string;
  equipment_code: string;
  equipment_name: string | null;
  category_name?: string;
  maintenance_type?: string;
  schedules: ScheduleRow[];
  total_items: number;
  completed_items: number;
  result: 'Completed' | 'Pending';
}

const dailyPlanNodes = computed<DrawerPlanNode[]>(() => {
  if (!props.schedules || props.schedules.length === 0) return [];

  const planMap = new Map<string, DrawerPlanNode>();

  for (const s of props.schedules) {
    const planKey = s.maintenance_plan_id || s.plan_code || s.id || 'unknown';
    const isCompleted = s.result === 'Completed';

    const eqCode = s.equipment_code || s.maintenance_plan?.equipment?.code || '—';
    const eqName = s.equipment_name || s.maintenance_plan?.equipment?.name || null;

    if (!planMap.has(planKey)) {
      planMap.set(planKey, {
        key: `drawer-plan-${planKey}`,
        plan_id: s.maintenance_plan_id || s.id || '',
        plan_code: s.plan_code || s.maintenance_plan?.plan_code || s.item_name || '—',
        equipment_code: eqCode,
        equipment_name: eqName,
        category_name: s.category_name || s.maintenance_plan?.maintenance_category?.name,
        maintenance_type: s.maintenance_type || s.maintenance_plan?.maintenance_type,
        schedules: [s],
        total_items: 1,
        completed_items: isCompleted ? 1 : 0,
        result: isCompleted ? 'Completed' : 'Pending',
      });
    } else {
      const node = planMap.get(planKey)!;
      node.schedules.push(s);
      node.total_items += 1;
      if (isCompleted) {
        node.completed_items += 1;
      }

      if (node.completed_items === node.total_items) {
        node.result = 'Completed';
      } else {
        node.result = 'Pending';
      }
    }
  }

  return Array.from(planMap.values());
});

function getResultTagColor(result?: string | null): string {
  if (result === 'Completed') return 'success';
  return 'processing';
}

function getResultLabel(result?: string | null): string {
  if (result === 'Completed') {
    return $t('page.ops.statusPassed') || 'Hoàn thành';
  }
  return $t('page.ops.statusPending') || 'Chưa hoàn thành';
}

function generateKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function addScheduleRow(): void {
  planForm.value.schedules.push({
    maintenance_item_id: '',
    date: planForm.value.date || (props.date ? props.date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0] as string),
    user_ids: [],
    equipment_id: planForm.value.equipment_id,
    _key: generateKey(),
  });
}

function removeScheduleRow(index: number): void {
  planForm.value.schedules.splice(index, 1);
}

function openCreateForm(): void {
  activeMode.value = 'create';
  selectedPlanId.value = null;
  const initialDate = props.date ? props.date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0] as string;
  planForm.value = {
    id: undefined,
    plan_code: '',
    equipment_id: undefined,
    maintenance_category_id: undefined,
    maintenance_type: undefined,
    date: initialDate,
    cycle_type: undefined,
    cycle_interval: undefined,
    occurrences: undefined,
    notes: '',
    schedules: [],
  };
}

async function openEditForm(planId: string): Promise<void> {
  activeMode.value = 'edit';
  selectedPlanId.value = planId;
  loading.value = true;
  try {
    const record = await getMaintenancePlanDetailApi(planId);
    if (record) {
      planForm.value = {
        id: record.id,
        plan_code: record.plan_code ?? '',
        equipment_id: record.equipment_id ?? undefined,
        maintenance_category_id: record.maintenance_category_id ?? undefined,
        maintenance_type: record.maintenance_type ?? undefined,
        date: record.date ?? '',
        cycle_type: record.cycle_type ?? undefined,
        cycle_interval: record.cycle_interval ?? undefined,
        occurrences: record.occurrences ?? undefined,
        notes: record.notes ?? '',
        schedules: (record.maintenance_schedule ?? [])
          .filter((s) => s.maintenance_item_id)
          .map((s) => ({
            id: s.id,
            maintenance_item_id: s.maintenance_item_id,
            date: s.date,
            user_ids: (s.users ?? []).map((u: ScheduleUser) => u.id),
            result: s.maintenance_logs?.[0]?.result || null,
            equipment_id: s.equipment_id || record.equipment_id,
            maintenance_plan_id: s.maintenance_plan_id || record.id,
            _key: generateKey(),
          })),
      };
    }
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || 'Không thể tải chi tiết kế hoạch');
    activeMode.value = 'list';
  } finally {
    loading.value = false;
  }
}

async function handleSavePlan(): Promise<void> {
  try {
    await formRef.value.validateFields();
  } catch {
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      plan_code: planForm.value.plan_code || null,
      equipment_id: planForm.value.equipment_id,
      maintenance_category_id: planForm.value.maintenance_category_id,
      maintenance_type: planForm.value.maintenance_type,
      date: planForm.value.date,
      start_time: null,
      end_time: null,
      cycle_type: planForm.value.cycle_type ?? null,
      cycle_interval: planForm.value.cycle_interval ?? null,
      occurrences: planForm.value.occurrences ?? null,
      notes: planForm.value.notes || null,
      schedules: planForm.value.schedules.map((s): SaveScheduleItemPayload => ({
        id: s.id,
        maintenance_item_id: s.maintenance_item_id,
        date: s.date,
        user_ids: s.user_ids,
      })),
    };

    if (activeMode.value === 'edit' && planForm.value.id) {
      await updateMaintenancePlanApi(planForm.value.id, payload);
      message.success($t('page.ops.planSaveSuccess') || 'Cập nhật kế hoạch thành công!');
    } else {
      await createMaintenancePlanApi(payload);
      message.success($t('page.ops.planSaveSuccess') || 'Tạo mới kế hoạch thành công!');
    }

    activeMode.value = 'list';
    emit('scheduleAdded');
    emit('refresh');
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || $t('page.ops.planSaveError') || 'Không thể lưu kế hoạch bảo trì');
  } finally {
    submitting.value = false;
  }
}

async function fetchCategoriesIfNeeded() {
  if (props.categories.length === 0 && localCategories.value.length === 0) {
    try {
      localCategories.value = await listCategoriesApi();
    } catch {
      // ignore
    }
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      activeMode.value = 'list';
      fetchCategoriesIfNeeded();
    }
  }
);

function goToPlanDetail(): void {
  const planId = selectedPlanId.value;
  if (planId) {
    router.push({
      name: 'OpsMaintenancePlanDetail',
      query: { id: planId },
    });
    visible.value = false;
  }
}
</script>

<template>
  <Drawer
    v-model:open="visible"
    :title="`${$t('page.ops.schedulesTitle') || 'Chi tiết lịch bảo trì'}${formattedDate ? ` (${formattedDate})` : ''}`"
    width="800px"
    placement="right"
    destroy-on-close
  >
    <Spin :spinning="loading">
      <div v-if="date" class="space-y-5 px-1">
        <div v-if="activeMode === 'list'" class="space-y-4">
          <!-- Last Maintenance Events -->
          <div v-if="lastMaintenances.length > 0" class="space-y-1.5 mb-3">
            <div class="text-[10px] font-bold text-foreground uppercase tracking-wider">
              {{ $t('page.ops.lastMaintenance') || 'Bảo trì lần cuối' }}
            </div>
            <div
              v-for="lm in lastMaintenances"
              :key="lm.equipmentId + '-' + lm.datetime"
              class="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg flex items-center justify-between"
            >
              <span class="font-medium text-teal-800 dark:text-teal-200 text-sm">{{ lm.label }}</span>
              <Tag color="teal">{{ dayjs(lm.datetime).format('HH:mm DD/MM/YYYY') }}</Tag>
            </div>
            <Divider class="my-3" />
          </div>

          <!-- Schedules / Plans List -->
          <div class="space-y-3">
            <div class="text-xs font-bold text-foreground uppercase tracking-wider">
              {{ $t('page.ops.schedulesTitle') || 'Lịch trình bảo trì' }}
            </div>

            <div v-if="dailyPlanNodes.length > 0" class="space-y-2.5">
              <div
                v-for="planNode in dailyPlanNodes"
                :key="planNode.key"
                class="p-3.5 bg-card border border-border rounded-xl hover:border-primary/50 transition-all flex items-center justify-between gap-3 shadow-2xs"
              >
                <div class="min-w-0 flex-1">
                  <div class="text-foreground text-sm flex items-center gap-2">
                    <Tag :color="getResultTagColor(planNode.result)" class="m-0 font-medium text-xs">
                      {{ getResultLabel(planNode.result) }}
                    </Tag>
                    <span class="font-semibold truncate">{{ planNode.plan_code }}</span>
                  </div>
                  <div class="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 ml-0.5 truncate">
                    <span class="font-medium text-foreground/80">{{ planNode.equipment_code }}</span>
                    <span v-if="planNode.category_name" class="text-muted-foreground/60">· {{ planNode.category_name }}</span>
                    <span v-if="planNode.maintenance_type" class="text-muted-foreground/60">· {{ planNode.maintenance_type }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <Button
                    size="small"
                    type="link"
                    class="px-0 font-medium"
                    @click="openEditForm(planNode.plan_id)"
                  >
                    {{ $t('page.ops.checklistDrawer.btnDetail') || 'Chi tiết' }} &rarr;
                  </Button>
                </div>
              </div>
            </div>

            <div v-else class="py-10 flex justify-center">
              <Empty :description="$t('page.ops.noSchedules') || 'Chưa có lịch bảo trì cho ngày này.'" />
            </div>

            <Button type="dashed" block class="mt-3" @click="openCreateForm">
              + {{ $t('page.ops.btnAddPlanShort') || 'Tạo kế hoạch bảo trì mới' }}
            </Button>
          </div>
        </div>

        <!-- MODE 2 & 3: FORM FOR CREATING / EDITING MAINTENANCE PLANS & SCHEDULES -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-bold text-foreground uppercase tracking-wider">
              {{ activeMode === 'create' ? ($t('page.ops.createTitle') || 'Tạo kế hoạch bảo trì') : ($t('page.ops.editTitle') || 'Chỉnh sửa kế hoạch bảo trì') }}
            </div>
            <Button size="small" @click="activeMode = 'list'">
              &larr; {{ $t('page.ops.checklistDrawer.btnBackToList') || 'Quay lại danh sách' }}
            </Button>
          </div>

          <Form ref="formRef" :model="planForm" :rules="rules" layout="vertical" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <!-- Mã kế hoạch -->
              <FormItem :label="$t('page.ops.colPlanCode') || 'Mã kế hoạch'" name="plan_code" class="mb-2">
                <Input v-model:value="planForm.plan_code" :placeholder="$t('page.ops.placeholderPlanCode') || 'Nhập mã kế hoạch...'" />
              </FormItem>

              <!-- Thiết bị -->
              <FormItem :label="$t('page.ops.placeholderEquipment') || 'Thiết bị'" name="equipment_id" class="mb-2">
                <Select
                  v-model:value="planForm.equipment_id"
                  :options="equipmentSelectOptions"
                  :placeholder="$t('page.ops.placeholderEquipment') || 'Chọn thiết bị...'"
                  show-search
                  option-filter-prop="label"
                  allow-clear
                />
              </FormItem>

              <!-- Danh mục bảo trì -->
              <FormItem :label="$t('page.ops.maintenanceCategories') || 'Danh mục bảo trì'" name="maintenance_category_id" class="mb-2">
                <Select
                  v-model:value="planForm.maintenance_category_id"
                  :options="categorySelectOptions"
                  :placeholder="$t('page.ops.maintenanceCategories') || 'Chọn danh mục...'"
                  show-search
                  option-filter-prop="label"
                  allow-clear
                />
              </FormItem>

              <!-- Loại bảo trì -->
              <FormItem :label="$t('page.ops.colMaintenanceType') || 'Loại bảo trì'" name="maintenance_type" class="mb-2">
                <Select
                  v-model:value="planForm.maintenance_type"
                  :options="maintenanceTypeOptions"
                  :placeholder="$t('page.ops.placeholderMaintenanceType') || 'Chọn loại...'"
                  allow-clear
                  show-search
                />
              </FormItem>

              <!-- Ngày kế hoạch -->
              <FormItem :label="$t('page.ops.startDate') || 'Ngày kế hoạch'" name="date" class="mb-2">
                <Input
                  v-model:value="planForm.date"
                  type="date"
                  class="w-full"
                />
              </FormItem>

              <!-- Chu kỳ -->
              <FormItem :label="$t('page.ops.colCycleType') || 'Chu kỳ lặp'" name="cycle_type" class="mb-2">
                <Select
                  v-model:value="planForm.cycle_type"
                  :options="cycleTypeOptions"
                  :placeholder="$t('page.ops.placeholderCycleType') || 'Chọn chu kỳ...'"
                  allow-clear
                  @clear="() => { planForm.cycle_interval = undefined; planForm.occurrences = undefined; }"
                />
              </FormItem>

              <!-- Khoảng chu kỳ -->
              <FormItem
                v-if="planForm.cycle_type"
                :label="$t('page.ops.colCycleInterval') || 'Khoảng chu kỳ'"
                name="cycle_interval"
                class="mb-2"
              >
                <InputNumber
                  v-model:value="planForm.cycle_interval"
                  :min="1"
                  class="w-full"
                  style="width: 100%"
                />
              </FormItem>

              <!-- Số lần lặp -->
              <FormItem
                v-if="planForm.cycle_type"
                :label="$t('page.ops.colOccurrences') || 'Số lần lặp'"
                name="occurrences"
                class="mb-2"
              >
                <InputNumber
                  v-model:value="planForm.occurrences"
                  :min="1"
                  :max="100"
                  class="w-full"
                  style="width: 100%"
                />
              </FormItem>
            </div>

            <!-- Ghi chú -->
            <FormItem :label="$t('page.ops.colNotes') || 'Ghi chú'" name="notes" class="mb-2">
              <Input.TextArea
                v-model:value="planForm.notes"
                :placeholder="$t('page.ops.placeholderPlanNotes') || 'Nhập ghi chú...'"
                :rows="2"
              />
            </FormItem>

            <!-- DYNAMIC SCHEDULES LIST -->
            <div class="mt-4 pt-4 border-t border-border">
              <div class="flex items-center justify-between mb-3">
                <div class="font-semibold text-foreground text-sm">
                  {{ $t('page.ops.schedulesTitle') || 'Danh sách lịch bảo trì' }}
                </div>
                <span class="text-xs text-muted-foreground">
                  ({{ planForm.schedules.length }} {{ $t('page.ops.colScheduleDate') || 'mục' }})
                </span>
              </div>

              <div v-if="planForm.schedules.length === 0" class="py-6 flex justify-center">
                <Empty :description="$t('page.ops.noSchedules') || 'Chưa có lịch bảo trì nào'" />
              </div>

              <div v-else class="max-h-[360px] overflow-y-auto divide-y divide-border pr-2 scrollbar-thin">
                <div
                  v-for="(schedule, idx) in planForm.schedules"
                  :key="schedule._key || idx"
                  class="flex flex-wrap md:flex-nowrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <!-- Hạng mục bảo trì -->
                  <div class="flex-1 min-w-[200px]">
                    <span class="text-xs text-gray-400 block mb-1 font-medium">
                      {{ $t('page.ops.colMaintenanceItem') || 'Hạng mục bảo trì' }}
                    </span>
                    <Select
                      v-model:value="schedule.maintenance_item_id"
                      :options="maintenanceItemOptions"
                      :placeholder="$t('page.ops.placeholderMaintenanceItem') || 'Chọn hạng mục...'"
                      show-search
                      option-filter-prop="label"
                      allow-clear
                      class="w-full"
                    />
                  </div>

                  <!-- Ngày thực hiện -->
                  <div class="w-[160px]">
                    <span class="text-xs text-gray-400 block mb-1 font-medium">
                      {{ $t('page.ops.colScheduleDate') || 'Ngày thực hiện' }}
                    </span>
                    <Input
                      v-model:value="schedule.date"
                      type="date"
                      class="w-full"
                    />
                  </div>

                  <!-- Người thực hiện -->
                  <div class="flex-1 min-w-[200px]">
                    <span class="text-xs text-gray-400 block mb-1 font-medium">
                      {{ $t('page.ops.colAssignedUsers') || 'Người thực hiện' }}
                    </span>
                    <Select
                      v-model:value="schedule.user_ids"
                      :options="userSelectOptions"
                      :placeholder="$t('page.ops.placeholderAssignedUsers') || 'Chọn người...'"
                      mode="multiple"
                      option-filter-prop="label"
                      show-search
                      allow-clear
                      class="w-full"
                    />
                  </div>

                  <!-- Nút Xóa -->
                  <div class="self-end pb-0.5">
                    <Popconfirm
                      :title="$t('page.ops.deleteConfirm') || 'Bạn có chắc chắn muốn xóa lịch này?'"
                      :ok-text="$t('page.ops.btnConfirm') || 'Đồng ý'"
                      :cancel-text="$t('page.ops.btnCancel') || 'Hủy'"
                      @confirm="removeScheduleRow(idx)"
                    >
                      <Button type="text" danger class="shrink-0 px-2">
                        {{ $t('page.ops.btnDelete') || 'Xóa' }}
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>

              <Button
                type="dashed"
                block
                class="mt-3"
                :disabled="!planForm.maintenance_category_id"
                @click="addScheduleRow"
              >
                + {{ $t('page.ops.btnAddSchedule') || 'Thêm lịch bảo trì' }}
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
          <Button v-if="selectedPlanId" type="primary" @click="goToPlanDetail">
            {{ $t('page.ops.btnGoToPlan') || 'Đi tới Kế hoạch' }}
          </Button>
        </div>
        <Button v-if="activeMode !== 'list'" type="primary" :loading="submitting" @click="handleSavePlan">
          {{ $t('page.ops.btnSave') || 'Lưu' }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
