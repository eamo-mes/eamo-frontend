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
  Select,
  Space,
  DatePicker,
  Tag,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { isSoftDeleted, softDeletedRowClass, sortBySoftDeleted } from '#/utils/soft-delete';
import ExpandableContainer from '#/components/ExpandableContainer.vue';

interface EquipmentDetail {
  id: string;
  code: string;
  name: string;
}

interface ChecklistDetailItem {
  id: string;
  checklist_id: string;
  description: string;
  logs?: ChecklistLog[];
}

interface ChecklistLog {
  id: string;
  status: 'pending' | 'completed';
  result: 'pass' | 'fail' | null;
  checked_at?: string | null;
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
}

interface ChecklistSession {
  id: string;
  name?: string;
  equipment_id: string | null;
  equipment?: EquipmentDetail | null;
  session_date: string | null;
  schedule_mode?: string | null;
  details?: ChecklistDetailItem[];
  users?: UserDetail[];
  deleted_at?: string | null;
}

const router = useRouter();

const loading = ref(false);
const sessions = ref<ChecklistSession[]>([]);
const searchVal = ref('');
const activeSearch = ref('');

// Equipment filter
const equipments = ref<EquipmentDetail[]>([]);
const selectedEquipmentId = ref<string | undefined>(undefined);

// Date filters
const startDate = ref<string | undefined>(undefined);
const endDate = ref<string | undefined>(undefined);

// Pagination state
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

const showCharts = ref(false);
const chartStats = ref<unknown>(null);
const chartsLoading = ref(false);

