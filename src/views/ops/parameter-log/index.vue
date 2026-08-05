<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue';
import {
  Table,
  Button,
  Modal,
  Form,
  FormItem,
  Select,
  Input,
  DatePicker,
  Popconfirm,
  message,
  Spin,
  Tooltip
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { $t } from '#/locales';
import { isSoftDeleted, softDeletedRowClass, sortBySoftDeleted } from '#/utils/soft-delete';

import type { ParameterLogItem, EquipmentOption, UnitOption, ParameterLogFormState } from './types';
import {
  fetchParameterLogsApi,
  createParameterLogApi,
  updateParameterLogApi,
  deleteParameterLogApi,
  fetchEquipmentsApi,
  fetchUnitsApi
} from './api';

import ParameterBatchSaveModal from './components/ParameterBatchSaveModal.vue';
import ParameterImportModal from './components/ParameterImportModal.vue';
import ParameterLineChart from './components/ParameterLineChart.vue';

const RangePicker = DatePicker.RangePicker;

const loading = ref(false);
const submitting = ref(false);
const items = ref<ParameterLogItem[]>([]);
const equipments = ref<EquipmentOption[]>([]);
const units = ref<UnitOption[]>([]);

// Embedded Chart visibility state
const showEmbeddedChart = ref(false);

// Modals / Drawers state
const showAddEditModal = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);

const showBatchSaveModal = ref(false);
const showImportModal = ref(false);
const showBarChart = ref(true);

// Filter & search state
const searchVal = ref('');
const activeSearch = ref('');
const selectedEquipmentFilter = ref<string | undefined>(undefined);
const selectedParameterFilter = ref<string | undefined>(undefined);
const dateRangeFilter = ref<[Dayjs, Dayjs] | undefined>(undefined);

// Dynamic parameters list for parameter filter select
const filterParameters = computed(() => {
  if (selectedEquipmentFilter.value) {
    const equip = equipments.value.find((e) => e.id === selectedEquipmentFilter.value);
    return (equip?.equipment_parameters ?? []).map((p) => ({
      id: p.id,
      name: p.name ? (p.code ? `${p.name} (${p.code})` : p.name) : p.id,
    }));
  }

  const allParams: { id: string; name: string }[] = [];
  const seenIds = new Set<string>();
  for (const equip of equipments.value) {
    if (equip.equipment_parameters) {
      for (const p of equip.equipment_parameters) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          const pName = p.name ? (p.code ? `${p.name} (${p.code})` : p.name) : p.id;
          allParams.push({
            id: p.id,
            name: `${equip.name} - ${pName}`,
          });
        }
      }
    }
  }
  return allParams;
});

// Watch selected equipment to reset parameter filter if selected parameter is not valid
watch(selectedEquipmentFilter, () => {
  if (selectedParameterFilter.value) {
    const exists = filterParameters.value.some((p) => p.id === selectedParameterFilter.value);
    if (!exists) {
      selectedParameterFilter.value = undefined;
    }
  }
});

// Computed equipment for embedded chart
const chartEquipmentId = computed(() => {
  if (selectedEquipmentFilter.value) {
    return selectedEquipmentFilter.value;
  }
  return equipments.value.length > 0 && equipments.value[0] ? equipments.value[0].id : undefined;
});

// Form state for Add/Edit
const formRef = ref();
const recordedAtForm = ref<Dayjs | undefined>(dayjs());
const formState = ref<ParameterLogFormState>({
  equipment_id: undefined,
  equipment_parameter_id: undefined,
  unit_id: undefined,
  value: '',
});

const rules = computed(() => ({
  equipment_id: [{ required: true, message: $t('page.ops.selectEquipment') }],
  equipment_parameter_id: [{ required: true, message: $t('page.ops.selectParameter') }],
  value: [{ required: true, message: $t('page.ops.value') }],
}));

// Computed list of parameters for currently selected equipment in form
const availableParameters = computed(() => {
  if (!formState.value.equipment_id) return [];
  const equip = equipments.value.find((e) => e.id === formState.value.equipment_id);
  const params = equip?.equipment_parameters ?? [];
  return params.map((p) => ({
    ...p,
    displayName: p.name
      ? (p.code && !p.name.includes(`(${p.code})`) ? `${p.name} (${p.code})` : p.name)
      : p.code || p.id,
  }));
});

