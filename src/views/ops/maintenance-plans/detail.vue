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
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { listUsersApi, type UserItem } from '#/api/core/users';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface EquipmentOption {
  id: string;
  code: string;
  name: string | null;
}

interface MaintenanceItemOption {
  id: string;
  name: string;
  description: string | null;
  maintenance_category_id: string;
  user_ids: string[];
}

interface MaintenanceCategoryOption {
  id: string;
  name: string;
}

interface ScheduleUser {
  id: string;
  name: string;
}

interface ScheduleRow {
  id?: string;
  maintenance_item_id: string;
  date: string;
  user_ids: string[];
  users?: ScheduleUser[];
  _key: string;
  equipment_id?: string;
  maintenance_plan_id?: string;
}

interface AxiosErrorResponse {
  response?: { data?: { message?: string } };
}

// ─── State ───────────────────────────────────────────────────────────────────

const route = useRoute();
const router = useRouter();

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

// ─── Auth ────────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

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

  // If there's an existing custom value loaded from API, add it to the list
  if (currentVal && !defaults.some(d => d.value === currentVal)) {
    list.push({ label: currentVal, value: currentVal });
  }

  // If user is currently typing something new, show the typed value as an option
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
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? (raw as EquipmentOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadMaintenanceItems(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-items`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    maintenanceItems.value = Array.isArray(raw)
      ? (raw as any[]).map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          maintenance_category_id: item.maintenance_category_id,
          user_ids: (item.users ?? []).map((u: any) => u.id),
        }))
      : [];
  } catch {
    // silently fail
  }
}

async function loadCategories(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-categories`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? (raw as MaintenanceCategoryOption[]) : [];
  } catch {
    // silently fail
  }
}

