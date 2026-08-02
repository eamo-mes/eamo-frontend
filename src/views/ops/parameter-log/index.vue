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
  Popconfirm,
  message,
  Spin,
  Space,
  Tag
} from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';

interface UnitOption {
  id: string;
  name: string;
}

interface ParameterOption {
  id: string;
  code: string;
  name: string;
  unit_id: string | null;
}

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  equipment_parameters?: ParameterOption[];
}

interface ParameterLogItem {
  id: string;
  equipment_id: string;
  equipment_parameter_id: string;
  product_id?: string;
  lot_id?: string;
  unit_id?: string;
  value: string;
  component_id?: string;
  created_at: string;
  equipment?: { name: string; code: string };
  parameter?: { name: string; code: string };
  unit?: { name: string };
}

const loading = ref(false);
const submitting = ref(false);
const items = ref<ParameterLogItem[]>([]);
const equipments = ref<EquipmentOption[]>([]);
const units = ref<UnitOption[]>([]);
const showModal = ref(false);
const isEditing = ref(ref(false));
const editId = ref<string | null>(null);
const searchVal = ref('');
const activeSearch = ref('');

const formRef = ref();
const formState = ref({
  equipment_id: undefined as string | undefined,
  equipment_parameter_id: undefined as string | undefined,
  product_id: '',
  lot_id: '',
  unit_id: undefined as string | undefined,
  value: '',
  component_id: '',
});

const rules = computed(() => ({
  equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
  equipment_parameter_id: [{ required: true, message: $t('page.ops.selectParameter') }],
  value: [{ required: true, message: $t('page.ops.value') }],
}));

// Computed list of parameters for selected equipment
const availableParameters = computed(() => {
  if (!formState.value.equipment_id) return [];
  const equip = equipments.value.find(e => e.id === formState.value.equipment_id);
  return equip?.equipment_parameters ?? [];
});

// Watch selected equipment to reset parameter
watch(() => formState.value.equipment_id, () => {
  formState.value.equipment_parameter_id = undefined;
});

