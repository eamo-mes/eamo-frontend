<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { $t } from '#/locales';

import {
  Button,
  Input,
  Select,
  Table,
  Popconfirm,
  message,
  Spin,
  Tag,
} from 'ant-design-vue';
import { isSoftDeleted, softDeletedRowClass, sortBySoftDeleted } from '#/utils/soft-delete';
import { useRoleAccess } from '#/utils/useRoleAccess';

const { isManager } = useRoleAccess();
import {
  fetchEquipmentsApi,
  fetchCategoriesApi,
  fetchMaintenancePlansApi,
  deleteMaintenancePlanApi,
  type EquipmentOption,
  type MaintenanceCategoryOption,
  type MaintenancePlanItem,
  type FetchMaintenancePlansParams,
} from './api';

interface TablePagination {
  current?: number;
  pageSize?: number;
}

const router = useRouter();

const loading = ref(false);
const plans = ref<MaintenancePlanItem[]>([]);
const searchVal = ref('');
const activeSearch = ref('');
const selectedEquipmentId = ref<string | undefined>(undefined);
const selectedCategoryId = ref<string | undefined>(undefined);
const equipments = ref<EquipmentOption[]>([]);
const categories = ref<MaintenanceCategoryOption[]>([]);

const currentPage = ref(1);
const pageSize = ref(15);
const total = ref(0);

async function loadEquipments(): Promise<void> {
  try {
    equipments.value = await fetchEquipmentsApi();
  } catch {
    // silently fail
  }
}

async function loadCategories(): Promise<void> {
  try {
    categories.value = await fetchCategoriesApi();
  } catch {
    // silently fail
  }
}

async function loadPlans(page = currentPage.value, size = pageSize.value): Promise<void> {
  loading.value = true;
  try {
    const params: FetchMaintenancePlansParams = { page, per_page: size, with_trashed: true };
    if (activeSearch.value) params.q = activeSearch.value;
    if (selectedEquipmentId.value) params.equipment_id = selectedEquipmentId.value;
    if (selectedCategoryId.value) params.maintenance_category_id = selectedCategoryId.value;

    const res = await fetchMaintenancePlansApi(params);
    const raw = res.data ?? [];
    plans.value = Array.isArray(raw) ? raw : [];
    total.value = typeof res.total === 'number' ? res.total : plans.value.length;
    currentPage.value = typeof res.current_page === 'number' ? res.current_page : page;
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (err as { message?: string })?.message;
    message.error(apiError || $t('page.ops.planLoadError'));
  } finally {
    loading.value = false;
  }
}

function handleSearch(): void {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadPlans(1);
}

function handleReset(): void {
  searchVal.value = '';
  activeSearch.value = '';
  selectedEquipmentId.value = undefined;
  selectedCategoryId.value = undefined;
  currentPage.value = 1;
  loadPlans(1);
}

function handleEquipmentFilter(val: unknown): void {
  selectedEquipmentId.value = typeof val === 'string' ? val : undefined;
  currentPage.value = 1;
  loadPlans(1);
}

function handleCategoryFilter(val: unknown): void {
  selectedCategoryId.value = typeof val === 'string' ? val : undefined;
  currentPage.value = 1;
  loadPlans(1);
}

const columns = computed(() => [
  {
    title: $t('page.ops.colPlanCode'),
    dataIndex: 'plan_code',
    key: 'plan_code',
  },
  {
    title: $t('page.ops.placeholderEquipment'),
    key: 'equipment',
  },
  {
    title: $t('page.ops.maintenanceCategories'),
    key: 'maintenance_category',
  },
  {
    title: $t('page.ops.colMaintenanceType'),
    dataIndex: 'maintenance_type',
    key: 'maintenance_type',
  },
  {
    title: $t('page.ops.planDate'),
    dataIndex: 'date',
    key: 'date',
  },
  {
    title: $t('page.company.colActions'),
    key: 'actions',
    width: 180,
    align: 'center' as const,
    fixed: 'right' as const,
  },
]);

const sortedPlans = computed(() => sortBySoftDeleted(plans.value));

function handleTableChange(pagination: TablePagination): void {
  const current = pagination.current ?? 1;
  const size = pagination.pageSize ?? 15;
  currentPage.value = current;
  pageSize.value = size;
  loadPlans(current, size);
}

const categoryOptions = computed(() =>
  categories.value.map(cat => ({
    label: cat.name,
    value: cat.id,
  }))
);

function openAdd(): void {
  router.push({ name: 'OpsMaintenancePlanDetail' });
}

function openEdit(id: string): void {
  router.push({ name: 'OpsMaintenancePlanDetail', query: { id } });
}

