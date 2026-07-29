<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Eye, EyeOff } from '@vben/icons';
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
import { isSoftDeleted, softDeletedRowClass, sortBySoftDeleted } from '#/utils/soft-delete';
import EquipmentSummaryWidgets from './components/EquipmentSummaryWidgets.vue';
import ExpandableContainer from '#/components/ExpandableContainer.vue';
import EquipmentChecklistSessionsModal from './components/EquipmentChecklistSessionsModal.vue';
import EquipmentQrModal from './components/EquipmentQrModal.vue';

interface CategoryOption {
  id: string;
  code: string;
  name: string;
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
  maintenance_interval_hours?: number | null;
  equipment_errors?: ErrorOption[];
  equipment_parameters?: ParameterItem[];
  checklist_details_count?: number;
  parent_id?: string | null;
  children?: EquipmentItem[];
  parent?: EquipmentItem | null;
  deleted_at?: string | null;
}

const router = useRouter();

const loading = ref(false);
const equipments = ref<EquipmentItem[]>([]);
const searchVal = ref('');
const activeSearch = ref('');



const checklistModalOpen = ref(false);
const checklistModalEquipmentId = ref<string | null>(null);
const checklistModalEquipmentName = ref<string | null>(null);

const qrModalOpen = ref(false);
const qrModalEquipment = ref<EquipmentItem | null>(null);

function openQrModal(record: EquipmentItem) {
  qrModalEquipment.value = record;
  qrModalOpen.value = true;
}

// Summary Widgets State
interface SummaryItem {
  active?: number;
  description: string;
  icon: string;
  inactive?: number;
  overdue?: number;
  title: string;
  upcoming?: number;
  value: number | string;
}

interface DashboardSummary {
  active_inactive: SummaryItem;
  maintenance: SummaryItem;
  total_assets: SummaryItem;
  with_errors: SummaryItem;
}

const summaryData = ref<DashboardSummary | null>(null);
const summaryLoading = ref(false);
const showWidgets = ref(true);
const _icons = { Eye, EyeOff };

function toggleWidgets() {
  showWidgets.value = !showWidgets.value;
  localStorage.setItem('equipment_list_show_widgets', String(showWidgets.value));
}

async function loadDashboardSummary() {
  summaryLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/dashboard/summary`, {
      headers: getAuthHeaders(),
    });
    if (res.data?.status === 'success' && res.data?.data) {
      summaryData.value = res.data.data;
    } else if (res.data?.data) {
      summaryData.value = res.data.data;
    } else {
      summaryData.value = res.data;
    }
  } catch {
    // silently fail
  } finally {
    summaryLoading.value = false;
  }
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
      with_trashed: true,
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
    message.error(err?.response?.data?.message || $t('page.equipment.msgLoadListError'));
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

const filteredEquipments = computed(() => sortBySoftDeleted(equipments.value));

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
    title: $t('page.equipment.colMaintenanceIntervalHours'),
    dataIndex: 'maintenance_interval_hours',
    key: 'maintenance_interval_hours',
    sorter: (a: EquipmentItem, b: EquipmentItem) => (a.maintenance_interval_hours || 0) - (b.maintenance_interval_hours || 0),
  },
  {
    title: $t('page.equipment.colErrors'),
    dataIndex: 'equipment_errors',
    key: 'equipment_errors',
    width: 320,
  },
  {
    title: $t('page.equipment.parametersTitle'),
    dataIndex: 'equipment_parameters',
    key: 'equipment_parameters',
    width: 320,
  },

  {
    title: $t('page.equipment.colActions'),
    key: 'actions',
    width: 280,
    align: 'right' as const,
    fixed: 'right' as const,
  },
]);

function openAddModal() {
  router.push({ name: 'EquipmentDetail' });
}

function openEditModal(record: EquipmentItem) {
  router.push({ name: 'EquipmentDetail', query: { id: record.id } });
}



function openChecklistModal(record: EquipmentItem) {
  checklistModalEquipmentId.value = record.id;
  checklistModalEquipmentName.value = record.name || record.code;
  checklistModalOpen.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/equipment/${id}`, {
      headers: getAuthHeaders(),
    });
    equipments.value = equipments.value.filter(e => e.id !== id);
    await loadDashboardSummary();
    message.success('Xóa thiết bị thành công');
  } catch (err: any) {
    message.error(err?.response?.data?.message || $t('page.equipment.msgDeleteEquipmentError'));
  }
}

