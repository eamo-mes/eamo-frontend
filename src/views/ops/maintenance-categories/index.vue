<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { $t } from '#/locales';
import {
  Button,
  Table,
  Input,
  Popconfirm,
  message,
  Spin,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
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

const router = useRouter();

const loading = ref(false);
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

function goToAdd(): void {
  router.push({ name: 'OpsMaintenanceCategoryDetail' });
}

function goToEdit(record: CategoryItem): void {
  router.push({
    name: 'OpsMaintenanceCategoryDetail',
    query: { id: record.id },
  });
}

async function handleDelete(id: string): Promise<void> {
  try {
    await axios.delete(`${API_BASE_URL}/v1/maintenance-categories/${id}`, {
      headers: getAuthHeaders(),
    });
    categories.value = categories.value.filter(c => c.id !== id);
    message.success($t('page.ops.deleteSuccess'));
    if (categories.value.length === 0 && currentPage.value > 1) {
      currentPage.value -= 1;
    }
    loadCategories();
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    message.error(apiError || $t('page.ops.deleteError'));
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
          @click="goToAdd"
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
                  @click="goToEdit(record as CategoryItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  :ok-text="$t('page.ops.btnOk')"
                  :cancel-text="$t('page.ops.btnCancel')"
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
  </div>
</template>
