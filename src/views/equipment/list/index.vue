<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { $t } from '#/locales';
import {
  Button,
  Table,
  Input,
  Select,
  Switch,
  Modal,
  Form,
  FormItem,
  Popconfirm,
  Tag,
  message,
  Spin,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

interface CategoryOption {
  id: string;
  name: string;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category_id: string | null;
  equipment_category?: CategoryOption | null;
  is_active: boolean;
  equipment_errors?: ErrorOption[];
}

const loading = ref(false);
const submitting = ref(false);
const equipments = ref<EquipmentItem[]>([]);
const categories = ref<CategoryOption[]>([]);
const errorsList = ref<ErrorOption[]>([]);
const searchVal = ref('');
const activeSearch = ref('');

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadCategories() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-categories`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadErrors() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    errorsList.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadEquipments() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải danh sách thiết bị');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  activeSearch.value = searchVal.value;
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
}

const filteredEquipments = computed(() => {
  const q = activeSearch.value.toLowerCase();
  if (!q) return equipments.value;
  return equipments.value.filter(e =>
    e.code.toLowerCase().includes(q) ||
    (e.name && e.name.toLowerCase().includes(q))
  );
});

const columns = computed(() => [
  {
    title: $t('page.equipment.colCode'),
    dataIndex: 'code',
    key: 'code',
    sorter: (a: EquipmentItem, b: EquipmentItem) => a.code.localeCompare(b.code),
  },
  {
    title: $t('page.equipment.colName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: EquipmentItem, b: EquipmentItem) => (a.name || '').localeCompare(b.name || ''),
  },
  {
    title: $t('page.equipment.colCategory'),
    dataIndex: 'equipment_category',
    key: 'equipment_category',
  },
  {
    title: $t('page.equipment.colActive'),
    dataIndex: 'is_active',
    key: 'is_active',
  },
  {
    title: $t('page.equipment.colErrors'),
    dataIndex: 'equipment_errors',
    key: 'equipment_errors',
  },
  {
    title: $t('page.equipment.colActions'),
    key: 'actions',
    width: 160,
    align: 'right' as const,
  },
]);

// Modal & Form State
const showModal = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);

const formRef = ref();
const formState = ref({
  code: '',
  name: '',
  equipment_category_id: undefined as string | undefined,
  is_active: true,
  equipment_error_ids: [] as string[],
});

const rules = computed(() => ({
  code: [{ required: true, message: $t('page.equipment.validationCode') }],
  name: [{ required: true, message: $t('page.equipment.validationName') }],
}));

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    code: '',
    name: '',
    equipment_category_id: undefined,
    is_active: true,
    equipment_error_ids: [],
  };
  showModal.value = true;
}

function openEditModal(record: EquipmentItem) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    code: record.code,
    name: record.name || '',
    equipment_category_id: record.equipment_category_id || undefined,
    is_active: record.is_active,
    equipment_error_ids: record.equipment_errors?.map(err => err.id) || [],
  };
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/equipment/${id}`, {
      headers: getAuthHeaders(),
    });
    equipments.value = equipments.value.filter(e => e.id !== id);
    message.success('Xóa thiết bị thành công');
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể xóa thiết bị');
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      code: formState.value.code,
      name: formState.value.name,
      equipment_category_id: formState.value.equipment_category_id || null,
      is_active: formState.value.is_active,
      equipment_error_ids: formState.value.equipment_error_ids,
    };

    if (isEditing.value && editId.value) {
      const res = await axios.put(`${API_BASE_URL}/v1/equipment/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
      const updated = res.data;
      const idx = equipments.value.findIndex(e => e.id === editId.value);
      if (idx !== -1) equipments.value[idx] = updated;
      message.success('Cập nhật thiết bị thành công');
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/equipment`, payload, {
        headers: getAuthHeaders(),
      });
      const created = res.data;
      equipments.value.push(created);
      message.success('Thêm thiết bị thành công');
    }
    showModal.value = false;
  } catch (err: any) {
    if (err?.errorFields) {
      // Form validation failed
    } else {
      const msg = err?.response?.data?.message || 'Không thể lưu thiết bị';
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadEquipments();
  loadCategories();
  loadErrors();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.equipment.placeholderName')"
        class="max-w-[280px]"
        allow-clear
        @press-enter="handleSearch"
      />
      <Button type="default" @click="handleSearch">
        {{ $t('page.company.btnFilter') }}
      </Button>
      <Button type="default" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>
      <div class="ml-auto">
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full"
          @click="openAddModal"
        >
          {{ $t('page.equipment.btnAddEquipment') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredEquipments"
          row-key="id"
          :pagination="{ pageSize: 10 }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'equipment_category'">
              <span>{{ record.equipment_category?.name || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'is_active'">
              <Tag :color="record.is_active ? 'success' : 'default'">
                {{ record.is_active ? 'Hoạt động' : 'Tạm dừng' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'equipment_errors'">
              <div class="flex flex-wrap gap-1">
                <Tag v-for="err in record.equipment_errors" :key="err.id" color="red">
                  {{ err.name }}
                </Tag>
                <span v-if="!record.equipment_errors || record.equipment_errors.length === 0" class="text-gray-400">—</span>
              </div>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as EquipmentItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  ok-text="Yes"
                  cancel-text="No"
                  @confirm="handleDelete(record.id)"
                >
                  <Button
                    size="small"
                    danger
                    class="rounded bg-red-50/50 hover:bg-red-500 hover:text-white border-red-200"
                  >
                    {{ $t('page.company.btnDelete') }}
                  </Button>
                </Popconfirm>
              </div>
            </template>
          </template>
        </Table>
      </Spin>
    </div>

    <!-- Add/Edit Modal -->
    <Modal
      v-model:open="showModal"
      :title="isEditing ? $t('page.equipment.btnEditEquipment') : $t('page.equipment.btnAddEquipment')"
      :confirm-loading="submitting"
      ok-text="Xác nhận"
      cancel-text="Hủy"
      width="580px"
      @ok="handleOk"
      @cancel="showModal = false"
    >
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem :label="$t('page.equipment.colCode')" name="code" class="col-span-1">
            <Input v-model:value="formState.code" :placeholder="$t('page.equipment.placeholderCode')" :disabled="isEditing" />
          </FormItem>
          <FormItem :label="$t('page.equipment.colName')" name="name" class="col-span-1">
            <Input v-model:value="formState.name" :placeholder="$t('page.equipment.placeholderName')" />
          </FormItem>
          <FormItem :label="$t('page.equipment.colCategory')" name="equipment_category_id" class="col-span-2">
            <Select
              v-model:value="formState.equipment_category_id"
              :placeholder="$t('page.equipment.placeholderCategory')"
              allow-clear
            >
              <Select.Option v-for="c in categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </Select.Option>
            </Select>
          </FormItem>
          <FormItem :label="$t('page.equipment.colActive')" name="is_active" class="col-span-1">
            <Switch v-model:checked="formState.is_active" />
          </FormItem>
          <FormItem :label="$t('page.equipment.colErrors')" name="equipment_error_ids" class="col-span-2">
            <Select
              v-model:value="formState.equipment_error_ids"
              mode="multiple"
              option-filter-prop="label"
              :placeholder="$t('page.equipment.placeholderErrors')"
              allow-clear
            >
              <Select.Option v-for="err in errorsList" :key="err.id" :value="err.id" :label="err.name">
                {{ err.name }}
              </Select.Option>
            </Select>
          </FormItem>
        </div>
      </Form>
    </Modal>
  </div>
</template>