function handleCategoryChange(): void {
  // Clear any scheduled maintenance item that doesn't belong to the newly selected category
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

function setFormStateFromRecord(record: any): void {
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
          .filter((s: any) => s.maintenance_item_id)
          .map((s: {
            id: string;
            maintenance_item_id: string;
            date: string;
            users?: ScheduleUser[];
            maintenance_logs?: any[];
            equipment_id?: string;
            maintenance_plan_id?: string;
          }) => ({
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
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-plans/${id}`, {
      headers: getAuthHeaders(),
    });
    const record = res.data?.data ?? res.data;
    if (record) {
      setFormStateFromRecord(record);
    }
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
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
    date: formState.value.date || new Date().toISOString().split('T')[0],
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

    // Schedules lẻ mới (không có id) khi có cycle_type phải gọi API riêng
    const newAdhocSchedules = formState.value.cycle_type
      ? formState.value.schedules.filter(s => !!s.maintenance_item_id && !s.id)
      : [];

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
      schedules: formState.value.schedules
        .filter(s => !!s.maintenance_item_id)
        .map(s => ({
          id: s.id,
          maintenance_item_id: s.maintenance_item_id,
          date: s.date,
          user_ids: s.user_ids,
        })),
    };

    if (isEditing.value && editId.value) {
      await axios.put(`${API_BASE_URL}/v1/maintenance-plans/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });

      // Gọi individual-schedules API cho từng lịch lẻ mới khi có cycle_type
      if (newAdhocSchedules.length > 0) {
        await Promise.all(
          newAdhocSchedules.map(s =>
            axios.post(
              `${API_BASE_URL}/v1/maintenance-plans/${editId.value}/individual-schedules`,
              { maintenance_item_id: s.maintenance_item_id || null, date: s.date, user_ids: s.user_ids, is_adhoc: true },
              { headers: getAuthHeaders() }
            )
          )
        );
      }

      message.success($t('page.ops.planSaveSuccess'));
      // Reload để lấy toàn bộ schedules cập nhật từ server
      await loadPlanDetail(editId.value);
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/maintenance-plans`, payload, {
        headers: getAuthHeaders(),
      });
      const created = res.data?.data ?? res.data;
      if (created) {
        setFormStateFromRecord(created);
        if (created.id) {
          router.replace({ name: 'OpsMaintenancePlanDetail', query: { id: created.id } });

          // Gọi individual-schedules sau khi tạo mới nếu có
          if (newAdhocSchedules.length > 0) {
            await Promise.all(
              newAdhocSchedules.map(s =>
                axios.post(
                  `${API_BASE_URL}/v1/maintenance-plans/${created.id}/individual-schedules`,
                  { maintenance_item_id: s.maintenance_item_id || null, date: s.date, user_ids: s.user_ids, is_adhoc: true },
                  { headers: getAuthHeaders() }
                )
              )
            );
            await loadPlanDetail(created.id);
          }
        }
      }
      message.success($t('page.ops.planSaveSuccess'));
    }
  } catch (err: unknown) {
    const axiosErr = err as AxiosErrorResponse;
    const apiError = axiosErr?.response?.data?.message;
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
    await axios.put(
      `${API_BASE_URL}/v1/maintenance-items/${item.id}`,
      {
        name,
        description: item.description?.trim() || null,
        maintenance_category_id: item.maintenance_category_id,
        user_ids: item.user_ids,
      },
      { headers: getAuthHeaders() },
    );
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
    await axios.delete(
      `${API_BASE_URL}/v1/maintenance-items/${id}`,
      { headers: getAuthHeaders() },
    );
    // Remove from local list
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
        <h1 class="text-xl font-bold text-gray-800 m-0">
          {{ isEditing ? $t('page.ops.editPlan') : $t('page.ops.addNewPlan') }}
        </h1>
      </div>
      <div class="flex gap-2">
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
        <!-- ── Plan Info Card ─────────────────────────────────────────── -->
        <Card :title="$t('page.ops.planInfoTitle')" class="rounded-xl shadow-sm mb-6">
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

            <!-- Ngày thực hiện -->
            <FormItem :label="$t('page.ops.colScheduleDate')" name="date">
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

          <!-- ── Maintenance Schedules Section (Nested) ───────────────────── -->
          <div class="border-t border-gray-150 pt-5 mt-5">
            <div v-if="formState.cycle_type" class="space-y-4">
              <!-- Biểu diễn các items tương ứng thuộc Category đã chọn (không có trường date) -->
              <div class="border border-border rounded-lg overflow-hidden bg-gray-50/10">
                <div class="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 flex items-center justify-between border-b border-border">
                  <span class="font-semibold text-gray-700 dark:text-gray-300">
                    {{ $t('page.ops.appliedItemsTitle') }}
                  </span>
                  <Button
                    type="link"
                    size="small"
                    class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold p-0 flex items-center gap-1"
                    :disabled="!formState.maintenance_category_id"
                    @click="showAddItemModal"
                  >
                    + {{ $t('page.ops.btnAddShort') }}
                  </Button>
                </div>

                <!-- Danh sách items hiện có -->
                <div class="divide-y divide-border">
                  <div
                    v-for="item in categoryItems"
                    :key="item.id"
                    class="px-4 py-3 flex flex-wrap md:flex-nowrap gap-2 items-end hover:bg-gray-50/50 transition-colors"
                  >
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
              </div>

              <!-- ── Lịch trình lẻ thêm thủ công (song song với chu kỳ tự động) ── -->
              <div class="mt-4 border border-border rounded-lg overflow-hidden bg-gray-50/10">
                <div class="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 flex items-center justify-between border-b border-border">
                  <span class="font-semibold text-gray-700 dark:text-gray-300">
                    {{ $t('page.ops.schedulesTitle') }}
                  </span>
                  <Button
                    type="link"
                    size="small"
                    class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold p-0 flex items-center gap-1"
                    @click="addScheduleRow"
                  >
                    + {{ $t('page.ops.btnAddShort') }}
                  </Button>
                </div>

                <div class="divide-y divide-border">
                  <!-- Danh sách lịch trình lẻ -->
                  <div
                    v-for="(schedule, idx) in formState.schedules"
                    :key="schedule._key"
                    class="px-4 py-3 flex flex-wrap md:flex-nowrap gap-2 items-end hover:bg-gray-50/50 transition-colors"
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
                      <Button type="text" danger @click="removeScheduleRow(idx)">
                        {{ $t('page.company.btnDelete') }}
                      </Button>
                    </div>
                  </div>

                  <!-- Empty state -->
                  <div v-if="formState.schedules.length === 0" class="px-4 py-6 text-center text-gray-400 text-sm italic">
                    {{ $t('page.ops.noSchedules') }}
                  </div>
                </div>
              </div>
            </div>

            <div v-else>
              <div class="flex items-center justify-between mb-3">
                <span class="font-semibold text-gray-700">{{ $t('page.ops.schedulesTitle') }}</span>
                <Button
                  type="link"
                  size="small"
                  class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold p-0 flex items-center gap-1"
                  @click="addScheduleRow"
                >
                  + {{ $t('page.ops.btnAddShort') }}
                </Button>
              </div>

              <!-- Schedule list -->
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
                      {{ $t('page.company.btnDelete') }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Calendar View Section (Inside Card) ────────────────────────── -->
          <div class="border-t border-gray-150 pt-5 mt-5">
            <VisualMaintenanceCalendar
              v-model:schedules="formState.schedules"
              :maintenance-items="maintenanceItems"
              :categories="categories"
              :user-options="userOptions"
              :equipment-id="formState.equipment_id"
            />
          </div>
        </Card>

        <!-- Modal Thêm Hạng Mục Bảo Trì (Component) -->
        <AddMaintenanceItemModal
          v-model:open="isAddItemModalOpen"
          :category-id="formState.maintenance_category_id"
          :user-options="userOptions"
          :api-base-url="API_BASE_URL"
          :auth-headers="getAuthHeaders()"
          @success="handleAddItemSuccess"
        />
      </Form>
    </Spin>
  </div>
</template>