// Watch selected equipment to reset parameter selection only if newly selected equipment does not have the current parameter
watch(
  () => formState.value.equipment_id,
  (newVal, oldVal) => {
    if (oldVal !== undefined && newVal !== oldVal) {
      const equip = equipments.value.find((e) => e.id === newVal);
      const exists = equip?.equipment_parameters?.some((p) => p.id === formState.value.equipment_parameter_id);
      if (!exists) {
        formState.value.equipment_parameter_id = undefined;
      }
    }
  }
);

// Watch selected parameter to auto-select unit if defined
watch(
  () => formState.value.equipment_parameter_id,
  (newVal) => {
    if (newVal) {
      const param = availableParameters.value.find((p) => p.id === newVal);
      if (param && param.unit_id) {
        formState.value.unit_id = param.unit_id;
      }
    } else {
      formState.value.unit_id = undefined;
    }
  }
);

async function loadInitialMetadata() {
  try {
    const rawEquipments = await fetchEquipmentsApi();
    equipments.value = rawEquipments.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      equipment_parameters: item.equipment_parameters || [],
    }));

    units.value = await fetchUnitsApi();
  } catch (error) {
    console.error('Failed to load initial metadata', error);
  }
}

async function loadItems() {
  loading.value = true;
  try {
    items.value = await fetchParameterLogsApi(true);
  } catch (error) {
    message.error($t('page.ops.loadError'));
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function getEquipmentName(id: string): string {
  const equip = equipments.value.find((e) => e.id === id);
  return equip ? `${equip.name} (${equip.code})` : id;
}

function getParameterName(equipId: string, paramId: string): string {
  const equip = equipments.value.find((e) => e.id === equipId);
  const param = equip?.equipment_parameters?.find((p) => p.id === paramId);
  if (param?.name) {
    return param.code ? `${param.name} (${param.code})` : param.name;
  }
  return paramId;
}

function formatParameterName(record: ParameterLogItem): string {
  const paramObj = record.parameter || record.equipment_parameter;
  if (paramObj?.name) {
    return paramObj.code ? `${paramObj.name} (${paramObj.code})` : paramObj.name;
  }
  return getParameterName(record.equipment_id, record.equipment_parameter_id);
}

function getUnitSuffix(unitId: string | null | undefined): string {
  if (!unitId) return '';
  const unit = units.value.find((u) => u.id === unitId);
  return unit ? ` ${unit.name}` : '';
}

onMounted(() => {
  loadInitialMetadata();
  loadItems();
});

function handleSearch() {
  activeSearch.value = searchVal.value;
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  selectedEquipmentFilter.value = undefined;
  selectedParameterFilter.value = undefined;
  dateRangeFilter.value = undefined;
}

const filteredItems = computed(() => {
  let result = items.value;

  if (selectedEquipmentFilter.value) {
    result = result.filter((item) => item.equipment_id === selectedEquipmentFilter.value);
  }

  if (selectedParameterFilter.value) {
    result = result.filter((item) => item.equipment_parameter_id === selectedParameterFilter.value);
  }

  if (dateRangeFilter.value && dateRangeFilter.value[0] && dateRangeFilter.value[1]) {
    const start = dateRangeFilter.value[0].startOf('day');
    const end = dateRangeFilter.value[1].endOf('day');
    result = result.filter((item) => {
      const recDateStr = item.recorded_at || item.created_at;
      if (!recDateStr) return false;
      const recDate = dayjs(recDateStr);
      return (recDate.isAfter(start) || recDate.isSame(start)) && (recDate.isBefore(end) || recDate.isSame(end));
    });
  }

  if (activeSearch.value) {
    const q = activeSearch.value.toLowerCase();
    result = result.filter((item) => {
      const equipName = getEquipmentName(item.equipment_id).toLowerCase();
      const paramName = formatParameterName(item).toLowerCase();
      const val = String(item.value).toLowerCase();
      return equipName.includes(q) || paramName.includes(q) || val.includes(q);
    });
  }

  return sortBySoftDeleted(result);
});

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  recordedAtForm.value = dayjs();
  formState.value = {
    equipment_id: undefined,
    equipment_parameter_id: undefined,
    unit_id: undefined,
    value: '',
  };
  showAddEditModal.value = true;
}

function openEditModal(record: ParameterLogItem) {
  isEditing.value = true;
  editId.value = record.id;
  recordedAtForm.value = record.recorded_at ? dayjs(record.recorded_at) : (record.created_at ? dayjs(record.created_at) : dayjs());

  const equipId = record.equipment_id || record.equipment?.id;
  const paramId = record.equipment_parameter_id || record.equipment_parameter?.id || record.parameter?.id;

  // Ensure equipment option exists in equipments list so Select displays name properly
  if (equipId && !equipments.value.some((e) => e.id === equipId)) {
    const equipObj = record.equipment;
    equipments.value.push({
      id: equipId,
      code: equipObj?.code || '',
      name: equipObj?.name ? (equipObj.code ? `${equipObj.name} (${equipObj.code})` : equipObj.name) : (equipObj?.code || equipId),
      equipment_parameters: [],
    });
  }

  // Ensure parameter option exists in equipment's equipment_parameters list
  if (equipId && paramId) {
    const equip = equipments.value.find((e) => e.id === equipId);
    if (equip) {
      if (!equip.equipment_parameters) {
        equip.equipment_parameters = [];
      }
      if (!equip.equipment_parameters.some((p) => p.id === paramId)) {
        const pObj = record.parameter || record.equipment_parameter;
        equip.equipment_parameters.push({
          id: paramId,
          code: pObj?.code || '',
          name: pObj?.name || pObj?.code || paramId,
          unit_id: record.unit_id || null,
        });
      }
    }
  }

  formState.value = {
    equipment_id: equipId,
    equipment_parameter_id: paramId,
    unit_id: record.unit_id || undefined,
    value: record.value,
  };
  showAddEditModal.value = true;
}

function openBatchSaveModal() {
  showBatchSaveModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await deleteParameterLogApi(id);
    message.success($t('page.ops.successDelete'));
    loadItems();
  } catch (error) {
    message.error($t('page.ops.deleteFailed'));
    console.error(error);
  }
}

