<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { $t } from '#/locales';
import {
  Button,
  Table,
  Input,
  Popconfirm,
  Tag,
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
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import type { EchartsUIType } from '@vben/plugins/echarts';

interface EquipmentDetail {
  id: string;
  code: string;
  name: string;
}

interface ChecklistDetailItem {
  id: string;
  checklist_id: string;
  description: string;
  result: 'pass' | 'fail';
}

interface ChecklistSession {
  id: string;
  name?: string;
  equipment_id: string | null;
  equipment?: EquipmentDetail | null;
  session_date: string | null;
  details?: ChecklistDetailItem[];
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

// Charts States
const showCharts = ref(false);
const chartsLoading = ref(false);
const chartSessions = ref<ChecklistSession[]>([]);

// ECharts Refs
const statusChartRef = ref<EchartsUIType>();
const trendChartRef = ref<EchartsUIType>();
const failChartRef = ref<EchartsUIType>();

const { renderEcharts: renderStatusChart } = useEcharts(statusChartRef);
const { renderEcharts: renderTrendChart } = useEcharts(trendChartRef);
const { renderEcharts: renderFailChart } = useEcharts(failChartRef);

// Judge Modal State
const isJudgeModalOpen = ref(false);
const submittingJudge = ref(false);
const selectedSession = ref<ChecklistSession | null>(null);
const judgeDetails = ref<any[]>([]);

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

async function loadChartData() {
  chartsLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions?include_details=true&per_page=1000`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    chartSessions.value = Array.isArray(raw) ? raw : [];
    chartsLoading.value = false;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await renderCharts();
  } catch (err: any) {
    message.error($t('page.ops.chartLoadError'));
    chartsLoading.value = false;
  }
}

async function toggleCharts() {
  showCharts.value = !showCharts.value;
  if (showCharts.value) {
    await loadChartData();
  }
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
    title: $t('page.ops.colStatus'),
    key: 'status',
    sorter: (a: any, b: any) => {
      const statusA = getSessionStatusText(a);
      const statusB = getSessionStatusText(b);
      return statusA.localeCompare(statusB);
    },
  },
  {
    title: $t('page.ops.colActions'),
    key: 'actions',
    width: 260,
    align: 'right' as const,
  },
]);

function openAddPage() {
  router.push({ name: 'OpsCheckListDetail' });
}

function openEditPage(record: any) {
  router.push({ name: 'OpsCheckListDetail', query: { id: record.id } });
}

async function handleDelete(id: string) {
  try {
    loading.value = true;
    await axios.delete(`${API_BASE_URL}/v1/checklist-sessions/${id}`, {
      headers: getAuthHeaders(),
    });
    message.success('Xóa phiên kiểm tra thành công');
    await loadSessions();
    if (showCharts.value) {
      await loadChartData();
    }
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể xóa phiên kiểm tra');
  } finally {
    loading.value = false;
  }
}

function openJudgeModal(record: any) {
  selectedSession.value = record;
  judgeDetails.value = record.details?.map((d: any) => ({
    checklist_id: d.checklist_id,
    description: d.description || '',
    result: d.result || 'pass',
  })) || [];
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
    };

    await axios.post(`${API_BASE_URL}/v1/checklist-sessions/judge`, payload, {
      headers: getAuthHeaders(),
    });

    message.success('Đánh giá phiên kiểm tra thành công');
    isJudgeModalOpen.value = false;
    await loadSessions();
    if (showCharts.value) {
      await loadChartData();
    }
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

function getSessionStatusText(record: any) {
  if (!record.details || record.details.length === 0) return 'Pending';
  const hasFail = record.details.some((d: any) => d.result === 'fail');
  return hasFail ? 'Failed' : 'Passed';
}

function getSessionStatusColor(record: any) {
  const status = getSessionStatusText(record);
  if (status === 'Passed') return 'green';
  if (status === 'Failed') return 'red';
  return 'blue';
}

async function renderCharts() {
  await nextTick();
  if (!statusChartRef.value || !trendChartRef.value || !failChartRef.value) {
    return;
  }
  const list = chartSessions.value;
  if (list.length === 0) return;

  // 1. Status distribution
  const passedCount = list.filter(s => getSessionStatusText(s) === 'Passed').length;
  const failedCount = list.filter(s => getSessionStatusText(s) === 'Failed').length;
  const pendingCount = list.filter(s => getSessionStatusText(s) === 'Pending').length;

  renderStatusChart({
    tooltip: { trigger: 'item' },
    legend: { bottom: '0', left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    series: [
      {
        name: $t('page.ops.chartStatus'),
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
        color: ['#10b981', '#ef4444', '#3b82f6'], // green-500, red-500, blue-500
        data: [
          { value: passedCount, name: $t('page.ops.chartPassed') },
          { value: failedCount, name: $t('page.ops.chartFailed') },
          { value: pendingCount, name: $t('page.ops.chartPending') }
        ]
      }
    ]
  });

  // 2. Trend Chart
  const dayMap: Record<string, { passed: number, failed: number }> = {};
  list.forEach(s => {
    if (!s.session_date) return;
    const day = s.session_date.substring(0, 10);
    if (!dayMap[day]) {
      dayMap[day] = { passed: 0, failed: 0 };
    }
    const status = getSessionStatusText(s);
    if (status === 'Passed') dayMap[day].passed++;
    else if (status === 'Failed') dayMap[day].failed++;
  });
  const days = Object.keys(dayMap).sort().slice(-7);
  const passedTrend = days.map(d => dayMap[d]?.passed ?? 0);
  const failedTrend = days.map(d => dayMap[d]?.failed ?? 0);

  renderTrendChart({
    tooltip: { trigger: 'axis' },
    legend: { bottom: '0', left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    xAxis: { type: 'category', data: days, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: $t('page.ops.chartPassed'),
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.1 },
        color: '#10b981',
        data: passedTrend
      },
      {
        name: $t('page.ops.chartFailed'),
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.1 },
        color: '#ef4444',
        data: failedTrend
      }
    ]
  });

  // 3. Top Failed Equipment
  const eqMap: Record<string, { name: string, failedCount: number }> = {};
  list.forEach(s => {
    const status = getSessionStatusText(s);
    if (status !== 'Failed') return;
    const eqName = s.equipment ? s.equipment.name : (s.equipment_id || $t('page.ops.chartUnassigned'));
    if (!eqMap[eqName]) {
      eqMap[eqName] = { name: eqName, failedCount: 0 };
    }
    eqMap[eqName].failedCount++;
  });
  const sortedEq = Object.values(eqMap).sort((a, b) => b.failedCount - a.failedCount).slice(0, 5);
  sortedEq.reverse();
  const eqNames = sortedEq.map(x => x.name);
  const eqFails = sortedEq.map(x => x.failedCount);

  renderFailChart({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '8%', top: '5%', containLabel: true },
    xAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'category', data: eqNames, axisLabel: { fontSize: 10 } },
    series: [
      {
        name: $t('page.ops.chartFailCount'),
        type: 'bar',
        color: '#ef4444',
        barWidth: '40%',
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        data: eqFails
      }
    ]
  });
}

onMounted(() => {
  loadEquipments();
  loadSessions();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Dashboard Charts -->
    <div v-if="showCharts" class="mb-4">
      <Spin :spinning="chartsLoading">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
            <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
              {{ $t('page.ops.chartResultTitle') }}
            </h3>
            <EchartsUI ref="statusChartRef" />
          </div>
          <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
            <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
              {{ $t('page.ops.chartTrendTitle') }}
            </h3>
            <EchartsUI ref="trendChartRef" />
          </div>
          <div class="shadow-sm border border-border rounded-xl p-4 flex flex-col h-[360px] bg-card">
            <h3 class="text-sm font-semibold text-foreground mb-3 text-center">
              {{ $t('page.ops.chartFailTitle') }}
            </h3>
            <EchartsUI ref="failChartRef" />
          </div>
        </div>
      </Spin>
    </div>

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
        <Button type="default" @click="toggleCharts" :class="{ 'border-primary text-primary': showCharts }">
          {{ showCharts ? $t('page.ops.btnHideCharts') : $t('page.ops.btnShowCharts') }}
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

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
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

            <template v-else-if="column.key === 'status'">
              <Tag :color="getSessionStatusColor(record)">
                {{ getSessionStatusText(record) }}
              </Tag>
            </template>

            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button
                  v-if="getSessionStatusText(record) === 'Pending'"
                  size="small"
                  class="rounded border-green-500 text-green-600 hover:border-green-600 hover:text-green-700"
                  @click="openJudgeModal(record)"
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
      ok-text="Xác nhận"
      cancel-text="Hủy"
      @ok="handleJudgeOk"
    >
      <div v-if="judgeDetails.length === 0" class="py-4 text-center text-gray-400">
        Phiên này không có hạng mục nào để đánh giá.
      </div>
      <div v-else class="space-y-4 py-4">
        <div v-for="(item, index) in judgeDetails" :key="index" class="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
          <span class="font-medium text-gray-700">{{ item.description || `Hạng mục ${index + 1}` }}</span>
          <Select v-model:value="item.result" style="width: 140px">
            <Select.Option value="pass">Pass (Đạt)</Select.Option>
            <Select.Option value="fail">Fail (Lỗi)</Select.Option>
          </Select>
        </div>
      </div>
    </Modal>
  </div>
</template>
