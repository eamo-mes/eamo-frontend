<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { $t } from '#/locales';
import {
  Button,
  Card,
  DatePicker,
  Form,
  FormItem,
  Input,
  InputNumber,
  Select,
  Spin,
  message,
  Breadcrumb,
  Popconfirm,
} from 'ant-design-vue';
import AddMaintenanceItemModal from './components/AddMaintenanceItemModal.vue';
import VisualMaintenanceCalendar from './components/VisualMaintenanceCalendar.vue';
import { ChevronLeft } from '@vben/icons';
import { listUsersApi, type UserItem } from '#/api/core/users';
import {
  listEquipmentsApi,
  listCategoriesApi,
  listMaintenanceItemsApi,
  updateMaintenanceItemApi,
  deleteMaintenanceItemApi,
  getMaintenancePlanDetailApi,
  createMaintenancePlanApi,
  updateMaintenancePlanApi,
  type EquipmentOption,
  type MaintenanceCategoryOption,
  type MaintenanceItemOption,
  type ScheduleRow,
  type ScheduleUser,
  type MaintenancePlanRecord,
  type SaveScheduleItemPayload,
} from '#/api/ops/maintenance-plans';

// ─── State ───────────────────────────────────────────────────────────────────

const route = useRoute();
const router = useRouter();

const activeView = ref<'form' | 'calendar'>('form');
const loading = ref(false);
const submitting = ref(false);
const isEditing = computed(() => !!route.query.id);
const editId = computed(() => route.query.id as string | undefined);

const equipments = ref<EquipmentOption[]>([]);
const categories = ref<MaintenanceCategoryOption[]>([]);
const maintenanceItems = ref<MaintenanceItemOption[]>([]);
const users = ref<UserItem[]>([]);

const formRef = ref();

const formState = ref({
  plan_code: '',
  equipment_id: undefined as string | undefined,
  maintenance_category_id: undefined as string | undefined,
  maintenance_type: undefined as string | undefined,
  date: '',
  start_time: '',
  end_time: '',
  cycle_type: undefined as string | undefined,
  cycle_interval: undefined as number | undefined,
  occurrences: undefined as number | undefined,
  notes: '',
  schedules: [] as ScheduleRow[],
});

// ─── Options ────────────────────────────────────────────────────────────────

const equipmentOptions = computed(() =>
  equipments.value.map(eq => ({
    label: `${eq.code}${eq.name ? ` — ${eq.name}` : ''}`,
    value: eq.id,
  }))
);

const maintenanceItemOptions = computed(() => {
  const catId = formState.value.maintenance_category_id;
  if (!catId) return [];
  return maintenanceItems.value
    .filter(item => item.maintenance_category_id === catId)
    .map(item => ({
      label: item.name,
      value: item.id,
    }));
});

const categoryOptions = computed(() =>
  categories.value.map(cat => ({
    label: cat.name,
    value: cat.id,
  }))
);

const userOptions = computed(() =>
  users.value.map(u => ({
    label: u.name,
    value: u.id,
  }))
);

const searchValue = ref('');

const maintenanceTypeOptions = computed(() => {
  const defaults = [
    { label: $t('page.ops.typePreventive'), value: 'Preventive' },
    { label: $t('page.ops.typeCorrective'), value: 'Corrective' },
    { label: $t('page.ops.typePredictive'), value: 'Predictive' },
    { label: $t('page.ops.typeInspection'), value: 'Inspection' },
  ];

  const currentVal = formState.value.maintenance_type;
  const list = [...defaults];

  if (currentVal && !defaults.some(d => d.value === currentVal)) {
    list.push({ label: currentVal, value: currentVal });
  }

  if (searchValue.value) {
    const typed = searchValue.value.trim();
    if (typed && !list.some(item => item.value.toLowerCase() === typed.toLowerCase() || item.label.toLowerCase() === typed.toLowerCase())) {
      list.push({ label: $t('page.ops.useValue', { value: typed }), value: typed });
    }
  }

  return list;
});