async function handleDelete(id: string): Promise<void> {
  try {
    await deleteMaintenancePlanApi(id);
    message.success($t('page.ops.planDeleteSuccess'));
    await loadPlans();
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (err as { message?: string })?.message;
    message.error(apiError || $t('page.ops.planDeleteError'));
  }
}

function getMaintenanceTypeLabel(type: string): string {
  if (type === 'Preventive') return $t('page.ops.typePreventive') || 'Preventive';
  if (type === 'Corrective') return $t('page.ops.typeCorrective') || 'Corrective';
  if (type === 'Predictive') return $t('page.ops.typePredictive') || 'Predictive';
  if (type === 'Inspection') return $t('page.ops.typeInspection') || 'Inspection';
  return type || '—';
}

function getMaintenanceTypeColor(type: string): string {
  if (type === 'Preventive') return 'processing';
  if (type === 'Corrective') return 'error';
  if (type === 'Predictive') return 'warning';
  if (type === 'Inspection') return 'default';
  return 'default';
}

onMounted(() => {
  loadEquipments();
  loadCategories();
  loadPlans();
});
</script>

<template>
  <div>
    <div class="p-6 space-y-4">
      <!-- Action Bar -->
      <div class="action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
        <Input
          v-model:value="searchVal"
          :placeholder="$t('page.ops.placeholderPlanCode')"
          class="w-[200px]"
          allow-clear
          @press-enter="handleSearch"
        />
        <Select
          v-model:value="selectedEquipmentId"
          :placeholder="$t('page.ops.placeholderEquipment')"
          show-search
          option-filter-prop="searchText"
          option-label-prop="label"
          class="w-[180px]"
          allow-clear
          @change="handleEquipmentFilter"
          @clear="handleEquipmentFilter(undefined)"
        >
          <Select.Option
            v-for="eq in equipments"
            :key="eq.id"
            :value="eq.id"
            :label="eq.code"
            :searchText="`${eq.code} ${eq.name ?? ''}`"
          >
            <div class="flex justify-between items-center w-full">
              <span>{{ eq.code }}</span>
              <span class="text-xs text-gray-400 ml-2">{{ eq.name }}</span>
            </div>
          </Select.Option>
        </Select>
        <Select
          v-model:value="selectedCategoryId"
          :placeholder="$t('page.ops.maintenanceCategories')"
          :options="categoryOptions"
          class="w-[220px]"
          allow-clear
          show-search
          option-filter-prop="label"
          @change="handleCategoryFilter"
          @clear="handleCategoryFilter(undefined)"
        />
        <Button type="default" @click="handleSearch">
          {{ $t('page.company.btnFilter') }}
        </Button>
        <Button type="default" @click="handleReset">
          {{ $t('page.company.btnReset') }}
        </Button>
        <div class="ml-auto flex gap-2">
          <Button
            v-if="isManager"
            type="primary"
            class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md text-white h-full"
            @click="openAdd"
          >
            {{ $t('page.ops.btnAddPlan') }}
          </Button>
        </div>
      </div>

      <!-- Table View -->
      <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Spin :spinning="loading">
          <Table
            :columns="columns"
            :data-source="sortedPlans"
            row-key="id"
            :row-class-name="softDeletedRowClass"
            :scroll="{ x: 'max-content' }"
            :pagination="{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
            }"
            class="table-nowrap w-full"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'equipment'">
                {{ record.equipment ? `${record.equipment.code} - ${record.equipment.name || ''}` : '—' }}
              </template>

              <template v-else-if="column.key === 'maintenance_category'">
                {{ record.maintenance_category?.name || '—' }}
              </template>

              <template v-else-if="column.key === 'maintenance_type'">
                <Tag :color="getMaintenanceTypeColor(record.maintenance_type)">
                  {{ getMaintenanceTypeLabel(record.maintenance_type) }}
                </Tag>
              </template>

              <template v-else-if="column.key === 'actions'">
                <div class="flex items-center justify-center gap-2">
                  <Button v-if="isManager" size="small" class="rounded hover:border-primary hover:text-primary" :disabled="isSoftDeleted(record as MaintenancePlanItem)" @click="openEdit(record.id)">
                    {{ $t('page.company.btnEdit') }}
                  </Button>
                  <Popconfirm
                    v-if="isManager"
                    :title="$t('page.company.deleteConfirm')"
                    :ok-text="$t('page.ops.btnConfirm')"
                    :cancel-text="$t('page.ops.btnCancel')"
                    @confirm="handleDelete(record.id)"
                  >
                    <Button size="small" danger class="rounded bg-red-50/50 border-red-200 hover:bg-red-500 hover:text-white" :disabled="isSoftDeleted(record as MaintenancePlanItem)">
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
  </div>
</template>