async function loadChartData() {
  chartsLoading.value = true;
  try {
    const params: Record<string, string> = {};
    if (startDate.value) {
      params['start_date'] = startDate.value;
    }
    if (endDate.value) {
      params['end_date'] = endDate.value;
    }
    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions/equipment-status`, {
      headers: getAuthHeaders(),
      params,
    });
    chartStats.value = res.data;
  } catch {
    message.error($t('page.ops.chartLoadError'));
  } finally {
    chartsLoading.value = false;
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

async function loadEquipments() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadSessions(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const params: Record<string, string | number | boolean> = {
      include_details: true,
      page,
      per_page: size,
      with_trashed: true,
    };
    if (activeSearch.value) {
      params['search'] = activeSearch.value;
    }
    if (selectedEquipmentId.value) {
      params['equipment_id'] = selectedEquipmentId.value;
    }
    if (startDate.value) {
      params['start_date'] = startDate.value;
    }
    if (endDate.value) {
      params['end_date'] = endDate.value;
    }
    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    sessions.value = Array.isArray(raw) ? raw : [];
    // Read pagination meta from response
    total.value = res.data?.total ?? sessions.value.length;
    currentPage.value = res.data?.current_page ?? page;
    if (showCharts.value) {
      loadChartData();
    }
  } catch (err: unknown) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.message : null;
    message.error(apiError || $t('page.ops.loadChecklistListError'));
  } finally {
    loading.value = false;
  }
}

function handleDateChange() {
  currentPage.value = 1;
  loadSessions(1);
}

function handleEquipmentFilter(val: unknown) {
  selectedEquipmentId.value = typeof val === 'string' ? val : undefined;
  currentPage.value = 1;
  loadSessions(1);
}

function handleSearch() {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadSessions(1);
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  selectedEquipmentId.value = undefined;
  startDate.value = undefined;
  endDate.value = undefined;
  currentPage.value = 1;
  loadSessions(1);
}

function handleTableChange(pagination: { current?: number; pageSize?: number }) {
  const current = pagination.current ?? 1;
  const size = pagination.pageSize ?? 10;
  currentPage.value = current;
  pageSize.value = size;
  loadSessions(current, size);
}

// With server-side search, just use sessions directly
const filteredSessions = computed(() => sortBySoftDeleted(sessions.value));

const columns = computed(() => [
  {
    title: $t('page.ops.colName'),
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: $t('page.ops.colEquipment'),
    dataIndex: 'equipment_id',
    key: 'equipment',
  },
  {
    title: $t('page.ops.scheduleMode') || 'Chế độ lịch trình',
    dataIndex: 'schedule_mode',
    key: 'schedule_mode',
    width: 150,
  },
  {
    title: $t('page.ops.colDate'),
    dataIndex: 'session_date',
    key: 'session_date',
    sorter: (a: ChecklistSession, b: ChecklistSession) => {
      const timeA = a.session_date ? new Date(a.session_date).getTime() : 0;
      const timeB = b.session_date ? new Date(b.session_date).getTime() : 0;
      return timeA - timeB;
    },
  },
  {
    title: $t('page.ops.colExecutor'),
    key: 'created_by',
    width: 180,
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    width: 200,
    align: 'right' as const,
    fixed: 'right' as const,
  },
]);

function openAddPage() {
  router.push({ name: 'OpsCheckListDetail' });
}

function openEditPage(record: ChecklistSession) {
  router.push({
    name: 'OpsCheckListDetail',
    query: {
      id: record.id,
      equipment_id: record.equipment_id,
      date: record.session_date,
    },
  });
}

async function handleDelete(id: string) {
  try {
    loading.value = true;
    await axios.delete(`${API_BASE_URL}/v1/checklist-sessions/${id}`, {
      headers: getAuthHeaders(),
    });
    message.success('Xóa phiên kiểm tra thành công');
    await loadSessions();
  } catch (err: unknown) {
    const apiError = axios.isAxiosError(err) ? err.response?.data?.message : null;
    message.error(apiError || $t('page.ops.deleteChecklistError'));
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return dateStr;
  }
}

onMounted(() => {
  loadEquipments();
  loadSessions();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar -->
    <div class="action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.ops.searchPlaceholder')"
        class="w-[180px] shrink-0 flex-1"
        allow-clear
        @press-enter="handleSearch"
      />
      <Select
        v-model:value="selectedEquipmentId"
        :placeholder="$t('page.ops.filterByEquipment')"
        class="w-[200px] shrink-0"
        allow-clear
        option-filter-prop="label"
        show-search
        @change="handleEquipmentFilter"
        @clear="handleEquipmentFilter(undefined)"
      >
        <Select.Option
          v-for="eq in equipments"
          :key="eq.id"
          :value="eq.id"
          :label="`${eq.name} (${eq.code})`"
        >
          {{ eq.name }} <span class="text-gray-400 text-xs">({{ eq.code }})</span>
        </Select.Option>
      </Select>
      <DatePicker
        v-model:value="startDate"
        value-format="YYYY-MM-DD"
        format="YYYY-MM-DD"
        :placeholder="$t('page.ops.startDate')"
        class="w-[140px] shrink-0"
        @change="handleDateChange"
      />
      <DatePicker
        v-model:value="endDate"
        value-format="YYYY-MM-DD"
        format="YYYY-MM-DD"
        :placeholder="$t('page.ops.endDate')"
        class="w-[140px] shrink-0"
        @change="handleDateChange"
      />
      <Button type="default" class="shrink-0" @click="handleSearch">
        {{ $t('page.company.btnFilter') }}
      </Button>
      <Button type="default" class="shrink-0" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>
      <div class="ml-auto flex gap-2 shrink-0">
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full"
          @click="openAddPage"
        >
          {{ $t('page.ops.btnAddSession') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredSessions"
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
            <template v-if="column.key === 'name'">
              <span class="text-foreground">
                {{ (record as ChecklistSession).name || '—' }}
              </span>
            </template>

            <template v-else-if="column.key === 'equipment'">
              <span v-if="(record as ChecklistSession).equipment">
                {{ (record as ChecklistSession).equipment?.name }} ({{ (record as ChecklistSession).equipment?.code }})
              </span>
              <span v-else-if="(record as ChecklistSession).equipment_id">
                {{ (record as ChecklistSession).equipment_id }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </template>

            <template v-else-if="column.key === 'schedule_mode'">
              <Tag :color="(record as ChecklistSession).schedule_mode === 'single' ? 'blue' : 'green'">
                {{ (record as ChecklistSession).schedule_mode === 'single' ? 'Thêm lẻ' : 'Theo chu kỳ' }}
              </Tag>
            </template>

            <template v-else-if="column.key === 'session_date'">
              <span>{{ formatDate((record as ChecklistSession).session_date) }}</span>
            </template>

            <template v-else-if="column.key === 'created_by'">
              <ExpandableContainer :items="(record as ChecklistSession).users">
                <Tag v-for="user in (record as ChecklistSession).users" :key="user.id" color="blue">
                  {{ user.name }}
                </Tag>
              </ExpandableContainer>
            </template>

            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button
                  size="small"
                  :disabled="isSoftDeleted(record as ChecklistSession)"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditPage(record as ChecklistSession)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.ops.deleteConfirm')"
                  :ok-text="$t('page.ops.btnConfirm')"
                  :cancel-text="$t('page.ops.btnCancel')"
                  @confirm="handleDelete((record as ChecklistSession).id)"
                >
                  <Button
                    size="small"
                    danger
                    :disabled="isSoftDeleted(record as ChecklistSession)"
                    class="rounded bg-red-50/50 hover:bg-red-500 hover:text-white border-red-200"
                  >
                    {{ $t('page.company.btnDelete') }}
                  </Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>
      </Spin>
    </div>
  </div>
</template>

