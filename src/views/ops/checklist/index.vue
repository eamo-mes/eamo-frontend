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
  Modal,
  Select,
  Space,
  DatePicker
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import ChecklistCalendar from './components/ChecklistCalendar.vue';
import ChecklistCharts from './components/ChecklistCharts.vue';

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
  details?: ChecklistDetailItem[];
  users?: UserDetail[];
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



// ECharts Refs
// (Moved to ChecklistCharts component)

// Judge Modal State
const isJudgeModalOpen = ref(false);
const submittingJudge = ref(false);
const selectedSession = ref<ChecklistSession | null>(null);
const judgeDetails = ref<any[]>([]);

const showCalendar = ref(false);
const showCharts = ref(false);
const chartStats = ref<any>(null);
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
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải danh sách phiên kiểm tra');
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

function handleTableChange(pagination: any) {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  loadSessions(pagination.current, pagination.pageSize);
}

// With server-side search, just use sessions directly
const filteredSessions = computed(() => sessions.value);

const columns = computed(() => [
  {
    title: $t('page.ops.colEquipment'),
    dataIndex: 'equipment_id',
    key: 'equipment',
  },
  {
    title: $t('page.ops.colDate'),
    dataIndex: 'session_date',
    key: 'session_date',
    sorter: (a: any, b: any) => {
      const timeA = a.session_date ? new Date(a.session_date).getTime() : 0;
      const timeB = b.session_date ? new Date(b.session_date).getTime() : 0;
      return timeA - timeB;
    },
  },
  {
    title: $t('page.ops.colCreatedBy'),
    key: 'created_by',
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    width: 260,
    align: 'right' as const,
    fixed: 'right' as const,
  },
]);

function openAddPage() {
  router.push({ name: 'OpsCheckListDetail' });
}

function openEditPage(record: any) {
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
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể xóa phiên kiểm tra');
  } finally {
    loading.value = false;
  }
}

function openJudgeModal(record: ChecklistSession) {
  selectedSession.value = record;
  judgeDetails.value = record.details?.map((detail) => {
    const latestLog = getLatestCompletedLog(detail);
    return {
      checklist_id: detail.checklist_id,
      description: detail.description || '',
      result: latestLog?.result || 'fail',
    };
  }) || [];
  isJudgeModalOpen.value = true;
}

async function handleJudgeOk() {
  try {
    if (!selectedSession.value) return;
    submittingJudge.value = true;

    const payload = {
      session_id: selectedSession.value.id,
      results: judgeDetails.value.map(item => ({
        checklist_id: item.checklist_id,
        result: item.result,
        description: item.description,
      })),
      timestamp: selectedSession.value.session_date || undefined,
    };

    await axios.post(`${API_BASE_URL}/v1/checklist-sessions/judge`, payload, {
      headers: getAuthHeaders(),
    });

    message.success('Đánh giá phiên kiểm tra thành công');
    isJudgeModalOpen.value = false;
    await loadSessions();
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Đánh giá phiên kiểm tra thất bại');
  } finally {
    submittingJudge.value = false;
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

function getLatestCompletedLog(detail: ChecklistDetailItem): ChecklistLog | undefined {
  return detail.logs
    ?.filter(log => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

function getSessionStatusText(record: ChecklistSession): 'Failed' | 'Passed' | 'Pending' {
  if (!record.details || record.details.length === 0) return 'Pending';

  let hasFail = false;
  for (const detail of record.details) {
    const log = getLatestCompletedLog(detail);
    if (!log) {
      return 'Pending';
    }
    if (log.result === 'fail') {
      hasFail = true;
    }
  }

  if (hasFail) return 'Failed';
  return 'Passed';
}



// (Charts rendering moved to ChecklistCharts component)

onMounted(() => {
  loadEquipments();
  loadSessions();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Chart Panel -->
    <ChecklistCharts
      v-if="showCharts"
      :stats="chartStats"
      :loading="chartsLoading"
    />

    <!-- Action Bar -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto">
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
          type="default"
          class="rounded-md font-medium h-full"
          :class="{ 'border-[#5c3e35] text-[#5c3e35]': showCharts }"
          @click="toggleCharts"
        >
          {{ showCharts ? $t('page.ops.btnHideCharts') : $t('page.ops.btnShowCharts') }}
        </Button>
        <Button
          type="default"
          class="rounded-md font-medium h-full"
          @click="showCalendar = !showCalendar"
        >
          {{ showCalendar ? $t('page.ops.btnListView') : $t('page.ops.btnCalendarView') }}
        </Button>
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full"
          @click="openAddPage"
        >
          {{ $t('page.ops.btnAddSession') }}
        </Button>
      </div>
    </div>

    <!-- Calendar Component -->
    <ChecklistCalendar
      v-if="showCalendar"
      :equipments="equipments"
      @refresh-list="loadSessions"
    />

    <!-- Table -->
    <div v-else class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredSessions"
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
            <template v-if="column.key === 'equipment'">
              <span v-if="record.equipment">
                {{ record.equipment.name }} ({{ record.equipment.code }})
              </span>
              <span v-else-if="record.equipment_id">
                {{ record.equipment_id }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </template>

            <template v-else-if="column.key === 'session_date'">
              <span>{{ formatDate(record.session_date) }}</span>
            </template>

            <template v-else-if="column.key === 'created_by'">
              <span>{{ record.users && record.users.length > 0 ? record.users.map((u: any) => u.name).join(', ') : '—' }}</span>
            </template>

            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button
                  v-if="getSessionStatusText(record as ChecklistSession) === 'Pending'"
                  size="small"
                  class="rounded border-green-500 text-green-600 hover:border-green-600 hover:text-green-700"
                  @click="openJudgeModal(record as ChecklistSession)"
                >
                  {{ $t('page.ops.btnJudge') }}
                </Button>
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditPage(record)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.ops.deleteConfirm')"
                  :ok-text="$t('page.ops.btnConfirm')"
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
              </Space>
            </template>
          </template>
        </Table>
      </Spin>
    </div>

    <!-- Judge Modal -->
    <Modal
      v-model:open="isJudgeModalOpen"
      :title="$t('page.ops.judgeModalTitle')"
      :confirm-loading="submittingJudge"
      :ok-text="$t('page.ops.btnConfirm')"
      :cancel-text="$t('page.ops.btnCancel')"
      @ok="handleJudgeOk"
    >
      <div v-if="judgeDetails.length === 0" class="py-4 text-center text-gray-400">
        {{ $t('page.ops.noItemsToJudge') }}
      </div>
      <div v-else class="space-y-4 py-4">
        <div v-for="(item, index) in judgeDetails" :key="index" class="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
          <span class="font-medium text-gray-700">{{ item.description || $t('page.ops.judgeItemIndex', { index: index + 1 }) }}</span>
          <Select v-model:value="item.result" style="width: 140px">
            <Select.Option value="pass">{{ $t('page.ops.resultPass') }}</Select.Option>
            <Select.Option value="fail">{{ $t('page.ops.resultFail') }}</Select.Option>
          </Select>
        </div>
      </div>
    </Modal>
  </div>
</template>
