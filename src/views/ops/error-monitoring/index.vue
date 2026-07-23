<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import {
  Table,
  Button,
  Popconfirm,
  message,
  Spin,
  Tag,
  Input,
} from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';
import { isSoftDeleted, softDeletedRowClass, sortBySoftDeleted } from '#/utils/soft-delete';
import EquipmentErrorCategoryModal from './components/EquipmentErrorCategoryModal.vue';
import ErrorLogFormModal from './components/ErrorLogFormModal.vue';

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
  occurred_at?: string | null;
  restarted_at?: string | null;
  handled_at?: string | null;
  created_at?: string;
  updated_at?: string;
  handler_ids?: string[];
  handled_time?: number;
  is_synced?: boolean;
  equipment?: { name: string; code: string };
  equipment_error?: { name: string };
  handlers?: Array<{ id: string; name: string }>;
  deleted_at?: string | null;
}

const loading = ref(false);
const syncingAll = ref(false);
const syncingId = ref<string | null>(null);
const items = ref<ErrorLogItem[]>([]);

function getRowClassName(record: ErrorLogItem): string {
  return [
    softDeletedRowClass(record),
    record.is_synced ? 'opacity-40 pointer-events-none bg-gray-50/20 dark:bg-zinc-900/10' : '',
  ].filter(Boolean).join(' ');
}

const equipments = ref<EquipmentOption[]>([]);
const users = ref<UserOption[]>([]);
const allMasterErrors = ref<ErrorOption[]>([]);

// Modal States
const showCreateErrorCategoryModal = ref(false);
const showErrorLogModal = ref(false);
const isEditing = ref(false);
const selectedRecord = ref<ErrorLogItem | null>(null);

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

interface RawEquipmentItem {
  id: string;
  code: string;
  name?: string;
  equipment_errors?: ErrorOption[];
}

interface RawUserItem {
  id: string;
  name: string;
}

