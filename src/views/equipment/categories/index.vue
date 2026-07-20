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
  code: string;
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

// Pagination State
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

async function loadCategories(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const params: Record<string, number | string> = {
      page,
      per_page: size,
    };
    if (activeSearch.value) {
      params.q = activeSearch.value;
    }
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-categories`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? raw : [];
    total.value = res.data?.total ?? categories.value.length;
    currentPage.value = res.data?.current_page ?? page;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message || $t('page.equipment.msgLoadCategoriesError'));
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadCategories(1);
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  currentPage.value = 1;
  loadCategories(1);
}

function handleTableChange(pagination: { current: number; pageSize: number }) {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  loadCategories(pagination.current, pagination.pageSize);
}

const filteredCategories = computed(() => categories.value);

const columns = computed(() => [
  {
    title: $t('page.equipment.colCode') || 'Mã loại',
    dataIndex: 'code',
    key: 'code',
    sorter: (a: CategoryItem, b: CategoryItem) => (a.code || '').localeCompare(b.code || ''),
  },
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
    fixed: 'right' as const,
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
});

const rules = computed(() => ({
  code: [{ required: true, message: $t('page.equipment.validationCategoryCode') }],
  name: [{ required: true, message: $t('page.equipment.validationName') }],
}));

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    code: '',
    name: '',
  };
  showModal.value = true;
}

function openEditModal(record: CategoryItem) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    code: record.code,
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
    message.success($t('page.equipment.msgDeleteCategorySuccess'));
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message || $t('page.equipment.msgDeleteCategoryError'));
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    if (isEditing.value && editId.value) {
      const res = await axios.put(`${API_BASE_URL}/v1/equipment-categories/${editId.value}`, {
        code: formState.value.code,
        name: formState.value.name,
      }, {
        headers: getAuthHeaders(),
      });
      const updated = res.data;
      const idx = categories.value.findIndex(c => c.id === editId.value);
      if (idx !== -1) categories.value[idx] = updated;
      message.success($t('page.equipment.msgUpdateCategorySuccess'));
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/equipment-categories`, {
        code: formState.value.code,
        name: formState.value.name,
      }, {
        headers: getAuthHeaders(),
      });
      const created = res.data;
      categories.value.push(created);
      message.success($t('page.equipment.msgCreateCategorySuccess'));
    }
    showModal.value = false;
  } catch (err: unknown) {
    const formErr = err as { errorFields?: unknown[] };
    if (formErr?.errorFields) {
      // Form validation failed
    } else {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || $t('page.equipment.msgSaveCategoryError');
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
    <div class="action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
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
          :scroll="{ x: 'max-content' }"
          :pagination="{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (tot: number) => $t('page.equipment.totalRecords', { total: tot }),
          }"
          class="w-full"
          @change="handleTableChange"
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
      :ok-text="$t('page.equipment.modalConfirm')"
      :cancel-text="$t('page.equipment.modalCancel')"
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
        <FormItem :label="$t('page.equipment.colCode') || 'Mã loại'" name="code">
          <Input v-model:value="formState.code" :placeholder="$t('page.equipment.placeholderCategoryCode')" />
        </FormItem>
        <FormItem :label="$t('page.equipment.colName')" name="name">
          <Input v-model:value="formState.name" :placeholder="$t('page.equipment.placeholderName')" />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>
