<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { $t } from '#/locales';
import {
  Button,
  Table,
  Input,
  Select,
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
  code: string;
  name: string;
}

interface EquipmentStateOption {
  id: string;
  state: string | null;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface EquipmentImageOption {
  id: string;
  image_id: string;
  path?: string | null;
}

interface ParameterItem {
  id?: string;
  code: string;
  name: string;
  unit_id: string | null;
  unit?: { id: string; name: string } | null;
  standard?: number | null;
  standard_max?: number | null;
  standard_min?: number | null;
}

interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category_id: string | null;
  equipment_category?: CategoryOption | null;
  equipment_images?: EquipmentImageOption[];
  is_active: boolean;
  equipment_errors?: ErrorOption[];
  equipment_parameters?: ParameterItem[];
  checklist_details_count?: number;
}

const router = useRouter();

const loading = ref(false);
const equipments = ref<EquipmentItem[]>([]);
const searchVal = ref('');
const activeSearch = ref('');

const expandedErrors = ref<Record<string, boolean>>({});
const expandedParameters = ref<Record<string, boolean>>({});

function toggleExpandErrors(id: string) {
  expandedErrors.value[id] = !expandedErrors.value[id];
}

function toggleExpandParameters(id: string) {
  expandedParameters.value[id] = !expandedParameters.value[id];
}

function goToErrorsPage() {
  router.push({ name: 'EquipmentErrors' });
}

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

const filterCategoryId = ref<string | undefined>(undefined);
const filterActive = ref<string | undefined>(undefined);
const categories = ref<CategoryOption[]>([]);

async function loadCategories() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-categories`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadEquipments(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page,
      per_page: size,
    };
    if (filterCategoryId.value) {
      params.equipment_category_id = filterCategoryId.value;
    }
    if (filterActive.value !== undefined) {
      params.is_active = filterActive.value;
    }
    if (activeSearch.value) {
      params.q = activeSearch.value;
    }
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
    total.value = res.data?.total ?? equipments.value.length;
    currentPage.value = res.data?.current_page ?? page;
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải danh sách thiết bị');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadEquipments(1);
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  filterCategoryId.value = undefined;
  filterActive.value = undefined;
  currentPage.value = 1;
  loadEquipments(1);
}

function handleFilterChange() {
  currentPage.value = 1;
  loadEquipments(1);
}

function handleTableChange(pagination: any) {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  loadEquipments(pagination.current, pagination.pageSize);
}

const filteredEquipments = computed(() => equipments.value);

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
    width: 260,
  },
  {
    title: $t('page.equipment.parametersTitle') || 'Thông số',
    dataIndex: 'equipment_parameters',
    key: 'equipment_parameters',
    width: 260,
  },
  {
    title: $t('page.equipment.colChecklist'),
    dataIndex: 'checklist_details_count',
    key: 'checklist_details_count',
    sorter: (a: EquipmentItem, b: EquipmentItem) => (a.checklist_details_count || 0) - (b.checklist_details_count || 0),
  },
  {
    title: $t('page.equipment.colActions'),
    key: 'actions',
    width: 160,
    align: 'right' as const,
  },
]);

function openAddModal() {
  router.push({ name: 'EquipmentDetail' });
}

function openEditModal(record: EquipmentItem) {
  router.push({ name: 'EquipmentDetail', query: { id: record.id } });
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

onMounted(() => {
  loadEquipments();
  loadCategories();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.equipment.placeholderName')"
        class="max-w-[280px]"
        allow-clear
        @press-enter="handleSearch"
      />
      <Select
        v-model:value="filterCategoryId"
        :placeholder="$t('page.equipment.filterCategoryPlaceholder')"
        class="min-w-[180px]"
        allow-clear
        @change="handleFilterChange"
      >
        <Select.Option v-for="c in categories" :key="c.id" :value="c.id">
          {{ c.name }}
        </Select.Option>
      </Select>
      <Select
        v-model:value="filterActive"
        :placeholder="$t('page.equipment.filterActivePlaceholder')"
        class="min-w-[150px]"
        allow-clear
        @change="handleFilterChange"
      >
        <Select.Option value="true">{{ $t('page.equipment.statusActive') }}</Select.Option>
        <Select.Option value="false">{{ $t('page.equipment.statusInactive') }}</Select.Option>
      </Select>
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
            <template v-if="column.key === 'equipment_category'">
               <span>{{ record.equipment_category?.code || '—' }}</span>
            </template>

            <template v-else-if="column.key === 'is_active'">
              <Tag :color="record.is_active ? 'success' : 'default'">
                {{ record.is_active ? $t('page.equipment.statusActive') : $t('page.equipment.statusInactive') }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'equipment_errors'">
               <div class="flex flex-col gap-1 max-w-[260px]">
                 <div
                   class="flex flex-wrap gap-1 transition-all duration-300 ease-in-out overflow-hidden"
                   :class="expandedErrors[record.id] ? 'max-h-[1000px]' : 'max-h-[52px]'"
                 >
                   <Tag
                     v-for="err in record.equipment_errors"
                     :key="err.id"
                     color="red"
                     class="cursor-pointer transition-all duration-200 hover:bg-[#ff4d4f] hover:text-white hover:border-[#ff4d4f] hover:-translate-y-0.5 hover:shadow-sm max-w-full truncate"
                     @click="goToErrorsPage"
                   >
                     {{ err.name }}
                   </Tag>
                 </div>
                 <div v-if="record.equipment_errors && record.equipment_errors.length > 3">
                   <span
                     class="text-xs text-blue-500 hover:text-blue-700 cursor-pointer font-semibold inline-block mt-0.5 select-none"
                     @click="toggleExpandErrors(record.id)"
                   >
                     {{ expandedErrors[record.id] ? $t('page.equipment.btnCollapse') : $t('page.equipment.btnShowMore') }}
                   </span>
                 </div>
                 <span v-if="!record.equipment_errors || record.equipment_errors.length === 0" class="text-gray-400">—</span>
               </div>
             </template>
             <template v-else-if="column.key === 'equipment_parameters'">
               <div class="flex flex-col gap-1 max-w-[260px]">
                 <div
                   class="flex flex-wrap gap-1 transition-all duration-300 ease-in-out overflow-hidden"
                   :class="expandedParameters[record.id] ? 'max-h-[1000px]' : 'max-h-[52px]'"
                 >
                   <Tag
                     v-for="param in record.equipment_parameters"
                     :key="param.id"
                     color="blue"
                     class="transition-all duration-200 hover:bg-[#1890ff] hover:text-white hover:border-[#1890ff] hover:shadow-sm max-w-full truncate"
                   >
                     {{ param.code }}<span v-if="param.unit"> ({{ param.unit.name }})</span>
                   </Tag>
                 </div>
                 <div v-if="record.equipment_parameters && record.equipment_parameters.length > 3">
                   <span
                     class="text-xs text-blue-500 hover:text-blue-700 cursor-pointer font-semibold inline-block mt-0.5 select-none"
                     @click="toggleExpandParameters(record.id)"
                   >
                     {{ expandedParameters[record.id] ? $t('page.equipment.btnCollapse') : $t('page.equipment.btnShowMore') }}
                   </span>
                 </div>
                 <span v-if="!record.equipment_parameters || record.equipment_parameters.length === 0" class="text-gray-400">—</span>
               </div>
              </template>
             <template v-else-if="column.key === 'checklist_details_count'">
               <span>{{ record.checklist_details_count ?? 0 }}</span>
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
  </div>
</template>