onMounted(() => {
  loadEquipments();
  loadCategories();
  loadDashboardSummary();
  const saved = localStorage.getItem('equipment_list_show_widgets');
  if (saved !== null) {
    showWidgets.value = saved !== 'false';
  }
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
      <div class="ml-auto flex items-center gap-2">
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
            <template v-if="column.key === 'equipment_category'">
               <span>{{ record.equipment_category?.name || '—' }}</span>
            </template>

            <template v-else-if="column.key === 'is_active'">
              <Tag :color="record.is_active ? 'success' : 'default'">
                {{ record.is_active ? $t('page.equipment.statusActive') : $t('page.equipment.statusInactive') }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'maintenance_interval_hours'">
              <span>{{ record.maintenance_interval_hours !== null && record.maintenance_interval_hours !== undefined ? `${record.maintenance_interval_hours} hrs` : '—' }}</span>
            </template>
            <template v-else-if="column.key === 'equipment_errors'">
               <div class="flex flex-col gap-1 max-w-[260px]">
                 <ExpandableContainer :items="record.equipment_errors">
                   <Tag
                     v-for="err in record.equipment_errors"
                     :key="err.id"
                     color="red"
                     class="cursor-pointer transition-all duration-200 hover:bg-[#ff4d4f] hover:text-white hover:border-[#ff4d4f] hover:-translate-y-0.5 hover:shadow-sm max-w-full truncate"
                     @click="goToErrorsPage"
                   >
                     {{ err.name }}
                   </Tag>
                 </ExpandableContainer>
               </div>
             </template>
             <template v-else-if="column.key === 'equipment_parameters'">
               <div class="flex flex-col gap-1 max-w-[260px]">
                 <ExpandableContainer :items="record.equipment_parameters">
                   <Tag
                     v-for="param in record.equipment_parameters"
                     :key="param.id"
                     color="blue"
                     class="transition-all duration-200 hover:bg-[#1890ff] hover:text-white hover:border-[#1890ff] hover:shadow-sm max-w-full truncate"
                   >
                     {{ param.code }}<span v-if="param.unit"> ({{ param.unit.name }})</span>
                   </Tag>
                 </ExpandableContainer>
               </div>
              </template>
             <template v-else-if="column.key === 'actions'">
              <div class="flex items-center justify-end gap-2 whitespace-nowrap">
                <Button
                  size="small"
                  :disabled="isSoftDeleted(record as EquipmentItem)"
                  class="rounded hover:border-primary hover:text-primary flex items-center gap-1"
                  @click="openQrModal(record as EquipmentItem)"
                >
                  {{ $t('page.equipment.btnQrCode') }}
                </Button>
                <Button
                  size="small"
                  :disabled="isSoftDeleted(record as EquipmentItem)"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as EquipmentItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Button
                  size="small"
                  :disabled="isSoftDeleted(record as EquipmentItem)"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openChecklistModal(record as EquipmentItem)"
                >
                  Checklist
                </Button>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  :ok-text="$t('page.equipment.modalConfirm')"
                  :cancel-text="$t('page.equipment.modalCancel')"
                  @confirm="handleDelete(record.id)"
                >
                  <Button
                    size="small"
                    danger
                    :disabled="isSoftDeleted(record as EquipmentItem)"
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

    <!-- Checklist Sessions Modal -->
    <EquipmentChecklistSessionsModal
      v-model:open="checklistModalOpen"
      :equipment-id="checklistModalEquipmentId"
      :equipment-name="checklistModalEquipmentName"
    />

    <!-- Equipment QR Modal -->
    <EquipmentQrModal
      v-model:open="qrModalOpen"
      :equipment="qrModalEquipment"
    />
  </div>
</template>
