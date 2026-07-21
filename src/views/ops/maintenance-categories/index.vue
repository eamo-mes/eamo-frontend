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
  message,
  Spin,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { listUsersApi, type UserItem } from '#/api/core/users';
import { isSoftDeleted, softDeletedRowClass, sortBySoftDeleted } from '#/utils/soft-delete';

interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  maintenance_items?: {
    id: string;
    name: string;
    description: string | null;
    users?: {
      id: string;
      name: string;
    }[];
  }[];
  created_at?: string;
  deleted_at?: string | null;
}

interface MaintenanceItemRow {
  id?: string;
  name: string;
  description: string;
  user_ids: string[];
  _key: string;
}

interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface TablePagination {
  current?: number;
  pageSize?: number;
}

const loading = ref(false);
const submitting = ref(false);
const categories = ref<CategoryItem[]>([]);
const searchVal = ref('');
const activeSearch = ref('');

function getAuthHeaders(): Record<string, string> {
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

async function loadCategories(page: number = currentPage.value, size: number = pageSize.value): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, boolean | number | string> = {
      page,
      per_page: size,
      with_trashed: true,
    };
    if (activeSearch.value) {
      params.q = activeSearch.value;
    }
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-categories`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? (raw as CategoryItem[]) : [];
    total.value = typeof res.data?.total === 'number' ? res.data.total : categories.value.length;
    currentPage.value = typeof res.data?.current_page === 'number' ? res.data.current_page : page;
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    message.error(apiError || $t('page.ops.loadError'));
  } finally {
    loading.value = false;
  }
}

function handleSearch(): void {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadCategories(1);
}

function handleReset(): void {
  searchVal.value = '';
  activeSearch.value = '';
  currentPage.value = 1;
  loadCategories(1);
}

function handleTableChange(pagination: TablePagination): void {
  const current = pagination.current ?? 1;
  const size = pagination.pageSize ?? 10;
  currentPage.value = current;
  pageSize.value = size;
  loadCategories(current, size);
}

const sortedCategories = computed(() => sortBySoftDeleted(categories.value));

const columns = computed(() => [
  {
    title: $t('page.ops.categoryName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: CategoryItem, b: CategoryItem) => a.name.localeCompare(b.name),
  },
  {
    title: $t('page.ops.categoryDescription'),
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: $t('page.company.colActions'),
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
  description: '',
  items: [] as MaintenanceItemRow[],
});

const rules = {
  name: [{ required: true, message: $t('page.ops.validationCategoryName') }],
};

function generateKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function addItemRow(): void {
  formState.value.items.push({
    name: '',
    description: '',
    user_ids: [],
    _key: generateKey(),
  });
}

function removeItemRow(index: number): void {
  formState.value.items.splice(index, 1);
}

function openAddModal(): void {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    name: '',
    description: '',
    items: [],
  };
  showModal.value = true;
}

function openEditModal(record: CategoryItem): void {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    name: record.name,
    description: record.description ?? '',
    items: (record.maintenance_items ?? []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      user_ids: (item.users ?? []).map(u => u.id),
      _key: generateKey(),
    })),
  };
  showModal.value = true;
}

async function handleDelete(id: string): Promise<void> {
  try {
    await axios.delete(`${API_BASE_URL}/v1/maintenance-categories/${id}`, {
      headers: getAuthHeaders(),
    });
    categories.value = categories.value.filter(c => c.id !== id);
    message.success($t('page.ops.deleteSuccess'));
    // If the last item on the page was deleted, go back one page if possible
    if (categories.value.length === 0 && currentPage.value > 1) {
      currentPage.value -= 1;
    }
    loadCategories();
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    message.error(apiError || $t('page.ops.deleteError'));
  }
}

async function handleOk(): Promise<void> {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      name: formState.value.name,
      description: formState.value.description,
      items: formState.value.items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        user_ids: item.user_ids,
      })),
    };

    if (isEditing.value && editId.value) {
      const res = await axios.put(`${API_BASE_URL}/v1/maintenance-categories/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
      const updated = res.data as CategoryItem;
      const idx = categories.value.findIndex(c => c.id === editId.value);
      if (idx !== -1) categories.value[idx] = updated;
      message.success($t('page.ops.saveSuccess'));
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/maintenance-categories`, payload, {
        headers: getAuthHeaders(),
      });
      const created = res.data as CategoryItem;
      categories.value.push(created);
      message.success($t('page.ops.saveSuccess'));
      loadCategories(); // Reload to update pagination and sort order
    }
    showModal.value = false;
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    if (apiError || (err as Error).message) {
      message.error(apiError || $t('page.ops.saveError'));
    }
  } finally {
    submitting.value = false;
  }
}

const users = ref<UserItem[]>([]);

const userOptions = computed(() =>
  users.value.map(u => ({
    label: u.name,
    value: u.id,
  }))
);

async function loadUsers(): Promise<void> {
  try {
    users.value = await listUsersApi({ per_page: 1000 });
  } catch {
    // silently fail
  }
}

onMounted(() => {
  loadCategories();
  loadUsers();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar -->
    <div class="action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.ops.placeholderCategoryName')"
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
          {{ $t('page.ops.btnAddCategory') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="sortedCategories"
          row-key="id"
          :row-class-name="softDeletedRowClass"
          :scroll="{ x: 'max-content' }"
          :pagination="{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (tot: number) => `Tổng ${tot} bản ghi`,
          }"
          class="w-full"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  :disabled="isSoftDeleted(record as CategoryItem)"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as CategoryItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  ok-text="Yes"
                  cancel-text="No"
                  @confirm="handleDelete((record as CategoryItem).id)"
                >
                  <Button
                    size="small"
                    danger
                    :disabled="isSoftDeleted(record as CategoryItem)"
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
      :title="isEditing ? $t('page.ops.btnEditCategory') : $t('page.ops.btnAddCategory')"
      :confirm-loading="submitting"
      :ok-text="$t('page.ops.btnOk')"
      :cancel-text="$t('page.ops.btnCancel')"
      width="1040px"
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
        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.categoryName')" name="name">
            <Input v-model:value="formState.name" :placeholder="$t('page.ops.placeholderCategoryName')" />
          </FormItem>
          <FormItem :label="$t('page.ops.categoryDescription')" name="description">
            <Input v-model:value="formState.description" :placeholder="$t('page.ops.placeholderCategoryDesc')" />
          </FormItem>
        </div>

        <!-- ── Nested Maintenance Items Section ───────────────────────────── -->
        <div class="mt-5 pt-2">
          <div class="mb-3 flex items-end justify-between gap-3">
            <div>
              <div class="font-semibold text-foreground">
                {{ $t('page.ops.nestedItemsTitle') }}
              </div>
            </div>
          </div>

          <!-- Items list -->
          <div v-if="formState.items.length === 0" class="py-5 text-center text-sm text-muted-foreground">
            {{ $t('page.ops.noItems') }}
          </div>

          <div v-else class="max-h-[340px] divide-y divide-border overflow-y-auto pr-1">
            <div
              v-for="(item, idx) in formState.items"
              :key="item._key"
              class="flex flex-wrap items-end gap-3 py-3 first:pt-0 last:pb-0"
            >
              <!-- Tên hạng mục -->
              <div class="flex-1 min-w-[200px]">
                <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colItemName') }}</span>
                <Input
                  v-model:value="item.name"
                  :placeholder="$t('page.ops.placeholderItemName')"
                />
              </div>

              <!-- Mô tả -->
              <div class="flex-1 min-w-[250px]">
                <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colItemDesc') }}</span>
                <Input
                  v-model:value="item.description"
                  :placeholder="$t('page.ops.placeholderItemDesc')"
                />
              </div>

              <!-- Kỹ thuật viên thực hiện -->
              <div class="flex-1 min-w-[200px]">
                <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.assignedTechnicians') }}</span>
                <Select
                  v-model:value="item.user_ids"
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
                  @click="removeItemRow(idx)"
                >
                  {{ $t('page.company.btnDelete') }}
                </Button>
              </div>
            </div>
          </div>

          <Button type="dashed" block class="mt-3" @click="addItemRow">
            + {{ $t('page.ops.btnAddItem') }}
          </Button>
        </div>
      </Form>
    </Modal>
  </div>
</template>