const cycleTypeOptions = computed(() => [
  { label: $t('page.ops.cycleDaily'), value: 'daily' },
  { label: $t('page.ops.cycleWeekly'), value: 'weekly' },
  { label: $t('page.ops.cycleMonthly'), value: 'monthly' },
  { label: $t('page.ops.cycleQuarterly'), value: 'quarterly' },
  { label: $t('page.ops.cycleYearly'), value: 'yearly' },
]);

// ─── Validation Rules ────────────────────────────────────────────────────────

const rules = computed(() => ({
  equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
  maintenance_category_id: [{ required: true, message: $t('page.ops.validationCategoryRequired') }],
  maintenance_type: [{ required: true, message: $t('page.ops.validationMaintenanceType') }],
  date: [{ required: true, message: $t('page.ops.validationPlanDate') }],
}));

// ─── Data Loading ────────────────────────────────────────────────────────────

async function loadEquipments(): Promise<void> {
  try {
    equipments.value = await listEquipmentsApi();
  } catch {
    // silently fail
  }
}

async function loadMaintenanceItems(): Promise<void> {
  try {
    maintenanceItems.value = await listMaintenanceItemsApi();
  } catch {
    // silently fail
  }
}

async function loadCategories(): Promise<void> {
  try {
    categories.value = await listCategoriesApi();
  } catch {
    // silently fail
  }
}

function handleCategoryChange(): void {
  const catId = formState.value.maintenance_category_id;
  formState.value.schedules.forEach(schedule => {
    const item = maintenanceItems.value.find(i => i.id === schedule.maintenance_item_id);
    if (!item || item.maintenance_category_id !== catId) {
      schedule.maintenance_item_id = '';
    }
  });
}

async function loadUsers(): Promise<void> {
  try {
    users.value = await listUsersApi({ per_page: 1000 });
  } catch {
    // silently fail
  }
}

function generateKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function setFormStateFromRecord(record: MaintenancePlanRecord): void {
  formState.value = {
    plan_code: record.plan_code ?? '',
    equipment_id: record.equipment_id ?? undefined,
    maintenance_category_id: record.maintenance_category_id ?? undefined,
    maintenance_type: record.maintenance_type ?? undefined,
    date: record.date ?? '',
    start_time: record.start_time ?? '',
    end_time: record.end_time ?? '',
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

async function loadPlanDetail(id: string): Promise<void> {
  loading.value = true;
  try {
    const record = await getMaintenancePlanDetailApi(id);
    if (record) {
      setFormStateFromRecord(record);
    }
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || $t('page.ops.planLoadDetailError'));
    goBack();
  } finally {
    loading.value = false;
  }
}

function removeScheduleRow(index: number): void {
  formState.value.schedules.splice(index, 1);
}

function addScheduleRow(): void {
  formState.value.schedules.push({
    maintenance_item_id: '',
    date: formState.value.date || new Date().toISOString().split('T')[0] as string,
    user_ids: [],
    equipment_id: formState.value.equipment_id,
    maintenance_plan_id: editId.value,
    _key: generateKey(),
  });
}

// ─── Submit ──────────────────────────────────────────────────────────────────

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      plan_code: formState.value.plan_code || null,
      equipment_id: formState.value.equipment_id,
      maintenance_category_id: formState.value.maintenance_category_id,
      maintenance_type: formState.value.maintenance_type,
      date: formState.value.date,
      start_time: formState.value.start_time || null,
      end_time: formState.value.end_time || null,
      cycle_type: formState.value.cycle_type ?? null,
      cycle_interval: formState.value.cycle_interval ?? null,
      occurrences: formState.value.occurrences ?? null,
      notes: formState.value.notes || null,
      schedules: formState.value.schedules.map((s): SaveScheduleItemPayload => ({
        id: s.id,
        maintenance_item_id: s.maintenance_item_id,
        date: s.date,
        user_ids: s.user_ids,
      })),
    };

    if (isEditing.value && editId.value) {
      const updated = await updateMaintenancePlanApi(editId.value, payload);
      message.success($t('page.ops.planSaveSuccess'));
      if (updated) {
        setFormStateFromRecord(updated);
      }
    } else {
      const created = await createMaintenancePlanApi(payload);
      message.success($t('page.ops.planSaveSuccess'));
      if (created) {
        setFormStateFromRecord(created);
        if (created.id) {
          router.replace({ name: 'OpsMaintenancePlanDetail', query: { id: created.id } });
        }
      }
    }
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    if (apiError) {
      message.error(apiError);
    } else {
      const validationErr = err as { errorFields?: unknown[] };
      if (!validationErr?.errorFields) {
        message.error($t('page.ops.planSaveError'));
      }
    }
  } finally {
    submitting.value = false;
  }
}

