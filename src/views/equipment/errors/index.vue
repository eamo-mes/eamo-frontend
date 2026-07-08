<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { $t } from '#/locales';
import {
  Button,
  Table,
  Input,
  Select,
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

interface EquipmentOption {
  id: string;
  name: string;
  code: string;
}

interface ErrorItem {
  id: string;
  name: string;
  reason?: string;
  fix?: string;
  protection_measures?: string;
  equipment?: EquipmentOption[];
}

const loading = ref(false);
const submitting = ref(false);
const errorsList = ref<ErrorItem[]>([]);
const equipments = ref<EquipmentOption[]>([]);
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

async function loadEquipments() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadErrors() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    errorsList.value = Array.isArray(raw) ? raw : [];
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải danh sách báo lỗi');
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

const filteredErrors = computed(() => {
  const q = activeSearch.value.toLowerCase();
  if (!q) return errorsList.value;
  return errorsList.value.filter(e =>
    e.name.toLowerCase().includes(q) ||
    (e.reason && e.reason.toLowerCase().includes(q))
  );
});

const columns = computed(() => [
  {
    title: $t('page.equipment.colName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: ErrorItem, b: ErrorItem) => a.name.localeCompare(b.name),
  },
  {
    title: $t('page.equipment.colReason'),
    dataIndex: 'reason',
    key: 'reason',
  },
  {
    title: $t('page.equipment.colFix'),
    dataIndex: 'fix',
    key: 'fix',
  },
  {
    title: $t('page.equipment.colProtection'),
    dataIndex: 'protection_measures',
    key: 'protection_measures',
  },
  {
    title: $t('page.equipment.colEquipment'),
    dataIndex: 'equipment',
    key: 'equipment',
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
  name: '',
  reason: '',
  fix: '',
  protection_measures: '',
  equipment_ids: [] as string[],
});

const rules = {
  name: [{ required: true, message: $t('page.equipment.validationName') }],
};

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    name: '',
    reason: '',
    fix: '',
    protection_measures: '',
    equipment_ids: [],
  };
  showModal.value = true;
}

function openEditModal(record: ErrorItem) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    name: record.name,
    reason: record.reason || '',
    fix: record.fix || '',
    protection_measures: record.protection_measures || '',
    equipment_ids: record.equipment?.map(eq => eq.id) || [],
  };
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/equipment-errors/${id}`, {
      headers: getAuthHeaders(),
    });
    errorsList.value = errorsList.value.filter(e => e.id !== id);
    message.success('Xóa báo lỗi thành công');
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể xóa báo lỗi');
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      name: formState.value.name,
      reason: formState.value.reason || null,
      fix: formState.value.fix || null,
      protection_measures: formState.value.protection_measures || null,
      equipment_ids: formState.value.equipment_ids,
    };

    if (isEditing.value && editId.value) {
      const res = await axios.put(`${API_BASE_URL}/v1/equipment-errors/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
      const updated = res.data;
      const idx = errorsList.value.findIndex(e => e.id === editId.value);
      if (idx !== -1) errorsList.value[idx] = updated;
      message.success('Cập nhật báo lỗi thành công');
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/equipment-errors`, payload, {
        headers: getAuthHeaders(),
      });
      const created = res.data;
      errorsList.value.push(created);
      message.success('Thêm báo lỗi thành công');
    }
    showModal.value = false;
  } catch (err: any) {
    if (err?.errorFields) {
      // Validation failed
    } else {
      const msg = err?.response?.data?.message || 'Không thể lưu báo lỗi';
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadErrors();
  loadEquipments();
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
          {{ $t('page.equipment.btnAddError') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredErrors"
          row-key="id"
          :pagination="{ pageSize: 10 }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'equipment'">
              <div class="flex flex-wrap gap-1">
                <Tag v-for="eq in record.equipment" :key="eq.id" color="blue">
                  {{ eq.name }} ({{ eq.code }})
                </Tag>
                <span v-if="!record.equipment || record.equipment.length === 0" class="text-gray-400">—</span>
              </div>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as ErrorItem)"
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
      :title="isEditing ? $t('page.equipment.btnEditError') : $t('page.equipment.btnAddError')"
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
        <FormItem :label="$t('page.equipment.colName')" name="name">
          <Input v-model:value="formState.name" :placeholder="$t('page.equipment.placeholderName')" />
        </FormItem>
        <FormItem :label="$t('page.equipment.colReason')" name="reason">
          <Input.TextArea v-model:value="formState.reason" :rows="2" :placeholder="$t('page.equipment.placeholderReason')" />
        </FormItem>
        <FormItem :label="$t('page.equipment.colFix')" name="fix">
          <Input.TextArea v-model:value="formState.fix" :rows="2" :placeholder="$t('page.equipment.placeholderFix')" />
        </FormItem>
        <FormItem :label="$t('page.equipment.colProtection')" name="protection_measures">
          <Input.TextArea v-model:value="formState.protection_measures" :rows="2" :placeholder="$t('page.equipment.placeholderProtection')" />
        </FormItem>
        <FormItem :label="$t('page.equipment.colEquipment')" name="equipment_ids">
          <Select
            v-model:value="formState.equipment_ids"
            mode="multiple"
            option-filter-prop="label"
            :placeholder="$t('page.equipment.placeholderEquipment')"
            allow-clear
          >
            <Select.Option v-for="eq in equipments" :key="eq.id" :value="eq.id" :label="eq.name">
              {{ eq.name }} ({{ eq.code }})
            </Select.Option>
          </Select>
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>
