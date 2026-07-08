<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { $t } from '#/locales';
import {
  Button,
  Table,
  Input,
  Modal,
  Form,
  FormItem,
  Popconfirm,
  message,
  Spin,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

interface CategoryItem {
  id: string;
  name: string;
  created_at?: string;
}

const loading = ref(false);
const submitting = ref(false);
const categories = ref<CategoryItem[]>([]);
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
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-categories`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? raw : [];
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải danh sách loại thiết bị');
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

const filteredCategories = computed(() => {
  const q = activeSearch.value.toLowerCase();
  if (!q) return categories.value;
  return categories.value.filter(c => c.name.toLowerCase().includes(q));
});

const columns = computed(() => [
  {
    title: $t('page.equipment.colName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: CategoryItem, b: CategoryItem) => a.name.localeCompare(b.name),
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
});

const rules = {
  name: [{ required: true, message: $t('page.equipment.validationName') }],
};

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    name: '',
  };
  showModal.value = true;
}

function openEditModal(record: CategoryItem) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    name: record.name,
  };
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/equipment-categories/${id}`, {
      headers: getAuthHeaders(),
    });
    categories.value = categories.value.filter(c => c.id !== id);
    message.success('Xóa loại thiết bị thành công');
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể xóa loại thiết bị');
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    if (isEditing.value && editId.value) {
      const res = await axios.put(`${API_BASE_URL}/v1/equipment-categories/${editId.value}`, {
        name: formState.value.name,
      }, {
        headers: getAuthHeaders(),
      });
      const updated = res.data;
      const idx = categories.value.findIndex(c => c.id === editId.value);
      if (idx !== -1) categories.value[idx] = updated;
      message.success('Cập nhật loại thiết bị thành công');
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/equipment-categories`, {
        name: formState.value.name,
      }, {
        headers: getAuthHeaders(),
      });
      const created = res.data;
      categories.value.push(created);
      message.success('Thêm loại thiết bị thành công');
    }
    showModal.value = false;
  } catch (err: any) {
    if (err?.errorFields) {
      // Form validation failed
    } else {
      const msg = err?.response?.data?.message || 'Không thể lưu loại thiết bị';
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadCategories();
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
          {{ $t('page.equipment.btnAddCategory') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredCategories"
          row-key="id"
          :pagination="{ pageSize: 10 }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as CategoryItem)"
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
      :title="isEditing ? $t('page.equipment.btnEditCategory') : $t('page.equipment.btnAddCategory')"
      :confirm-loading="submitting"
      ok-text="Xác nhận"
      cancel-text="Hủy"
      width="500px"
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
      </Form>
    </Modal>
  </div>
</template>
