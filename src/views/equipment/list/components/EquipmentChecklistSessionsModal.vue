<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Modal,
  Table,
  Tag,
  message,
  Tabs,
  Button,
} from 'ant-design-vue';
import axios from 'axios';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import { useAccessStore } from '@vben/stores';
import ExpandableContainer from '#/components/ExpandableContainer.vue';

const TabPane = Tabs.TabPane;

interface UserDetail {
  id: string;
  name: string;
  email: string;
}

interface ChecklistLog {
  id: string;
  status: 'pending' | 'completed';
  result: 'pass' | 'fail' | null;
  checked_at?: string | null;
}

interface ChecklistDetailItem {
  id: string;
  checklist_id: string;
  description: string;
  logs?: ChecklistLog[];
}

interface ChecklistSession {
  id: string;
  name?: string;
  equipment_id: string | null;
  equipment?: { name: string; code: string } | null;
  session_date: string | null;
  details?: ChecklistDetailItem[];
  users?: UserDetail[];
  deleted_at?: string | null;
}

// Interfaces for Tab 3: Today's Checklist
interface DailyChecklistLog {
  id: string;
  result: 'pass' | 'fail' | null;
  status: 'pending' | 'completed';
  checked_at?: string | null;
}
interface DailyChecklistUser {
  id: string;
  name: string;
}
interface DailyChecklistDetail {
  id: string;
  description: string;
  logs?: DailyChecklistLog[];
  users?: DailyChecklistUser[];
}
interface DailyChecklistResponse {
  id: string;
  name: string;
  equipment_id: string;
  session_date: string;
  details: DailyChecklistDetail[];
}

const props = defineProps<{
  equipmentId: string | null;
  equipmentName: string | null;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
}>();

const activeTabKey = ref('sessions');

// ─── Tab 1 State ──────────────────────────────────────────────────────────────
const loading = ref(false);
const sessions = ref<ChecklistSession[]>([]);
const currentPage = ref(1);
const pageSize = ref(15);
const total = ref(0);

// ─── Tab 3 State ──────────────────────────────────────────────────────────────
const dailyLoading = ref(false);
const dailyChecklistData = ref<DailyChecklistResponse | null>(null);

const columns = [
  {
    title: $t('page.ops.colCode') || 'Session Name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: $t('page.ops.colDate') || 'Session Date',
    dataIndex: 'session_date',
    key: 'session_date',
  },
  {
    title: $t('page.ops.colExecutor') || 'Executor',
    key: 'executor',
  },
  {
    title: $t('page.ops.colStatus') || 'Status',
    key: 'status',
  },
  {
    title: $t('page.ops.colActions') || 'Actions',
    key: 'actions',
    width: 120,
    align: 'center' as const,
  },
];

const dailyColumns = [
  {
    title: $t('page.equipment.colDescription') || 'Description',
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: $t('page.ops.colExecutor') || 'Executor',
    key: 'executor',
  },
  {
    title: $t('page.ops.colStatus') || 'Status',
    key: 'status',
  },
  {
    title: $t('page.ops.colDate') || 'Checked At',
    key: 'checked_at',
  },
  {
    title: $t('page.ops.colActions') || 'Actions',
    key: 'actions',
    width: 120,
    align: 'center' as const,
  },
];

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

// ─── Loaders ──────────────────────────────────────────────────────────────────
async function loadSessions(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const params: Record<string, string | number | boolean> = {
      include_details: true,
      page,
      per_page: size,
    };

    if (props.equipmentId) {
      params['equipment_id'] = props.equipmentId;
    }

    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    sessions.value = Array.isArray(raw) ? raw : [];
    total.value = res.data?.total ?? sessions.value.length;
    currentPage.value = res.data?.current_page ?? page;
    pageSize.value = size;
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải danh sách phiên kiểm tra');
  } finally {
    loading.value = false;
  }
}

