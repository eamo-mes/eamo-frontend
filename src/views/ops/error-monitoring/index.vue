<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue';
import {
  Table,
  Button,
  Modal,
  Form,
  FormItem,
  Select,
  DatePicker,
  Popconfirm,
  message,
  Spin,
  Tag,
  Input
} from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';

interface UserOption {
  id: string;
  name: string;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  equipment_errors?: ErrorOption[];
}

interface ErrorLogItem {
  id: string;
  equipment_id: string;
  equipment_error_id: string;
  occurred_at: string;
  restarted_at?: string;
  handled_at?: string;
  handler_ids?: string[];
  handled_time?: number;
  is_synced?: boolean;
  equipment?: { name: string; code: string };
  equipment_error?: { name: string };
  handlers?: Array<{ id: string; name: string }>;
}

const loading = ref(false);
const submitting = ref(false);
const syncingAll = ref(false);
const syncingId = ref<string | null>(null);
const items = ref<ErrorLogItem[]>([]);
const equipments = ref<EquipmentOption[]>([]);
const users = ref<UserOption[]>([]);
const showModal = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);
const searchVal = ref('');
const activeSearch = ref('');

const formRef = ref();
const formState = ref({
  equipment_id: undefined as string | undefined,
  equipment_error_id: undefined as string | undefined,
  occurred_at: undefined as Dayjs | undefined,
  restarted_at: undefined as Dayjs | undefined,
  handled_at: undefined as Dayjs | undefined,
  handler_ids: [] as string[],
});

const rules = computed(() => ({
  equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
  equipment_error_id: [{ required: true, message: $t('page.ops.selectError') }],
  occurred_at: [{ required: true, message: $t('page.ops.occurredAt') }],
}));

// Computed list of errors for selected equipment
const availableErrors = computed(() => {
  if (!formState.value.equipment_id) return [];
  const equip = equipments.value.find(e => e.id === formState.value.equipment_id);
  return equip?.equipment_errors ?? [];
});