function goBack(): void {
  router.push({ name: 'OpsMaintenancePlans' });
}

const isAddItemModalOpen = ref(false);

function showAddItemModal(): void {
  isAddItemModalOpen.value = true;
}

function handleAddItemSuccess(item: MaintenanceItemOption, userIds: string[]): void {
  maintenanceItems.value.push(item);
  setItemUserIds(item.id, userIds);
  if (isEditing.value) {
    handleSubmit();
  }
}

function setItemUserIds(itemId: string, userIds: string[]): void {
  const matchingSchedules = formState.value.schedules.filter(s => s.maintenance_item_id === itemId);
  if (matchingSchedules.length > 0) {
    matchingSchedules.forEach(s => {
      s.user_ids = userIds;
    });
  } else {
    formState.value.schedules.push({
      maintenance_item_id: itemId,
      date: (formState.value.date || new Date().toISOString().split('T')[0]) as string,
      user_ids: userIds,
      equipment_id: formState.value.equipment_id,
      maintenance_plan_id: editId.value,
      _key: generateKey(),
    });
  }
}

const categoryItems = computed(() => {
  const catId = formState.value.maintenance_category_id;
  if (!catId) return [];
  return maintenanceItems.value.filter((item) => item.maintenance_category_id === catId);
});

const updatingItems = ref<Record<string, boolean>>({});
const deletingItems = ref<Record<string, boolean>>({});

async function updateCategoryItem(item: MaintenanceItemOption): Promise<void> {
  const name = item.name.trim();
  if (!name) {
    message.error($t('page.ops.itemNameRequired'));
    return;
  }
  updatingItems.value[item.id] = true;
  try {
    await updateMaintenanceItemApi(item.id, {
      name,
      description: item.description?.trim() || null,
      maintenance_category_id: item.maintenance_category_id,
      user_ids: item.user_ids,
    });
    message.success($t('page.ops.updateItemSuccess'));
    if (isEditing.value) {
      await handleSubmit();
    }
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || $t('page.ops.updateItemError'));
  } finally {
    updatingItems.value[item.id] = false;
  }
}

