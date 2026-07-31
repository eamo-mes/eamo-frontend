<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeft } from '@vben/icons';
import { $t } from '#/locales';
import {
  Breadcrumb,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Form,
  FormItem,
  Popconfirm,
  message,
  Spin,
  Card,
  Empty
} from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAccessStore, useUserStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { listUsersApi } from '#/api/core/users';
import ChecklistCalendar from '../../dashboard/workspace/components/ChecklistCalendar.vue';

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ChecklistDetailItem {
  id?: string;
  checklist_id: string;
  description: string;
}

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const loading = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);
const showCalendar = ref(false);

const equipments = ref<EquipmentOption[]>([]);
const users = ref<UserOption[]>([]);

const formState = ref({
  id: '',
  name: '',
  schedule_mode: 'repeating' as 'repeating' | 'single',
  equipment_id: undefined as string | undefined,
  user_ids: [] as string[],
  session_date: '',
  cycle_type: 'daily' as 'daily' | 'weekly' | 'monthly' | 'yearly',
  cycle_interval: 1,
  checklist_details: [] as ChecklistDetailItem[],
});

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function normalizeDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

async function loadEquipments() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadUsers() {
  try {
    const res = await listUsersApi({ per_page: 1000 });
    users.value = Array.isArray(res) ? res : [];
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } }; message?: string };
    console.error('loadUsers error:', err);
    message.error('Không thể tải danh sách người dùng: ' + (error?.response?.data?.message || error?.message || ''));
  }
}

async function loadChecklistDetail(id: string) {
  loading.value = true;
  try {
    let url = `${API_BASE_URL}/v1/checklist-sessions/${id}?include_details=true`;
    const res = await axios.get(url, {
      headers: getAuthHeaders(),
    });
    const record = res.data?.data ?? res.data;
    if (record) {
      const isSingle = record.schedule_mode === 'single' || (record.cycle_type === 'daily' && record.cycle_interval === 1 && !record.occurrences);
      formState.value = {
        id: record.id,
        name: record.name || '',
        schedule_mode: isSingle ? 'single' : (record.schedule_mode || 'repeating'),
        equipment_id: record.equipment_id || undefined,
        user_ids: record.users?.map((u: { id: string }) => u.id) || [],
        session_date: normalizeDateTime(record.session_date),
        cycle_type: record.cycle_type || 'daily',
        cycle_interval: record.cycle_interval || 1,
        checklist_details: record.details?.map((detail: { id?: string; checklist_id: string; description?: string }) => ({
            id: detail.id,
            checklist_id: detail.checklist_id,
            description: detail.description || '',
          })) || [],
      };
    }
  } catch (err: any) {
    message.error(err?.response?.data?.message || $t('page.ops.loadChecklistDetailError'));
    goBack();
  } finally {
    loading.value = false;
  }
}

function addDetailRow() {
  formState.value.checklist_details.push({
    checklist_id: crypto.randomUUID(),
    description: '',
  });
}

async function removeDetailRow(index: number) {
  const item = formState.value.checklist_details[index];
  if (item && item.id) {
    try {
      loading.value = true;
      await axios.delete(`${API_BASE_URL}/v1/checklist-details/${item.id}`, {
        headers: getAuthHeaders(),
      });
      message.success('Xóa hạng mục thành công khỏi máy chủ');
    } catch (err: any) {
      message.error(err?.response?.data?.message || $t('page.ops.deleteChecklistItemError'));
      return;
    } finally {
      loading.value = false;
    }
  }
  formState.value.checklist_details.splice(index, 1);
}

const formRef = ref();

const rules = computed(() => ({
  name: [{ required: true, message: $t('page.ops.validationName') }],
  equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
  session_date: [{ required: true, message: $t('page.ops.validationDate') }],
  cycle_interval: [{ required: formState.value.schedule_mode === 'repeating', type: 'number' as const, min: 1, message: 'Vui lòng nhập khoảng chu kỳ lặp hợp lệ' }],
}));

