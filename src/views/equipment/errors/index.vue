<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
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
import { isSoftDeleted, softDeletedRowClass } from '#/utils/soft-delete';
import ErrorCharts from './error-charts.vue';

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
  deleted_at?: string | null;
}

const router = useRouter();

function goToEquipment(id: string) {
  router.push({ name: 'EquipmentDetail', query: { id } });
}

const expandedEquipment = ref<Record<string, boolean>>({});

function toggleExpand(id: string) {
  expandedEquipment.value[id] = !expandedEquipment.value[id];
}

const loading = ref(false);
const submitting = ref(false);
const errorsList = ref<ErrorItem[]>([]);
const equipments = ref<EquipmentOption[]>([]);
const searchVal = ref('');
const activeSearch = ref('');

// Chart States
const showCharts = ref(false);
const chartsLoading = ref(false);
const chartErrors = ref<ErrorItem[]>([]);

async function loadChartData() {
  chartsLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    chartErrors.value = Array.isArray(raw) ? raw : [];
  } catch (err) {
    message.error($t('page.ops.chartLoadError'));
  } finally {
    chartsLoading.value = false;
  }
}

async function toggleCharts() {
  showCharts.value = !showCharts.value;
  if (showCharts.value) {
    await loadChartData();
  }
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

async function loadEquipments() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadErrors(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const params: Record<string, string | number> = {
      page,
      per_page: size,
      with_trashed: 'true',
    };
    if (activeSearch.value) {
      params.q = activeSearch.value;
    }
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    errorsList.value = Array.isArray(raw) ? raw : [];
    total.value = res.data?.total ?? errorsList.value.length;
    currentPage.value = res.data?.current_page ?? page;
  } catch (err: unknown) {
    const errObj = err as { response?: { data?: { message?: string } } };
    message.error(errObj?.response?.data?.message || $t('page.equipment.msgLoadErrorsError'));
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadErrors(1);
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  currentPage.value = 1;
  loadErrors(1);
}

function handleTableChange(pagination: { current?: number; pageSize?: number }) {
  currentPage.value = pagination.current ?? 1;
  pageSize.value = pagination.pageSize ?? 10;
  loadErrors(pagination.current ?? 1, pagination.pageSize ?? 10);
}

const filteredErrors = computed(() => errorsList.value);

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
    width: 280,
  },
  {
    title: $t('page.equipment.colFix'),
    dataIndex: 'fix',
    key: 'fix',
    width: 280,
  },
  {
    title: $t('page.equipment.colProtection'),
    dataIndex: 'protection_measures',
    key: 'protection_measures',
    width: 280,
  },
  {
    title: $t('page.equipment.colEquipment'),
    dataIndex: 'equipment',
    key: 'equipment',
    width: 320,
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
  name: '',
  reason: '',
  fix: '',
  protection_measures: '',
  equipment_ids: [] as string[],
});

const rules = computed(() => ({
  name: [{ required: true, message: $t('page.equipment.validationName') }],
}));

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
    message.success($t('page.equipment.msgDeleteErrorSuccess'));
  } catch (err: unknown) {
    const errObj = err as { response?: { data?: { message?: string } } };
    message.error(errObj?.response?.data?.message || $t('page.equipment.msgDeleteErrorError'));
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
      message.success($t('page.equipment.msgUpdateErrorSuccess'));
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/equipment-errors`, payload, {
        headers: getAuthHeaders(),
      });
      const created = res.data;
      errorsList.value.push(created);
      message.success($t('page.equipment.msgCreateErrorSuccess'));
    }
    showModal.value = false;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errorFields' in err) {
      // Validation failed
    } else {
      const errObj = err as { response?: { data?: { message?: string } } };
      const msg = errObj?.response?.data?.message || $t('page.equipment.msgSaveErrorError');
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
    <!-- Chart Panel -->
    <ErrorCharts
      v-if="showCharts"
      :errors="chartErrors"
      :loading="chartsLoading"
    />

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

      <div class="ml-auto flex items-center gap-2">
        <Button type="default" @click="toggleCharts" :class="{ 'border-[#5c3e35] text-[#5c3e35]': showCharts }">
          {{ showCharts ? $t('page.ops.btnHideCharts') : $t('page.ops.btnShowCharts') }}
        </Button>
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
          :row-class-name="softDeletedRowClass"
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
            <template v-if="column.key === 'equipment'">
               <div class="flex flex-col gap-1 max-w-[320px]">
                  <div
                    class="flex flex-wrap gap-1 transition-all duration-300 ease-in-out overflow-hidden"
                    :class="expandedEquipment[record.id] ? 'max-h-[1000px]' : 'max-h-[52px]'"
                  >
                    <Tag
                      v-for="eq in record.equipment"
                      :key="eq.id"
                      color="blue"
                      class="cursor-pointer transition-all duration-200 hover:bg-[#1890ff] hover:text-white hover:border-[#1890ff] hover:-translate-y-0.5 hover:shadow-sm max-w-full truncate"
                      @click="goToEquipment(eq.id)"
                    >
                      {{ eq.name }} ({{ eq.code }})
                    </Tag>
                  </div>
                 <div v-if="record.equipment && record.equipment.length > 3">
                   <span
                     class="text-xs text-blue-500 hover:text-blue-700 cursor-pointer font-semibold inline-block mt-0.5 select-none"
                     @click="toggleExpand(record.id)"
                   >
                     {{ expandedEquipment[record.id] ? $t('page.equipment.btnCollapse') : $t('page.equipment.btnShowMore') }}
                   </span>
                 </div>
                 <span v-if="!record.equipment || record.equipment.length === 0" class="text-gray-400">—</span>
               </div>
             </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  :disabled="isSoftDeleted(record as ErrorItem)"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as ErrorItem)"
                >
                  {{ $t('page.company.btnEdit') }}
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
                    :disabled="isSoftDeleted(record as ErrorItem)"
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
      :ok-text="$t('page.equipment.modalConfirm')"
      :cancel-text="$t('page.equipment.modalCancel')"
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
