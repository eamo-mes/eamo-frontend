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
  Select,
  Form,
  FormItem,
  Popconfirm,
  message,
  Spin,
  Card,
  Tag
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore, useUserStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { listUsersApi } from '#/api/core/users';

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
}

interface ChecklistDetailItem {
  id?: string;
  checklist_id: string;
  description: string;
  result: 'pass' | 'fail';
}

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const loading = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);

const equipments = ref<EquipmentOption[]>([]);
const users = ref<any[]>([]);

const formState = ref({
  id: '',
  name: '',
  equipment_id: undefined as string | undefined,
  user_ids: [] as string[],
  session_date: '',
  status: 'Pending',
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
    users.value = await listUsersApi({ per_page: 1000 });
  } catch (err: any) {
    console.error('loadUsers error:', err);
    message.error('Không thể tải danh sách người dùng: ' + (err?.response?.data?.message || err.message));
  }
}

async function loadChecklistDetail(id: string) {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions/${id}?include_details=true`, {
      headers: getAuthHeaders(),
    });
    const record = res.data?.data ?? res.data;
    if (record) {
      formState.value = {
        id: record.id,
        name: record.name || '',
        equipment_id: record.equipment_id || undefined,
        user_ids: record.users?.map((u: any) => u.id) || [],
        session_date: record.session_date ? record.session_date.substring(0, 16).replace('T', ' ') : '',
        status: record.status || 'Pending',
        checklist_details: record.details?.map((detail: any) => ({
          id: detail.id,
          checklist_id: detail.checklist_id,
          description: detail.description || '',
          result: detail.result || 'pass',
        })) || [],
      };

      sortChecklistDetails();

      // Calculate status dynamically if not present on model
      if (!record.status && record.details) {
        if (record.details.length === 0) {
          formState.value.status = 'Pending';
        } else {
          const hasFail = record.details.some((d: any) => d.result === 'fail');
          formState.value.status = hasFail ? 'Failed' : 'Passed';
        }
      }
    }
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải chi tiết phiên checklist');
    goBack();
  } finally {
    loading.value = false;
  }
}

function sortChecklistDetails() {
  formState.value.checklist_details.sort((a, b) => {
    if (a.result === 'fail' && b.result !== 'fail') return -1;
    if (a.result !== 'fail' && b.result === 'fail') return 1;
    return 0;
  });
}

function addDetailRow() {
  formState.value.checklist_details.push({
    checklist_id: generateUUID(),
    description: '',
    result: 'pass',
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
      message.error(err?.response?.data?.message || 'Không thể xóa hạng mục khỏi máy chủ');
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
}));

async function handleSubmit() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    if (isEditing.value && editId.value) {
      // 1. Update checklist session properties
      const sessionPayload = {
        name: formState.value.name,
        equipment_id: formState.value.equipment_id,
        session_date: formState.value.session_date,
        user_ids: formState.value.user_ids,
      };
      await axios.put(`${API_BASE_URL}/v1/checklist-sessions/${editId.value}`, sessionPayload, {
        headers: getAuthHeaders(),
      });

      // 2. Update checklist details (items check results)
      const detailsPayload = {
        session_id: editId.value,
        checklists: formState.value.checklist_details.map(item => ({
          checklist_id: item.checklist_id,
          result: item.result,
          description: item.description,
        })),
      };
      await axios.put(`${API_BASE_URL}/v1/checklist-details`, detailsPayload, {
        headers: getAuthHeaders(),
      });

      message.success('Cập nhật phiên kiểm tra thành công');
    } else {
      // Create session
      const createPayload = {
        name: formState.value.name,
        equipment_id: formState.value.equipment_id,
        session_date: formState.value.session_date,
        user_ids: formState.value.user_ids,
        details: formState.value.checklist_details.map(item => ({
          checklist_id: item.checklist_id,
          result: item.result,
          description: item.description,
        })),
      };
      const res = await axios.post(`${API_BASE_URL}/v1/checklist-sessions`, createPayload, {
        headers: getAuthHeaders(),
      });
      message.success('Thêm mới phiên kiểm tra thành công');
      const created = res.data?.data ?? res.data;
      if (created?.id) {
        router.replace({ name: 'OpsCheckListDetail', query: { id: created.id } });
      }
    }
  } catch (err: any) {
    if (err?.errorFields) {
      // Form validation failed
    } else {
      const msg = err?.response?.data?.message || 'Không thể lưu phiên kiểm tra';
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  router.push({ name: 'OpsCheckList' });
}

onMounted(() => {
  loadEquipments();
  loadUsers();

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
    formState.value.session_date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    formState.value.user_ids = userStore.userInfo?.userId ? [userStore.userInfo.userId] : [];
  }
});
</script>

<template>
  <div class="p-6 space-y-6 w-full">
    <!-- Breadcrumb -->
    <Breadcrumb
      :items="[
        { title: $t('page.ops.title') },
        { title: $t('page.ops.checklist'), href: '/ops/checklist' },
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
        <Button type="default" @click="goBack" :disabled="submitting">
          {{ $t('page.ops.btnCancel') }}
        </Button>
        <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" :loading="submitting" @click="handleSubmit">
          {{ $t('page.ops.btnSave') }}
        </Button>
      </div>
    </div>

    <!-- Content Form Card -->
    <Card class="shadow-sm border-border rounded-xl">
      <Spin :spinning="loading || submitting">
        <Form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
        >
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

            <FormItem :label="$t('page.ops.colDate')" name="session_date" class="col-span-1">
              <DatePicker
                v-model:value="formState.session_date"
                show-time
                value-format="YYYY-MM-DD HH:mm"
                format="YYYY-MM-DD HH:mm"
                class="w-full"
                :placeholder="$t('page.ops.placeholderDate')"
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


            <FormItem v-if="isEditing" :label="$t('page.ops.colStatus')" name="status" class="col-span-1">
              <div class="pt-1">
                <Tag :color="formState.status === 'Passed' ? 'green' : formState.status === 'Failed' ? 'red' : 'blue'">
                  {{ formState.status }}
                </Tag>
              </div>
            </FormItem>

            <!-- Checklist Details Dynamic Rows -->
            <div class="col-span-2 border-t border-gray-150 pt-4 mt-2">
              <div class="flex items-center justify-between mb-3">
                <span class="font-semibold text-gray-700">{{ $t('page.ops.detailItemsHeader') }}</span>
                <Button type="dashed" size="small" @click="addDetailRow">
                  {{ $t('page.ops.btnAddCheck') }}
                </Button>
              </div>

              <div v-if="formState.checklist_details.length === 0" class="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                {{ $t('page.ops.noDetailItems') }}
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="(item, index) in formState.checklist_details"
                  :key="item.checklist_id"
                  class="flex flex-wrap md:flex-nowrap gap-2 items-center p-3 rounded-lg border transition-all duration-200"
                  :class="item.result === 'fail' ? 'bg-red-50/60 border-red-200' : 'bg-gray-50/50 border-gray-100'"
                >
                  <div class="flex-1 min-w-[200px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.itemName') }}</span>
                    <Input v-model:value="item.description" :placeholder="$t('page.ops.itemNamePlaceholder')" />
                  </div>

                  <div class="w-[180px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colStatus') }}</span>
                    <Select v-model:value="item.result" class="w-full" @change="sortChecklistDetails">
                      <Select.Option value="pass">Pass (Đạt)</Select.Option>
                      <Select.Option value="fail">Fail (Lỗi)</Select.Option>
                    </Select>
                  </div>

                  <div class="flex flex-col">
                    <span class="text-xs block mb-1 select-none opacity-0 pointer-events-none">&nbsp;</span>
                    <Popconfirm
                      :title="$t('page.ops.deleteItemConfirm')"
                      :ok-text="$t('page.ops.btnConfirm')"
                      :cancel-text="$t('page.ops.btnCancel')"
                      @confirm="removeDetailRow(index)"
                    >
                      <Button type="text" danger class="h-[32px] flex items-center justify-center">
                        {{ $t('page.ops.btnDelete') }}
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Form>
      </Spin>
    </Card>
  </div>
</template>