async function loadInitialData() {
  try {
    const equipRes = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { paginate: 'false' },
    });
    // API trả về mảng trực tiếp khi paginate=false, hoặc { data: [...] } nếu paginated
    const rawEquip = equipRes.data;
    const equipData: RawEquipmentItem[] = Array.isArray(rawEquip)
      ? rawEquip
      : (rawEquip?.data ?? []);
    equipments.value = equipData.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      equipment_errors: item.equipment_errors || [],
    }));

    const usersRes = await axios.get(`${API_BASE_URL}/users`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const usersData: RawUserItem[] = usersRes.data?.data ?? usersRes.data ?? [];
    users.value = usersData.map((item) => ({
      id: item.id,
      name: item.name,
    }));

    const errorsRes = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const errorsData = errorsRes.data?.data ?? errorsRes.data ?? [];
    const errorsListArray = Array.isArray(errorsData) ? errorsData : [];
    allMasterErrors.value = errorsListArray
      .map((item: { id?: string; name?: string }) => ({
        id: item.id || '',
        name: item.name || '',
      }))
      .filter((item) => item.id.length > 0);
  } catch (error: unknown) {
    console.error('Failed to load metadata', error);
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`, {
      headers: getAuthHeaders(),
      params: { with_trashed: true },
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
  const equip = equipments.value.find((e) => e.id === id);
  return equip ? `${equip.name} (${equip.code})` : id;
}

function getErrorName(record: ErrorLogItem) {
  if (record.equipment_error?.name) {
    return record.equipment_error.name;
  }
  const equip = equipments.value.find((e) => e.id === record.equipment_id);
  const err = equip?.equipment_errors?.find((e) => e.id === record.equipment_error_id);
  if (err?.name) return err.name;
  const masterErr = allMasterErrors.value.find((e) => e.id === record.equipment_error_id);
  return masterErr ? masterErr.name : record.equipment_error_id;
}

function getHandlersText(record: ErrorLogItem) {
  if (record.handlers && record.handlers.length > 0) {
    return record.handlers.map((h) => h.name).join(', ');
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
    res = res.filter((item) => {
      const equipName = getEquipmentName(item.equipment_id).toLowerCase();
      const errName = getErrorName(item).toLowerCase();
      const handlerName = getHandlersText(item).toLowerCase();
      return equipName.includes(q) || errName.includes(q) || handlerName.includes(q);
    });
  }
  return sortBySoftDeleted(
    [...res].sort((a, b) => {
      const aSynced = a.is_synced ? 1 : 0;
      const bSynced = b.is_synced ? 1 : 0;
      if (aSynced !== bSynced) {
        return aSynced - bSynced;
      }
      const aTime = a.occurred_at
        ? new Date(a.occurred_at).getTime()
        : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const bTime = b.occurred_at
        ? new Date(b.occurred_at).getTime()
        : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return bTime - aTime;
    }),
  );
});

function openAddModal() {
  isEditing.value = false;
  selectedRecord.value = null;
  showErrorLogModal.value = true;
}

function openCreateErrorModal() {
  showCreateErrorCategoryModal.value = true;
}

function openEditModal(record: ErrorLogItem) {
  isEditing.value = true;
  selectedRecord.value = record;
  showErrorLogModal.value = true;
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

async function syncOneResolved(id: string) {
  syncingId.value = id;
  try {
    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/${id}/sync-resolved`,
      {},
      { headers: getAuthHeaders() },
    );
    message.success($t('page.ops.syncSuccess'));
    await loadInitialData();
    await loadItems();
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message || $t('page.ops.syncFailed'));
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
      { headers: getAuthHeaders() },
    );
    message.success(res.data?.message || $t('page.ops.syncSuccess'));
    await loadInitialData();
    await loadItems();
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    message.error(axiosErr?.response?.data?.message || $t('page.ops.syncFailed'));
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
  },
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
          ok-text="Yes"
          cancel-text="No"
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
          type="default"
          class="rounded-md font-medium border-emerald-600 text-emerald-600 hover:bg-emerald-50"
          @click="openCreateErrorModal"
        >
          {{ $t('page.ops.btnCreateEquipmentError') }}
        </Button>
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
          :row-class-name="getRowClassName"
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
              <Tag v-else-if="record.occurred_at" color="red">Active Error</Tag>
              <Tag v-else color="blue">Definition</Tag>
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
                  :disabled="isSoftDeleted(record as ErrorLogItem)"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as ErrorLogItem)"
                >
                  {{ $t('page.ops.editErrorLog') }}
                </Button>
                <Popconfirm
                  v-if="record.handled_at && !record.is_synced"
                  :title="$t('page.ops.syncConfirmOne')"
                  ok-text="Yes"
                  cancel-text="No"
                  @confirm="syncOneResolved(record.id)"
                >
                  <Button
                    size="small"
                    :disabled="isSoftDeleted(record as ErrorLogItem)"
                    :loading="syncingId === record.id"
                    class="rounded border-blue-400 text-blue-600 hover:bg-blue-50"
                  >
                    {{ $t('page.ops.syncResolvedOne') }}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  ok-text="Yes"
                  cancel-text="No"
                  @confirm="handleDelete(record.id)"
                >
                  <Button
                    size="small"
                    danger
                    :disabled="isSoftDeleted(record as ErrorLogItem)"
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

    <!-- Sub-components for Modals -->
    <EquipmentErrorCategoryModal
      v-model:open="showCreateErrorCategoryModal"
      :equipments="equipments"
      :all-master-errors="allMasterErrors"
      :users="users"
      @success="async () => { await loadInitialData(); await loadItems(); }"
    />

    <ErrorLogFormModal
      v-model:open="showErrorLogModal"
      :is-editing="isEditing"
      :record="selectedRecord"
      :equipments="equipments"
      :users="users"
      :all-master-errors="allMasterErrors"
      @success="loadItems"
    />
  </div>
</template>