// Watch selected equipment to reset error
watch(() => formState.value.equipment_id, () => {
  formState.value.equipment_error_id = undefined;
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
      equipment_errors: item.equipment_errors || [],
    }));

    const usersRes = await axios.get(`${API_BASE_URL}/users`, {
      headers: getAuthHeaders(),
    });
    const usersData = usersRes.data?.data ?? usersRes.data ?? [];
    users.value = usersData.map((item: any) => ({
      id: item.id,
      name: item.name,
    }));
  } catch (error) {
    console.error('Failed to load metadata', error);
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`, {
      headers: getAuthHeaders(),
    });
    items.value = res.data?.data ?? res.data ?? [];
  } catch (error) {
    message.error('Failed to load error logs');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function getEquipmentName(id: string) {
  const equip = equipments.value.find(e => e.id === id);
  return equip ? `${equip.name} (${equip.code})` : id;
}

function getErrorName(record: ErrorLogItem) {
  if (record.equipment_error?.name) {
    return record.equipment_error.name;
  }
  const equip = equipments.value.find(e => e.id === record.equipment_id);
  const err = equip?.equipment_errors?.find(e => e.id === record.equipment_error_id);
  return err ? err.name : record.equipment_error_id;
}

function getHandlersText(record: ErrorLogItem) {
  if (record.handlers && record.handlers.length > 0) {
    return record.handlers.map(h => h.name).join(', ');
  }
  return '-';
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
  let res = items.value;
  if (activeSearch.value) {
    const q = activeSearch.value.toLowerCase();
    res = res.filter(item => {
      const equipName = getEquipmentName(item.equipment_id).toLowerCase();
      const errName = getErrorName(item).toLowerCase();
      const handlerName = getHandlersText(item).toLowerCase();
      return equipName.includes(q) || errName.includes(q) || handlerName.includes(q);
    });
  }
  return [...res].sort((a, b) => {
    const aSynced = a.is_synced ? 1 : 0;
    const bSynced = b.is_synced ? 1 : 0;
    if (aSynced !== bSynced) {
      return aSynced - bSynced; // 0 (unsynced) first, 1 (synced) last
    }
    const aTime = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
    const bTime = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
    return bTime - aTime;
  });
});

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    equipment_id: undefined,
    equipment_error_id: undefined,
    occurred_at: dayjs(),
    restarted_at: undefined,
    handled_at: undefined,
    handler_ids: [],
  };
  showModal.value = true;
}

function openEditModal(record: ErrorLogItem) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    equipment_id: record.equipment_id,
    equipment_error_id: record.equipment_error_id,
    occurred_at: record.occurred_at ? dayjs(record.occurred_at) : undefined,
    restarted_at: record.restarted_at ? dayjs(record.restarted_at) : undefined,
    handled_at: record.handled_at ? dayjs(record.handled_at) : undefined,
    handler_ids: record.handlers ? record.handlers.map(h => h.id) : [],
  };
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/${id}`, {
      headers: getAuthHeaders(),
    });
    message.success($t('page.ops.successDelete'));
    loadItems();
  } catch (error) {
    message.error($t('page.ops.deleteFailed'));
    console.error(error);
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      equipment_id: formState.value.equipment_id,
      equipment_error_id: formState.value.equipment_error_id,
      occurred_at: formState.value.occurred_at ? formState.value.occurred_at.format('YYYY-MM-DD HH:mm:ss') : null,
      restarted_at: formState.value.restarted_at ? formState.value.restarted_at.format('YYYY-MM-DD HH:mm:ss') : null,
      handled_at: formState.value.handled_at ? formState.value.handled_at.format('YYYY-MM-DD HH:mm:ss') : null,
      handler_ids: formState.value.handler_ids || [],
    };

    if (isEditing.value && editId.value) {
      await axios.put(`${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
      message.success($t('page.ops.successSave'));
    } else {
      await axios.post(`${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`, payload, {
        headers: getAuthHeaders(),
      });
      message.success($t('page.ops.successSave'));
    }
    showModal.value = false;
    loadItems();
  } catch (err: any) {
    if (!err?.errorFields) {
      const msg = err?.response?.data?.message || $t('page.ops.saveFailed');
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

async function syncOneResolved(id: string) {
  syncingId.value = id;
  try {
    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/${id}/sync-resolved`,
      {},
      { headers: getAuthHeaders() }
    );
    message.success($t('page.ops.syncSuccess'));
    await loadInitialData();
    await loadItems();
  } catch (error: any) {
    message.error(error?.response?.data?.message || $t('page.ops.syncFailed'));
  } finally {
    syncingId.value = null;
  }
}