async function handleAddEditOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload: ParameterLogFormState = {
      equipment_id: formState.value.equipment_id,
      equipment_parameter_id: formState.value.equipment_parameter_id,
      unit_id: formState.value.unit_id || undefined,
      value: formState.value.value,
      recorded_at: recordedAtForm.value ? recordedAtForm.value.format('YYYY-MM-DD HH:mm:ss') : null,
    };

    if (isEditing.value && editId.value) {
      await updateParameterLogApi(editId.value, payload);
      message.success($t('page.ops.successSave'));
    } else {
      await createParameterLogApi(payload);
      message.success($t('page.ops.successSave'));
    }
    showAddEditModal.value = false;
    loadItems();
  } catch (err) {
    const errorFields = (err as { errorFields?: unknown })?.errorFields;
    if (!errorFields) {
      const responseData = (err as { response?: { data?: { message?: string } } })?.response?.data;
      const msg = responseData?.message || $t('page.ops.saveFailed');
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

function isOutOfRange(record: ParameterLogItem): boolean {
  if (!record || record.value === undefined || record.value === null || record.value === '') return false;
  const numVal = Number(record.value);
  if (isNaN(numVal)) return false;

  const paramObj = record.parameter || record.equipment_parameter;
  let minLimit: number | null = null;
  let maxLimit: number | null = null;

  if (paramObj) {
    if (paramObj.standard_min !== undefined && paramObj.standard_min !== null) minLimit = Number(paramObj.standard_min);
    else if (paramObj.min_value !== undefined && paramObj.min_value !== null) minLimit = Number(paramObj.min_value);
    else if (paramObj.lower_limit !== undefined && paramObj.lower_limit !== null) minLimit = Number(paramObj.lower_limit);

    if (paramObj.standard_max !== undefined && paramObj.standard_max !== null) maxLimit = Number(paramObj.standard_max);
    else if (paramObj.max_value !== undefined && paramObj.max_value !== null) maxLimit = Number(paramObj.max_value);
    else if (paramObj.upper_limit !== undefined && paramObj.upper_limit !== null) maxLimit = Number(paramObj.upper_limit);
  }

  if (minLimit === null && maxLimit === null) {
    const equip = equipments.value.find((e) => e.id === record.equipment_id);
    const param = equip?.equipment_parameters?.find((p) => p.id === record.equipment_parameter_id);
    if (param) {
      if (param.standard_min !== undefined && param.standard_min !== null) minLimit = Number(param.standard_min);
      else if (param.min_value !== undefined && param.min_value !== null) minLimit = Number(param.min_value);
      else if (param.lower_limit !== undefined && param.lower_limit !== null) minLimit = Number(param.lower_limit);

      if (param.standard_max !== undefined && param.standard_max !== null) maxLimit = Number(param.standard_max);
      else if (param.max_value !== undefined && param.max_value !== null) maxLimit = Number(param.max_value);
      else if (param.upper_limit !== undefined && param.upper_limit !== null) maxLimit = Number(param.upper_limit);
    }
  }

  if (minLimit !== null && !isNaN(minLimit) && numVal < minLimit) return true;
  if (maxLimit !== null && !isNaN(maxLimit) && numVal > maxLimit) return true;

  return false;
}

function getTableRowClassName(record: ParameterLogItem) {
  if (isSoftDeleted(record)) {
    return softDeletedRowClass(record);
  }
  if (isOutOfRange(record)) {
    return 'bg-red-50/90 dark:bg-red-950/40 text-red-900 dark:text-red-200 font-medium';
  }
  return '';
}

const columns = computed(() => [
  {
    title: $t('page.ops.colEquipment'),
    dataIndex: 'equipment_id',
    key: 'equipment_id',
  },
  {
    title: $t('page.ops.parameter'),
    dataIndex: 'equipment_parameter_id',
    key: 'equipment_parameter_id',
  },
  {
    title: $t('page.ops.value'),
    dataIndex: 'value',
    key: 'value',
  },
  {
    title: $t('page.ops.recordedAt'),
    dataIndex: 'recorded_at',
    key: 'recorded_at',
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    align: 'center' as const,
    width: 140,
    fixed: 'right' as const,
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Embedded Weekly Parameter Multi-Line Chart Component -->
    <div
      v-if="showEmbeddedChart"
      class="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4 transition-all duration-300"
    >
      <div class="flex items-center justify-between border-b border-border pb-3">
        <div class="flex items-center gap-2">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">
            {{ $t('page.ops.weeklyChartTitle') }}
          </h3>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {{ $t('page.ops.colEquipment') }}:
          </span>
          <Select
            v-model:value="selectedEquipmentFilter"
            :options="equipments"
            :field-names="{ label: 'name', value: 'id' }"
            :placeholder="$t('page.ops.selectEquipment')"
            class="w-64"
            allow-clear
            show-search
            option-filter-prop="name"
          />
          <Button
            size="small"
            type="text"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            @click="showEmbeddedChart = false"
          >
            ✕
          </Button>
        </div>
      </div>

      <WeeklyParameterChart
        :equipment-id="chartEquipmentId"
        :equipments="equipments"
        :units="units"
      />
    </div>
    <!-- Inline Parameter Line Chart Component (shown when parameter is selected) -->
    <ParameterLineChart
      v-if="selectedParameterFilter && showBarChart"
      :items="filteredItems"
      :units="units"
      :parameter-id="selectedParameterFilter"
      :equipment-id="selectedEquipmentFilter"
      :equipments="equipments"
    />

    <!-- Filter and Action Bar -->
    <div class="action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3 w-full">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.equipment.placeholderName')"
        class="max-w-[200px]"
        allow-clear
        @press-enter="handleSearch"
      />
      <Select
        v-model:value="selectedEquipmentFilter"
        :options="equipments"
        :field-names="{ label: 'name', value: 'id' }"
        :placeholder="$t('page.ops.selectEquipment')"
        allow-clear
        show-search
        option-filter-prop="name"
        class="w-[200px]"
      />
      <Select
        v-model:value="selectedParameterFilter"
        :options="filterParameters"
        :field-names="{ label: 'name', value: 'id' }"
        :placeholder="$t('page.ops.selectParameter')"
        allow-clear
        show-search
        option-filter-prop="name"
        class="w-[220px]"
      />
      <RangePicker
        v-model:value="dateRangeFilter"
        format="YYYY-MM-DD"
        :placeholder="[$t('page.ops.startDate'), $t('page.ops.endDate')]"
        allow-clear
        class="w-[260px]"
      />
      <Button type="default" @click="handleSearch">
        {{ $t('page.company.btnFilter') }}
      </Button>
      <Button type="default" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>
      <Button
        type="primary"
        :disabled="!selectedParameterFilter"
        class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium border-blue-600"
        @click="showBarChart = !showBarChart"
      >
        {{ showBarChart ? $t('page.ops.btnHideCharts') : $t('page.ops.btnShowBarChart') }}
      </Button>

      <div class="ml-auto flex items-center gap-2">
        <Button
          type="default"
          class="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 font-medium"
          @click="showImportModal = true"
        >
          {{ $t('page.ops.btnImportParameters') }}
        </Button>

        <Button
          type="default"
          class="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 font-medium"
          @click="openBatchSaveModal"
        >
          {{ $t('page.ops.btnBatchSave') }}
        </Button>

        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white"
          @click="openAddModal"
        >
          {{ $t('page.ops.btnAddRecord') }}
        </Button>
      </div>
    </div>
    <!-- Data Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredItems"
          row-key="id"
          :row-class-name="(record) => getTableRowClassName(record as ParameterLogItem)"
          :scroll="{ x: 'max-content' }"
          :pagination="{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (tot: number) => $t('page.equipment.totalRecords', { total: tot }),
          }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'equipment_id'">
              <div class="flex items-center gap-1.5">
                <span class="dark:text-gray-100">
                  {{ record.equipment?.name || getEquipmentName(record.equipment_id) }}
                </span>
                <Tooltip title="View Overview">
                </Tooltip>
              </div>
            </template>

            <template v-else-if="column.key === 'equipment_parameter_id'">
              <span>
                {{ formatParameterName(record as ParameterLogItem) }}
              </span>
            </template>

            <template v-else-if="column.key === 'value'">
              <span class="font-semibold text-slate-700 dark:text-gray-200">
                {{ record.value }}{{ getUnitSuffix(record.unit_id) }}
              </span>
            </template>

            <template v-else-if="column.key === 'recorded_at'">
              <span>
                {{ record.recorded_at ? dayjs(record.recorded_at).format('YYYY-MM-DD HH:mm:ss') : (record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-') }}
              </span>
            </template>

            <template v-else-if="column.key === 'actions'">
              <div class="flex items-center justify-center space-x-2">
                <Button
                  size="small"
                  :disabled="isSoftDeleted(record as ParameterLogItem)"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as ParameterLogItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>

                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  :ok-text="$t('page.ops.btnOk')"
                  :cancel-text="$t('page.ops.btnCancel')"
                  @confirm="handleDelete(record.id)"
                >
                  <Button
                    size="small"
                    danger
                    :disabled="isSoftDeleted(record as ParameterLogItem)"
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

    <!-- Add/Edit Single Log Modal (POST / & PUT /{id}) -->
    <Modal
      v-model:open="showAddEditModal"
      :title="isEditing ? $t('page.ops.editParameterLog') : $t('page.ops.addParameterLog')"
      :confirm-loading="submitting"
      :ok-text="$t('page.ops.btnOk')"
      :cancel-text="$t('page.ops.btnCancel')"
      width="800px"
      @ok="handleAddEditOk"
      @cancel="showAddEditModal = false"
    >
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id">
            <Select
              v-model:value="formState.equipment_id"
              :options="equipments"
              :field-names="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectEquipment')"
              class="w-full"
              show-search
              option-filter-prop="name"
            />
          </FormItem>

          <FormItem :label="$t('page.ops.parameter')" name="equipment_parameter_id">
            <Select
              v-model:value="formState.equipment_parameter_id"
              :options="availableParameters"
              :field-names="{ label: 'displayName', value: 'id' }"
              :placeholder="$t('page.ops.selectParameter')"
              :disabled="!formState.equipment_id"
              class="w-full"
              show-search
              option-filter-prop="displayName"
            />
          </FormItem>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.value')" name="value">
            <Input v-model:value="formState.value" :placeholder="$t('page.ops.value')" />
          </FormItem>
          <FormItem :label="$t('page.ops.unit')" name="unit_id">
            <Select
              v-model:value="formState.unit_id"
              :options="units"
              :field-names="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectUnit')"
              disabled
              class="w-full"
            />
          </FormItem>
        </div>

        <FormItem :label="$t('page.ops.recordedAt')" name="recorded_at">
          <DatePicker
            v-model:value="recordedAtForm"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            class="w-full"
          />
        </FormItem>
      </Form>
    </Modal>

    <!-- Batch Save Parameters Modal (POST /save) -->
    <ParameterBatchSaveModal
      v-model:open="showBatchSaveModal"
      :equipments="equipments"
      :units="units"
      @success="loadItems"
    />

    <!-- Import Equipment Parameters Modal (POST /import) -->
    <ParameterImportModal
      v-model:open="showImportModal"
      @success="loadItems"
    />
  </div>
</template>
