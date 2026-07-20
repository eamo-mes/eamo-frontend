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

interface UnitItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at?: string;
}

const loading = ref(false);
const submitting = ref(false);
const units = ref<UnitItem[]>([]);
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

async function loadUnits(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const params: Record<string, number | string> = {
      page,
      per_page: size,
    };
    if (activeSearch.value) {
      params.q = activeSearch.value;
    }
    const res = await axios.get(`${API_BASE_URL}/v1/units`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    units.value = Array.isArray(raw) ? raw : [];
    total.value = res.data?.total ?? units.value.length;
    currentPage.value = res.data?.current_page ?? page;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message || $t('page.equipment.msgLoadUnitsError'));
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadUnits(1);
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  currentPage.value = 1;
  loadUnits(1);
}

function handleTableChange(pagination: { current: number; pageSize: number }) {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  loadUnits(pagination.current, pagination.pageSize);
}

const filteredUnits = computed(() => units.value);

const columns = computed(() => [
  {
    title: $t('page.equipment.colCode'),
    dataIndex: 'code',
    key: 'code',
    sorter: (a: UnitItem, b: UnitItem) => a.code.localeCompare(b.code),
  },
  {
    title: $t('page.equipment.colName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: UnitItem, b: UnitItem) => a.name.localeCompare(b.name),
  },
  {
    title: $t('page.equipment.colDescription'),
    dataIndex: 'description',
    key: 'description',
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
  code: '',
  name: '',
  description: '',
});

const rules = computed(() => ({
  code: [{ required: true, message: $t('page.equipment.validationCode') }],
  name: [{ required: true, message: $t('page.equipment.validationName') }],
}));

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    code: '',
    name: '',
    description: '',
  };
  showModal.value = true;
}

function openEditModal(record: UnitItem) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    code: record.code,
    name: record.name,
    description: record.description || '',
  };
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/units/${id}`, {
      headers: getAuthHeaders(),
    });
    units.value = units.value.filter(u => u.id !== id);
    message.success($t('page.equipment.msgDeleteUnitSuccess'));
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message || $t('page.equipment.msgDeleteUnitError'));
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      code: formState.value.code,
      name: formState.value.name,
      description: formState.value.description || null,
    };

    if (isEditing.value && editId.value) {
      const res = await axios.put(`${API_BASE_URL}/v1/units/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
      const updated = res.data?.data ?? res.data;
      const idx = units.value.findIndex(u => u.id === editId.value);
      if (idx !== -1 && updated) units.value[idx] = updated;
      message.success($t('page.equipment.msgUpdateUnitSuccess'));
      await loadUnits(); // Reload to be safe
    } else {
      const res = await axios.post(`${API_BASE_URL}/v1/units`, payload, {
        headers: getAuthHeaders(),
      });
      const created = res.data?.data ?? res.data;
      if (created) units.value.push(created);
      message.success($t('page.equipment.msgCreateUnitSuccess'));
      await loadUnits(); // Reload to be safe
    }
    showModal.value = false;
  } catch (err: unknown) {
    const formErr = err as { errorFields?: unknown[] };
    if (formErr?.errorFields) {
      // Validation error
    } else {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || $t('page.equipment.msgSaveUnitError');
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadUnits();
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
          {{ $t('page.equipment.btnAddUnit') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredUnits"
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
            <template v-if="column.key === 'description'">
              <span>{{ record.description || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as UnitItem)"
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
      :title="isEditing ? $t('page.equipment.btnEditUnit') : $t('page.equipment.btnAddUnit')"
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
        <FormItem :label="$t('page.equipment.colCode')" name="code">
          <Input v-model:value="formState.code" :placeholder="$t('page.equipment.placeholderCode')" :disabled="isEditing" />
        </FormItem>
        <FormItem :label="$t('page.equipment.colName')" name="name">
          <Input v-model:value="formState.name" :placeholder="$t('page.equipment.placeholderName')" />
        </FormItem>
        <FormItem :label="$t('page.equipment.colDescription')" name="description">
          <Input.TextArea v-model:value="formState.description" :placeholder="$t('page.equipment.placeholderDescription')" :rows="3" />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>