async function loadDailyChecklist() {
  if (!props.equipmentId) return;
  dailyLoading.value = true;
  try {
    const params: Record<string, string | boolean> = {
      equipment_id: props.equipmentId,
    };

    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions/daily`, {
      headers: getAuthHeaders(),
      params,
    });
    dailyChecklistData.value = res.data?.data ?? res.data ?? null;
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải checklist hôm nay');
    dailyChecklistData.value = null;
  } finally {
    dailyLoading.value = false;
  }
}

// ─── Tab Event Handlers ───────────────────────────────────────────────────────
function handleTableChange(pagination: { current?: number; pageSize?: number }) {
  const current = pagination.current || 1;
  const size = pagination.pageSize || 15;
  loadSessions(current, size);
}

function handleCancel() {
  emit('update:open', false);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSessionDate(record: any): string {
  return (record as ChecklistSession).session_date || '—';
}

function getSessionUsers(record: any): UserDetail[] {
  return (record as ChecklistSession).users || [];
}

function getLatestCompletedLog(detail: ChecklistDetailItem): ChecklistLog | undefined {
  return detail.logs
    ?.filter((log) => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

function getSessionStatusText(record: any): 'Failed' | 'Passed' | 'Pending' {
  const session = record as ChecklistSession;
  if (!session.details || session.details.length === 0) return 'Pending';

  let hasFail = false;
  for (const detail of session.details) {
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

function getStatusColor(status: 'Failed' | 'Passed' | 'Pending') {
  if (status === 'Passed') return 'success';
  if (status === 'Failed') return 'error';
  return 'warning';
}

// Helpers for Daily (Tab 3)
function getDailyLatestLog(detail: DailyChecklistDetail): DailyChecklistLog | undefined {
  return detail.logs
    ?.filter((log) => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

function getDailyStatusText(detail: DailyChecklistDetail): string {
  const log = getDailyLatestLog(detail);
  if (!log) return 'Pending';
  return log.result === 'pass' ? 'Passed' : 'Failed';
}

function getDailyLatestCheckedAt(detail: DailyChecklistDetail): string {
  const log = getDailyLatestLog(detail);
  return log?.checked_at ? new Date(log.checked_at).toLocaleString() : '—';
}

function getDailyUsers(detail: DailyChecklistDetail): UserDetail[] {
  return (detail.users || []).map((u) => ({
    id: u.id,
    name: u.name,
    email: '',
  }));
}

const router = useRouter();

function navigateToDetail(sessionId: string, equipmentId: string, date: string) {
  router.push({
    path: '/maintenance/checklist/detail',
    query: {
      id: sessionId,
      equipment_id: equipmentId,
      date: date,
    },
  });
  emit('update:open', false);
}

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(
  () => props.open,
  async (newVal) => {
    if (newVal) {
      activeTabKey.value = 'sessions';
      currentPage.value = 1;
      await loadSessions(1);
    }
  },
);

watch(
  [activeTabKey, () => props.open],
  async ([newTab, isOpen]) => {
    if (isOpen) {
      if (newTab === 'todayChecklist') {
        await loadDailyChecklist();
      }
    }
  },
);
</script>

<template>
  <Modal
    :open="open"
    :title="$t('page.equipment.checklistSessionsModalTitle', { name: equipmentName || '' })"
    :footer="null"
    width="1200px"
    @cancel="handleCancel"
  >
    <Tabs v-model:activeKey="activeTabKey" class="mt-2">
      <!-- TAB 1: Checklist Sessions -->
      <TabPane key="sessions" :tab="$t('page.equipment.tabChecklistSessions')">
        <div class="space-y-4 pt-4">
          <Table
            :columns="columns"
            :data-source="sessions"
            row-key="id"
            :loading="loading"
            :pagination="{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '15', '30', '50', '100'],
              showTotal: (tot: number) => $t('page.company.users.showTotal', { total: tot }),
            }"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'session_date'">
                <span>{{ getSessionDate(record) }}</span>
              </template>

              <template v-else-if="column.key === 'executor'">
                <ExpandableContainer :items="getSessionUsers(record)">
                  <Tag v-for="user in getSessionUsers(record)" :key="user.id" color="blue">
                    {{ user.name }}
                  </Tag>
                </ExpandableContainer>
              </template>

              <template v-else-if="column.key === 'status'">
                <Tag :color="getStatusColor(getSessionStatusText(record))">
                  {{ getSessionStatusText(record) }}
                </Tag>
              </template>

              <template v-else-if="column.key === 'actions'">
                <Button
                  type="primary"
                  size="small"
                  @click="navigateToDetail(record.id, record.equipment_id || '', record.session_date || '')"
                >
                  {{ $t('page.equipment.btnChecklist') || 'Checklist' }}
                </Button>
              </template>
            </template>
          </Table>
        </div>
      </TabPane>

      <!-- TAB 3: Today's Checklist -->
      <TabPane key="todayChecklist" :tab="$t('page.equipment.tabTodayChecklist')">
        <div class="space-y-4 pt-4">
          <div v-if="dailyLoading" class="flex justify-center py-8">
            <Table :loading="true" :columns="[]" :data-source="[]" />
          </div>
          <div v-else-if="dailyChecklistData">
            <Table
              :columns="dailyColumns"
              :data-source="dailyChecklistData.details"
              row-key="id"
              :pagination="false"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'executor'">
                  <ExpandableContainer :items="getDailyUsers(record as DailyChecklistDetail)">
                    <Tag v-for="user in getDailyUsers(record as DailyChecklistDetail)" :key="user.id" color="blue">
                      {{ user.name }}
                    </Tag>
                  </ExpandableContainer>
                </template>

                <template v-else-if="column.key === 'status'">
                  <Tag :color="getStatusColor(getDailyStatusText(record as DailyChecklistDetail) as any)">
                    {{ getDailyStatusText(record as DailyChecklistDetail) }}
                  </Tag>
                </template>

                <template v-else-if="column.key === 'checked_at'">
                  <span>{{ getDailyLatestCheckedAt(record as DailyChecklistDetail) }}</span>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <Button
                    type="primary"
                    size="small"
                    @click="navigateToDetail(dailyChecklistData!.id, dailyChecklistData!.equipment_id || '', dailyChecklistData!.session_date || '')"
                  >
                    {{ $t('page.equipment.btnChecklist') || 'Checklist' }}
                  </Button>
                </template>
              </template>
            </Table>
          </div>
          <div v-else class="text-center text-gray-400 py-8">—</div>
        </div>
      </TabPane>
    </Tabs>
  </Modal>
</template>