// Watch selected parameter to auto-select unit
watch(() => formState.value.equipment_parameter_id, (newVal) => {
  if (newVal) {
    const param = availableParameters.value.find(p => p.id === newVal);
    if (param && param.unit_id) {
      formState.value.unit_id = param.unit_id;
    }
  } else {
    formState.value.unit_id = undefined;
  }
});

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadInitialData() {
  try {
    const equipRes = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
    });
    const equipData = equipRes.data?.data ?? equipRes.data ?? [];
    equipments.value = equipData.map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      equipment_parameters: item.equipment_parameters || [],
    }));

    const unitRes = await axios.get(`${API_BASE_URL}/v1/units`, {
      headers: getAuthHeaders(),
    });
    units.value = unitRes.data?.data ?? unitRes.data ?? [];
  } catch (error) {
    console.error('Failed to load initial metadata', error);
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/equipment-parameter/logs`, {
      headers: getAuthHeaders(),
    });
    items.value = res.data?.data ?? res.data ?? [];
  } catch (error) {
    message.error('Failed to load parameter logs');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function getEquipmentName(id: string) {
  const equip = equipments.value.find(e => e.id === id);
  return equip ? `${equip.name} (${equip.code})` : id;
}

function getParameterName(equipId: string, paramId: string) {
  const equip = equipments.value.find(e => e.id === equipId);
  const param = equip?.equipment_parameters?.find(p => p.id === paramId);
  return param ? `${param.name} (${param.code})` : paramId;
}

function getUnitSuffix(unitId: string | null | undefined) {
  if (!unitId) return '';
  const unit = units.value.find(u => u.id === unitId);
  return unit ? ` ${unit.name}` : '';
}

onMounted(() => {
  loadInitialData();
  loadItems();
});

function handleSearch() {
  activeSearch.value = searchVal.value;
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
}

const filteredItems = computed(() => {
  if (!activeSearch.value) return items.value;
  const q = activeSearch.value.toLowerCase();
  return items.value.filter(item => {
    const equipName = getEquipmentName(item.equipment_id).toLowerCase();
    const paramName = getParameterName(item.equipment_id, item.equipment_parameter_id).toLowerCase();
    const val = String(item.value).toLowerCase();
    return equipName.includes(q) || paramName.includes(q) || val.includes(q);
  });
});

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    equipment_id: undefined,
    equipment_parameter_id: undefined,
    product_id: '',
    lot_id: '',
    unit_id: undefined,
    value: '',
    component_id: '',
  };
  showModal.value = true;
}

function openEditModal(record: ParameterLogItem) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    equipment_id: record.equipment_id,
    equipment_parameter_id: record.equipment_parameter_id,
    product_id: record.product_id || '',
    lot_id: record.lot_id || '',
    unit_id: record.unit_id,
    value: record.value,
    component_id: record.component_id || '',
  };
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/equipment/equipment-parameter/logs/${id}`, {
      headers: getAuthHeaders(),
    });
    message.success($t('page.ops.successDelete'));
    loadItems();
  } catch (error) {
    message.error('Xóa thất bại');
    console.error(error);
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      equipment_id: formState.value.equipment_id,
      equipment_parameter_id: formState.value.equipment_parameter_id,
      product_id: formState.value.product_id || null,
      lot_id: formState.value.lot_id || null,
      unit_id: formState.value.unit_id || null,
      value: formState.value.value,
      component_id: formState.value.component_id || null,
    };

    if (isEditing.value && editId.value) {
      await axios.put(`${API_BASE_URL}/v1/equipment/equipment-parameter/logs/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
      message.success('Cập nhật bản ghi thành công');
    } else {
      await axios.post(`${API_BASE_URL}/v1/equipment/equipment-parameter/logs`, payload, {
        headers: getAuthHeaders(),
      });
      message.success('Thêm bản ghi thành công');
    }
    showModal.value = false;
    loadItems();
  } catch (err: any) {
    if (!err?.errorFields) {
      const msg = err?.response?.data?.message || 'Không thể lưu bản ghi';
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

const columns = computed(() => [
  {
    title: $t('page.ops.colEquipment'),
    dataIndex: 'equipment_id',
    key: 'equipment_id',
  },
  {
    title: 'Parameter',
    dataIndex: 'equipment_parameter_id',
    key: 'equipment_parameter_id',
  },
  {
    title: 'Value',
    dataIndex: 'value',
    key: 'value',
  },
  {
    title: 'Product / Lot',
    key: 'product_lot',
  },
  {
    title: 'Logged Time',
    dataIndex: 'created_at',
    key: 'created_at',
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    align: 'center' as const,
    width: 160,
    fixed: 'right' as const,
  }
]);
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
          Thêm bản ghi
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredItems"
          row-key="id"
          :scroll="{ x: 'max-content' }"
          :pagination="{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (tot: number) => $t('page.totalRecords', { total: tot }),
          }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'equipment_id'">
              <span>{{ getEquipmentName(record.equipment_id) }}</span>
            </template>
            <template v-else-if="column.key === 'equipment_parameter_id'">
              <span>{{ getParameterName(record.equipment_id, record.equipment_parameter_id) }}</span>
            </template>
            <template v-else-if="column.key === 'value'">
              <span class="font-semibold text-gray-800 dark:text-gray-200">
                {{ record.value }}{{ getUnitSuffix(record.unit_id) }}
              </span>
            </template>
            <template v-else-if="column.key === 'product_lot'">
              <span v-if="!record.product_id && !record.lot_id">—</span>
              <Space v-else direction="vertical" size="small">
                <Tag v-if="record.product_id" color="blue">Product: {{ record.product_id }}</Tag>
                <Tag v-if="record.lot_id" color="purple">Lot: {{ record.lot_id }}</Tag>
              </Space>
            </template>
            <template v-else-if="column.key === 'created_at'">
              <span>{{ record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as ParameterLogItem)"
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
      :title="isEditing ? $t('page.ops.editParameterLog') : $t('page.ops.addParameterLog')"
      :confirm-loading="submitting"
      :ok-text="$t('page.ops.btnOk')"
      :cancel-text="$t('page.ops.btnCancel')"
      width="650px"
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
        <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id">
          <Select
            v-model:value="formState.equipment_id"
            :options="equipments"
            :fieldNames="{ label: 'name', value: 'id' }"
            :placeholder="$t('page.ops.selectEquipment')"
            class="w-full"
          />
        </FormItem>

        <FormItem :label="$t('page.ops.parameter')" name="equipment_parameter_id">
          <Select
            v-model:value="formState.equipment_parameter_id"
            :options="availableParameters"
            :fieldNames="{ label: 'name', value: 'id' }"
            :placeholder="$t('page.ops.selectParameter')"
            :disabled="!formState.equipment_id"
            class="w-full"
          />
        </FormItem>

        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.value')" name="value">
            <Input v-model:value="formState.value" :placeholder="$t('page.ops.value')" />
          </FormItem>
          <FormItem :label="$t('page.ops.unit')" name="unit_id">
            <Select
              v-model:value="formState.unit_id"
              :options="units"
              :fieldNames="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectUnit')"
              allowClear
              class="w-full"
            />
          </FormItem>
        </div>

        <div class="grid grid-cols-3 gap-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          <FormItem :label="$t('page.ops.productId')" name="product_id">
            <Input v-model:value="formState.product_id" :placeholder="$t('page.ops.optional')" />
          </FormItem>
          <FormItem :label="$t('page.ops.lotId')" name="lot_id">
            <Input v-model:value="formState.lot_id" :placeholder="$t('page.ops.optional')" />
          </FormItem>
          <FormItem :label="$t('page.ops.componentId')" name="component_id">
            <Input v-model:value="formState.component_id" :placeholder="$t('page.ops.optional')" />
          </FormItem>
        </div>
      </Form>
    </Modal>
  </div>
</template>