async function deleteCategoryItem(id: string): Promise<void> {
  deletingItems.value[id] = true;
  try {
    await deleteMaintenanceItemApi(id);
    maintenanceItems.value = maintenanceItems.value.filter((i) => i.id !== id);
    formState.value.schedules = formState.value.schedules.filter((s) => s.maintenance_item_id !== id);
    message.success($t('page.ops.deleteItemSuccess'));
    if (isEditing.value) {
      await handleSubmit();
    }
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || $t('page.ops.deleteItemError'));
  } finally {
    deletingItems.value[id] = false;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([loadEquipments(), loadCategories(), loadMaintenanceItems(), loadUsers()]);
    if (editId.value) {
      await loadPlanDetail(editId.value);
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6 space-y-6 w-full">
    <!-- Breadcrumb -->
    <Breadcrumb
      :items="[
        { title: $t('page.ops.maintenanceTitle') },
        { title: $t('page.ops.maintenancePlans'), href: '/maintenance/maintenance-plans' },
        { title: isEditing ? $t('page.ops.editPlan') : $t('page.ops.addNewPlan') },
      ]"
    />

    <!-- Header -->
    <div class="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
      <div class="flex items-center gap-3">
        <Button class="flex items-center justify-center" @click="goBack">
          <ChevronLeft class="size-5" />
        </Button>
        <h1 class="text-xl font-bold text-gray-800 dark:text-gray-200 m-0">
          {{ isEditing ? $t('page.ops.editPlan') : $t('page.ops.addNewPlan') }}
        </h1>
      </div>
      <div class="flex gap-2 items-center">
        <!-- Nút chuyển giữa các ô nhập và Calendar (Nút bên trái Cancel) -->
        <Button
          type="default"
          class="flex items-center gap-1.5"
          @click="activeView = activeView === 'form' ? 'calendar' : 'form'"
        >
          <svg v-if="activeView === 'form'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {{ activeView === 'form' ? $t('page.ops.btnCalendarView') : $t('page.ops.btnListView') }}
        </Button>

        <Button type="default" @click="goBack" :disabled="submitting">
          {{ $t('page.ops.btnCancel') }}
        </Button>
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ $t('page.ops.btnSave') }}
        </Button>
      </div>
    </div>

    <Spin :spinning="loading || submitting">
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
      >
        <!-- ── Form View (Các ô nhập) ─────────────────────────────────────────── -->
        <div v-show="activeView === 'form'" class="space-y-6">
          <!-- ── Card 1: Plan Info ───────────────────────────────────────── -->
          <Card :title="$t('page.ops.planInfoTitle')" class="rounded-xl shadow-sm">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6">
              <!-- Mã kế hoạch -->
              <FormItem :label="$t('page.ops.colPlanCode')" name="plan_code">
                <Input
                  v-model:value="formState.plan_code"
                  :placeholder="$t('page.ops.placeholderPlanCode')"
                />
              </FormItem>

              <!-- Thiết bị -->
              <FormItem :label="$t('page.ops.placeholderEquipment')" name="equipment_id">
                <Select
                  v-model:value="formState.equipment_id"
                  :options="equipmentOptions"
                  :placeholder="$t('page.ops.placeholderEquipment')"
                  show-search
                  option-filter-prop="label"
                  allow-clear
                  class="w-full"
                />
              </FormItem>

              <!-- Danh mục bảo trì -->
              <FormItem :label="$t('page.ops.maintenanceCategories')" name="maintenance_category_id">
                <Select
                  v-model:value="formState.maintenance_category_id"
                  :options="categoryOptions"
                  :placeholder="$t('page.ops.maintenanceCategories')"
                  show-search
                  option-filter-prop="label"
                  allow-clear
                  class="w-full"
                  @change="handleCategoryChange"
                />
              </FormItem>

              <!-- Loại bảo trì -->
              <FormItem :label="$t('page.ops.colMaintenanceType')" name="maintenance_type">
                <Select
                  v-model:value="formState.maintenance_type"
                  :options="maintenanceTypeOptions"
                  :placeholder="$t('page.ops.placeholderMaintenanceType')"
                  allow-clear
                  show-search
                  class="w-full"
                  @search="val => searchValue = val"
                  @change="() => searchValue = ''"
                />
              </FormItem>

              <!-- Ngày kế hoạch -->
              <FormItem :label="$t('page.ops.startDate')" name="date">
                <DatePicker
                  v-model:value="formState.date"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  :placeholder="$t('page.ops.placeholderDate')"
                  class="w-full"
                />
              </FormItem>

              <!-- Chu kỳ -->
              <FormItem :label="$t('page.ops.colCycleType')" name="cycle_type">
                <Select
                  v-model:value="formState.cycle_type"
                  :options="cycleTypeOptions"
                  :placeholder="$t('page.ops.placeholderCycleType')"
                  allow-clear
                  class="w-full"
                  @clear="() => { formState.cycle_interval = undefined; formState.occurrences = undefined; }"
                />
              </FormItem>

              <!-- Khoảng chu kỳ -->
              <FormItem
                v-if="formState.cycle_type"
                :label="$t('page.ops.colCycleInterval')"
                name="cycle_interval"
                :rules="[{ required: true, message: $t('page.ops.placeholderCycleInterval') }]"
              >
                <InputNumber
                  v-model:value="formState.cycle_interval"
                  :placeholder="$t('page.ops.placeholderCycleInterval')"
                  :min="1"
                  class="w-full"
                  style="width: 100%"
                />
              </FormItem>

              <!-- Số lần lặp -->
              <FormItem
                v-if="formState.cycle_type"
                :label="$t('page.ops.colOccurrences')"
                name="occurrences"
                :rules="[{ required: true, message: $t('page.ops.validationOccurrences') }]"
              >
                <InputNumber
                  v-model:value="formState.occurrences"
                  :placeholder="$t('page.ops.placeholderOccurrences')"
                  :min="1"
                  :max="100"
                  class="w-full"
                  style="width: 100%"
                />
              </FormItem>
            </div>

            <!-- Ghi chú – full width -->
            <FormItem :label="$t('page.ops.colNotes')" name="notes">
              <Input.TextArea
                v-model:value="formState.notes"
                :placeholder="$t('page.ops.placeholderPlanNotes')"
                :rows="3"
              />
            </FormItem>
          </Card>

          <!-- ── Card 2 (Tách riêng div/card tách biệt ở trên): Applied Maintenance Items ── -->
          <Card
            v-if="formState.cycle_type"
            :title="$t('page.ops.appliedItemsTitle')"
            class="!mt-6 rounded-xl shadow-sm"
            style="margin-top: 24px !important;"
          >
            <div class="space-y-4">
              <!-- Danh sách items hiện có (UI design pattern cũ) -->
              <div class="max-h-[340px] divide-y divide-border overflow-y-auto pr-1">
                <div
                  v-for="(item, index) in categoryItems"
                  :key="item.id"
                  class="flex flex-wrap items-end gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span class="mb-1 w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {{ index + 1 }}
                  </span>
                  <div class="flex-1 min-w-[180px]">
                    <span class="text-xs text-gray-400 block mb-1">{{ $t('page.ops.colItemName') }}</span>
                    <Input
                      v-model:value="item.name"
                      :placeholder="$t('page.ops.placeholderItemName')"
                      @press-enter="updateCategoryItem(item)"
                    />
                  </div>
                  <div class="flex-1 min-w-[180px]">
                    <span class="text-xs text-gray-400 block mb-1">{{ $t('page.ops.colItemDesc') }}</span>
                    <Input
                      :value="item.description ?? ''"
                      @update:value="(val) => item.description = val || null"
                      :placeholder="$t('page.ops.placeholderItemDesc')"
                      @press-enter="updateCategoryItem(item)"
                    />
                  </div>
                  <div class="flex-1 min-w-[200px]">
                    <span class="text-xs text-gray-400 block mb-1">{{ $t('page.ops.colAssignedUsers') }}</span>
                    <Select
                      :value="item.user_ids"
                      @update:value="(val: any) => { item.user_ids = val; setItemUserIds(item.id, val); }"
                      :options="userOptions"
                      :placeholder="$t('page.ops.placeholderAssignedUsers')"
                      mode="multiple"
                      option-filter-prop="label"
                      show-search
                      allow-clear
                      class="w-full"
                    />
                  </div>
                  <div class="flex gap-2 pb-0">
                    <Button
                      type="default"
                      :loading="updatingItems[item.id]"
                      :disabled="!item.name.trim()"
                      @click="updateCategoryItem(item)"
                    >
                      {{ $t('page.ops.btnUpdate') }}
                    </Button>
                    <Popconfirm
                      :title="$t('page.ops.deleteMaintenanceItemConfirm')"
                      :ok-text="$t('page.ops.btnDelete')"
                      :cancel-text="$t('page.ops.btnCancel')"
                      @confirm="deleteCategoryItem(item.id)"
                    >
                      <Button
                        danger
                        :loading="deletingItems[item.id]"
                      >
                        {{ $t('page.ops.btnDelete') }}
                      </Button>
                    </Popconfirm>
                  </div>
                </div>

                <!-- Empty state (khi chưa có item nào) -->
                <div v-if="categoryItems.length === 0" class="px-4 py-6 text-center text-gray-400 text-sm italic">
                  {{ $t('page.ops.noItems') }}
                </div>
              </div>

              <Button
                type="dashed"
                block
                class="mt-3"
                :disabled="!formState.maintenance_category_id"
                @click="showAddItemModal"
              >
                + {{ $t('page.ops.btnAddShort') }}
              </Button>
            </div>
          </Card>

          <!-- ── Card 2 (Không dùng chu kỳ - Lịch trình thủ công) ────────────────── -->
          <Card
            v-else
            :title="$t('page.ops.schedulesTitle')"
            class="!mt-6 rounded-xl shadow-sm"
            style="margin-top: 24px !important;"
          >
            <div v-if="formState.schedules.length === 0" class="text-center text-gray-400 py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              {{ $t('page.ops.noSchedules') }}
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(schedule, idx) in formState.schedules"
                :key="schedule._key"
                class="flex flex-wrap md:flex-nowrap gap-2 items-end bg-gray-50/50 p-3 rounded-lg border border-border"
              >
                <!-- Hạng mục bảo trì -->
                <div class="flex-1 min-w-[200px]">
                  <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colMaintenanceItem') }}</span>
                  <Select
                    v-model:value="schedule.maintenance_item_id"
                    :options="maintenanceItemOptions"
                    :placeholder="$t('page.ops.placeholderMaintenanceItem')"
                    show-search
                    option-filter-prop="label"
                    allow-clear
                    class="w-full"
                  />
                </div>

                <!-- Ngày thực hiện -->
                <div class="w-[160px]">
                  <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colScheduleDate') }}</span>
                  <DatePicker
                    v-model:value="schedule.date"
                    value-format="YYYY-MM-DD"
                    format="YYYY-MM-DD"
                    :placeholder="$t('page.ops.placeholderScheduleDate')"
                    class="w-full"
                  />
                </div>

                <!-- Người thực hiện -->
                <div class="flex-1 min-w-[200px]">
                  <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colAssignedUsers') }}</span>
                  <Select
                    v-model:value="schedule.user_ids"
                    :options="userOptions"
                    :placeholder="$t('page.ops.placeholderAssignedUsers')"
                    mode="multiple"
                    option-filter-prop="label"
                    show-search
                    allow-clear
                    class="w-full"
                  />
                </div>

                <!-- Nút Xóa -->
                <div class="pb-1">
                  <Button
                    type="text"
                    danger
                    @click="removeScheduleRow(idx)"
                  >
                    {{ $t('page.ops.btnDelete') }}
                  </Button>
                </div>
              </div>
            </div>

            <Button
              type="dashed"
              block
              class="mt-4"
              :disabled="!formState.maintenance_category_id"
              @click="addScheduleRow"
            >
              + {{ $t('page.ops.btnAddSchedule') }}
            </Button>
          </Card>
        </div>

        <!-- ── Calendar View ────────────────────────────────────────────────── -->
        <Card
          v-show="activeView === 'calendar'"
          class="rounded-xl shadow-sm"
        >
          <VisualMaintenanceCalendar
            v-model:schedules="formState.schedules"
            :maintenance-items="maintenanceItems"
            :categories="categories"
            :user-options="userOptions"
            :equipment-id="formState.equipment_id"
          />
        </Card>

        <!-- Modal Thêm Hạng Mục Bảo Trì -->
        <AddMaintenanceItemModal
          v-model:open="isAddItemModalOpen"
          :category-id="formState.maintenance_category_id"
          :user-options="userOptions"
          @success="handleAddItemSuccess"
        />
      </Form>
    </Spin>
  </div>
</template>

<style scoped>
:deep(.ant-card + .ant-card) {
  margin-top: 24px !important;
}
</style>