async function handleSubmit() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const isSingleMode = formState.value.schedule_mode === 'single';
    const effectiveCycleType = isSingleMode ? 'daily' : formState.value.cycle_type;
    const effectiveCycleInterval = isSingleMode ? 1 : formState.value.cycle_interval;

    if (isEditing.value && editId.value) {
      // 1. Update checklist session properties
      const sessionPayload = {
        name: formState.value.name,
        equipment_id: formState.value.equipment_id,
        session_date: formState.value.session_date,
        cycle_type: effectiveCycleType,
        cycle_interval: effectiveCycleInterval,
        schedule_mode: formState.value.schedule_mode,
        user_ids: formState.value.user_ids,
      };
      await axios.put(`${API_BASE_URL}/v1/checklist-sessions/${editId.value}`, sessionPayload, {
        headers: getAuthHeaders(),
      });

      await axios.put(`${API_BASE_URL}/v1/checklist-details`, {
        session_id: editId.value,
        date: formState.value.session_date,
        checklists: formState.value.checklist_details.map(item => ({
          checklist_id: item.checklist_id,
          description: item.description,
        })),
      }, {
        headers: getAuthHeaders(),
      });

      message.success('Cập nhật phiên kiểm tra thành công');
    } else {
      // Create session
      const createPayload = {
        name: formState.value.name,
        equipment_id: formState.value.equipment_id,
        session_date: formState.value.session_date,
        cycle_type: effectiveCycleType,
        cycle_interval: effectiveCycleInterval,
        schedule_mode: formState.value.schedule_mode,
        user_ids: formState.value.user_ids,
        details: formState.value.checklist_details.map(item => ({
          checklist_id: item.checklist_id,
          description: item.description,
        })),
      };
      const res = await axios.post(`${API_BASE_URL}/v1/checklist-sessions`, createPayload, {
        headers: getAuthHeaders(),
      });
      message.success('Thêm mới phiên kiểm tra thành công');
      const created = res.data?.data ?? res.data;
      if (created?.id) {
        router.replace({
          name: 'OpsCheckListDetail',
          query: {
            id: created.id,
            equipment_id: created.equipment_id,
            date: created.session_date,
          },
        });
      }
    }
  } catch (err: unknown) {
    const error = err as { errorFields?: unknown; response?: { data?: { message?: string } } };
    if (error?.errorFields) {
      // Form validation failed
    } else {
      const msg = error?.response?.data?.message || $t('page.ops.saveChecklistError');
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  router.push({ name: 'OpsCheckList' });
}

function handleCalendarRefresh() {
  if (editId.value && formState.value.equipment_id) {
    loadChecklistDetail(
      editId.value,
    );
  }
}

onMounted(() => {
  loadEquipments();
  loadUsers();

  if (route.query.equipment_id) {
    formState.value.equipment_id = route.query.equipment_id as string;
  }

  const id = route.query.id as string;
  if (id) {
    isEditing.value = true;
    editId.value = id;
    loadChecklistDetail(id);
  } else {
    isEditing.value = false;
    editId.value = null;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    formState.value.session_date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    formState.value.user_ids = userStore.userInfo?.userId ? [userStore.userInfo.userId] : [];
  }
});
</script>

<template>
  <div class="p-6 space-y-6 w-full">
    <!-- Breadcrumb -->
    <Breadcrumb
      :items="[
        { title: $t('page.ops.maintenanceTitle') },
        { title: $t('page.ops.checklist'), href: '/maintenance/checklist' },
        { title: isEditing ? $t('page.ops.checklistDetail') : $t('page.ops.detailTitleAdd') },
      ]"
    />

    <!-- Header -->
    <div class="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
      <div class="flex items-center gap-3">
        <Button class="flex items-center justify-center" @click="goBack">
          <ChevronLeft class="size-5" />
        </Button>
        <h1 class="text-xl font-bold text-gray-800 m-0">
          {{ isEditing ? $t('page.ops.checklistDetail') : $t('page.ops.detailTitleAdd') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <Button
          type="default"
          :disabled="submitting || !formState.equipment_id"
          @click="showCalendar = !showCalendar"
        >
          {{ showCalendar ? $t('page.ops.btnListView') : $t('page.ops.btnCalendarView') }}
        </Button>
        <Button type="default" @click="goBack" :disabled="submitting">
          {{ $t('page.ops.btnCancel') }}
        </Button>
        <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" :loading="submitting" @click="handleSubmit">
          {{ $t('page.ops.btnSave') }}
        </Button>
      </div>
    </div>

    <!-- Checklist Form and Calendar Body -->
    <div>
      <!-- List View: Main Information + Checklist Details Form -->
      <div v-show="!showCalendar">
        <Spin :spinning="loading || submitting">
          <Form
            ref="formRef"
            :model="formState"
            :rules="rules"
            layout="vertical"
            class="space-y-6"
          >
            <!-- Main Information Card -->
            <Card class="shadow-sm border-border rounded-xl">
              <div class="grid grid-cols-2 gap-x-4">
                <FormItem :label="$t('page.ops.colName')" name="name" class="col-span-2">
                  <Input v-model:value="formState.name" :placeholder="$t('page.ops.placeholderName')" />
                </FormItem>

                <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id" class="col-span-1">
                  <Select
                    v-model:value="formState.equipment_id"
                    :placeholder="$t('page.ops.placeholderEquipment')"
                    allow-clear
                  >
                    <Select.Option v-for="eq in equipments" :key="eq.id" :value="eq.id">
                      {{ eq.name }} ({{ eq.code }})
                    </Select.Option>
                  </Select>
                </FormItem>

                <FormItem :label="$t('page.ops.scheduleMode')" name="schedule_mode" class="col-span-1">
                  <Select v-model:value="formState.schedule_mode">
                    <Select.Option value="repeating">{{ $t('page.ops.modeRepeating') }}</Select.Option>
                    <Select.Option value="single">{{ $t('page.ops.modeSingle') }}</Select.Option>
                  </Select>
                </FormItem>

                <FormItem :label="$t('page.ops.colDate')" name="session_date" class="col-span-1">
                  <DatePicker
                    v-model:value="formState.session_date"
                    value-format="YYYY-MM-DD"
                    format="YYYY-MM-DD"
                    class="w-full"
                    :placeholder="$t('page.ops.placeholderDate')"
                  />
                </FormItem>

                <FormItem :label="$t('page.ops.colCycleType')" name="cycle_type" class="col-span-1">
                  <Select v-model:value="formState.cycle_type" :placeholder="$t('page.ops.placeholderCycleType')">
                    <Select.Option value="daily">{{ $t('page.ops.cycleDaily') }}</Select.Option>
                    <Select.Option value="weekly">{{ $t('page.ops.cycleWeekly') }}</Select.Option>
                    <Select.Option value="monthly">{{ $t('page.ops.cycleMonthly') }}</Select.Option>
                    <Select.Option value="yearly">{{ $t('page.ops.cycleYearly') }}</Select.Option>
                  </Select>
                </FormItem>

                <FormItem :label="$t('page.ops.colCycleInterval')" name="cycle_interval" class="col-span-1">
                  <InputNumber
                    v-model:value="formState.cycle_interval"
                    :min="1"
                    class="w-full !w-full"
                    style="width: 100%"
                    :placeholder="$t('page.ops.placeholderCycleInterval')"
                  />
                </FormItem>

                <FormItem :label="$t('page.ops.colExecutor')" name="user_ids" class="col-span-2">
                  <Select
                    v-model:value="formState.user_ids"
                    mode="multiple"
                    :placeholder="$t('page.ops.placeholderExecutor')"
                    allow-clear
                    option-filter-prop="label"
                  >
                    <Select.Option v-for="u in users" :key="u.id" :value="u.id" :label="u.name">
                      {{ u.name }} ({{ u.email }})
                    </Select.Option>
                  </Select>
                </FormItem>
              </div>
            </Card>

            <!-- Independent Checklist Details Dynamic Card -->
            <Card class="shadow-sm border-border rounded-xl mt-6">
              <div class="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div class="font-semibold text-gray-800 text-base">
                    {{ $t('page.ops.detailItemsHeader') }}
                  </div>
                </div>
              </div>

              <div class="py-2">
                <div v-if="formState.checklist_details.length === 0" class="py-6 flex justify-center">
                  <Empty :description="$t('page.ops.noDetailItems')" />
                </div>

                <div v-else class="max-h-[300px] overflow-y-auto divide-y divide-border pr-2 scrollbar-thin">
                  <div
                    v-for="(item, index) in formState.checklist_details"
                    :key="item.checklist_id"
                    class="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <Input
                      v-model:value="item.description"
                      class="flex-1"
                      :placeholder="$t('page.ops.itemNamePlaceholder')"
                    />
                    <Popconfirm
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

              <Button type="dashed" block class="mt-3" @click="addDetailRow">
                {{ $t('page.ops.btnAddCheck') }}
              </Button>
            </Card>
          </Form>
        </Spin>
      </div>

      <!-- Calendar View: Standard Checklist Calendar Card -->
      <div v-show="showCalendar">
        <Card class="shadow-sm border-border rounded-xl">
          <ChecklistCalendar
            v-if="formState.equipment_id"
            :equipment-id="formState.equipment_id"
            :equipments="equipments"
            @refresh-list="handleCalendarRefresh"
          />
          <div v-else class="py-10 flex justify-center">
            <Empty :description="$t('page.ops.selectEquipmentToViewCalendar') || 'Vui lòng chọn thiết bị để xem lịch checklist.'" />
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card gap spacing between cards */
:deep(.ant-card + .ant-card) {
  margin-top: 24px !important;
}
</style>