async function syncAllResolved() {
  syncingAll.value = true;
  try {
    const res = await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/sync-resolved`,
      {},
      { headers: getAuthHeaders() }
    );
    message.success(res.data?.message || $t('page.ops.syncSuccess'));
    await loadInitialData();
    await loadItems();
  } catch (error: any) {
    message.error(error?.response?.data?.message || $t('page.ops.syncFailed'));
  } finally {
    syncingAll.value = false;
  }
}

const columns = computed(() => [
  {
    title: $t('page.ops.colEquipment'),
    dataIndex: 'equipment_id',
    key: 'equipment_id',
  },
  {
    title: 'Error',
    dataIndex: 'equipment_error_id',
    key: 'equipment_error_id',
  },
  {
    title: 'Status',
    key: 'status',
    align: 'center' as const,
  },
  {
    title: 'Occurred At',
    dataIndex: 'occurred_at',
    key: 'occurred_at',
  },
  {
    title: 'Restarted At',
    dataIndex: 'restarted_at',
    key: 'restarted_at',
  },
  {
    title: 'Handled At',
    dataIndex: 'handled_at',
    key: 'handled_at',
  },
  {
    title: 'Handler',
    key: 'handlers',
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    align: 'center' as const,
    width: 260,
    fixed: 'right' as const,
  }
]);
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
      <div class="ml-auto flex gap-2">
        <Popconfirm
          :title="$t('page.ops.syncConfirmAll')"
          :ok-text="$t('page.ops.btnOk')"
          :cancel-text="$t('page.ops.btnCancel')"
          @confirm="syncAllResolved"
        >
          <Button
            :loading="syncingAll"
            class="rounded-md font-medium border-blue-500 text-blue-600 hover:bg-blue-50"
          >
            {{ $t('page.ops.syncResolvedAll') }}
          </Button>
        </Popconfirm>
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full"
          @click="openAddModal"
        >
          {{ $t('page.ops.addErrorLog') }}
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
          :row-class-name="(record) => (record as ErrorLogItem).is_synced ? 'opacity-40 pointer-events-none bg-gray-50/20 dark:bg-zinc-900/10' : ''"
          :scroll="{ x: 'max-content' }"
          :pagination="{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (tot: number) => `Tổng ${tot} bản ghi`,
          }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'equipment_id'">
              <span>{{ getEquipmentName(record.equipment_id) }}</span>
            </template>
            <template v-else-if="column.key === 'equipment_error_id'">
              <span>{{ getErrorName(record as ErrorLogItem) }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag v-if="record.handled_at" color="green">Resolved</Tag>
              <Tag v-else-if="record.restarted_at" color="orange">Restarted</Tag>
              <Tag v-else color="red">Active Error</Tag>
            </template>
            <template v-else-if="column.key === 'occurred_at'">
              <span>{{ record.occurred_at ? dayjs(record.occurred_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}</span>
            </template>
            <template v-else-if="column.key === 'restarted_at'">
              <span>{{ record.restarted_at ? dayjs(record.restarted_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}</span>
            </template>
            <template v-else-if="column.key === 'handled_at'">
              <span>{{ record.handled_at ? dayjs(record.handled_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}</span>
            </template>
            <template v-else-if="column.key === 'handlers'">
              <span>{{ getHandlersText(record as ErrorLogItem) }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="flex items-center gap-2 justify-center">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as ErrorLogItem)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  v-if="record.handled_at && !record.is_synced"
                  :title="$t('page.ops.syncConfirmOne')"
                  :ok-text="$t('page.ops.btnOk')"
                  :cancel-text="$t('page.ops.btnCancel')"
                  @confirm="syncOneResolved(record.id)"
                >
                  <Button
                    size="small"
                    :loading="syncingId === record.id"
                    class="rounded border-blue-400 text-blue-600 hover:bg-blue-50"
                  >
                    {{ $t('page.ops.syncResolvedOne') }}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  :ok-text="$t('page.ops.btnOk')"
                  :cancel-text="$t('page.ops.btnCancel')"
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
      :title="isEditing ? $t('page.ops.editErrorLog') : $t('page.ops.addErrorLog')"
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
        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id">
            <Select
              v-model:value="formState.equipment_id"
              :options="equipments"
              :fieldNames="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectEquipment')"
              class="w-full"
            />
          </FormItem>

          <FormItem :label="$t('page.ops.error')" name="equipment_error_id">
            <Select
              v-model:value="formState.equipment_error_id"
              :options="availableErrors"
              :fieldNames="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectError')"
              :disabled="!formState.equipment_id"
              class="w-full"
            />
          </FormItem>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.occurredAt')" name="occurred_at">
            <DatePicker v-model:value="formState.occurred_at" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
          </FormItem>

          <FormItem :label="$t('page.ops.handledAt')" name="handled_at">
            <DatePicker v-model:value="formState.handled_at" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" allowClear />
          </FormItem>
        </div>

        <div class="border-t border-gray-100 dark:border-gray-700 pt-4">
          <FormItem :label="$t('page.ops.handler')" name="handler_ids">
            <Select
              v-model:value="formState.handler_ids"
              mode="multiple"
              :options="users"
              :fieldNames="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectHandler')"
              allowClear
              class="w-full"
            />
          </FormItem>
        </div>
      </Form>
    </Modal>
  </div>
</template>
