<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Card,
  Button,
  Tag,
  Spin,
  Empty,
  Progress,
  Result
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import EquipmentQrModal from '#/views/equipment/list/components/EquipmentQrModal.vue';

defineOptions({ name: 'MobilePortalEquipmentDetail' });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// ─── Interfaces ───
interface CategoryOption {
  id: string;
  code: string;
  name: string;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface ParameterItem {
  id?: string;
  code: string;
  name: string;
  unit_id: string | null;
  unit?: { id: string; name: string } | null;
  standard?: number | null;
  standard_max?: number | null;
  standard_min?: number | null;
}

interface EquipmentImageOption {
  id: string;
  image_id: string;
  path?: string | null;
}

interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category_id: string | null;
  equipment_category?: CategoryOption | null;
  equipment_images?: EquipmentImageOption[];
  is_active: boolean;
  maintenance_interval_hours?: number | null;
  equipment_errors?: ErrorOption[];
  equipment_parameters?: ParameterItem[];
  deleted_at?: string | null;
}

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

// ─── State ───
const loading = ref(true);
const fetchError = ref('');
const errorStatus = ref<number | null>(null);

const activeEquipment = ref<EquipmentItem | null>(null);
const qrModalOpen = ref(false);
const dailyLoading = ref(false);
const dailyChecklistData = ref<DailyChecklistResponse | null>(null);
const remainingHours = ref<number | null>(null);

const operatingHours = computed(() => {
  if (!activeEquipment.value || !activeEquipment.value.maintenance_interval_hours || remainingHours.value === null) {
    return null;
  }
  const interval = activeEquipment.value.maintenance_interval_hours;
  const remaining = remainingHours.value;
  return Math.max(0, Number((interval - remaining).toFixed(1)));
});

const maintenancePercent = computed(() => {
  if (!activeEquipment.value || !activeEquipment.value.maintenance_interval_hours || remainingHours.value === null) {
    return 0;
  }
  const interval = activeEquipment.value.maintenance_interval_hours;
  const remaining = remainingHours.value;
  const runTime = interval - remaining;
  if (runTime <= 0) return 0;
  return Math.min(100, Math.round((runTime / interval) * 100));
});

const strokeColor = computed(() => {
  const percent = maintenancePercent.value;
  if (percent < 50) return '#52c41a'; // Green
  if (percent < 80) return '#faad14'; // Orange/Yellow
  return '#f5222d'; // Red
});

const maintenanceStatus = computed(() => {
  if (remainingHours.value === null) return 'normal';
  if (remainingHours.value <= 0) return 'exception';
  return 'active';
});

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getImageUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const baseUrl = API_BASE_URL.replace(/\/api$/, '');
  const imagePath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${imagePath}`;
}

async function loadRemainingHours(equipmentCode: string) {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times/maintenance-status`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    if (Array.isArray(raw)) {
      const match = raw.find((item: { name: string; remaining: number }) => item.name === equipmentCode);
      if (match) {
        remainingHours.value = match.remaining;
      }
    }
  } catch (err) {
    console.error('loadRemainingHours error:', err);
  }
}

async function loadDailyChecklist(equipmentId: string) {
  dailyLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/checklist-sessions/daily`, {
      headers: getAuthHeaders(),
      params: { equipment_id: equipmentId },
    });
    dailyChecklistData.value = res.data?.data ?? res.data ?? null;
  } catch (err: any) {
    console.error('loadDailyChecklist error:', err);
    dailyChecklistData.value = null;
  } finally {
    dailyLoading.value = false;
  }
}

async function loadEquipmentDetails() {
  const equipmentId = route.params.id as string;
  if (!equipmentId) {
    fetchError.value = 'Không tìm thấy ID thiết bị trong URL.';
    loading.value = false;
    return;
  }

  loading.value = true;
  fetchError.value = '';
  errorStatus.value = null;

  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/${equipmentId}`, {
      headers: getAuthHeaders(),
      params: { include_children: true },
    });
    const record = res.data?.data ?? res.data;
    if (record) {
      activeEquipment.value = record;
      await Promise.all([
        loadDailyChecklist(equipmentId),
        loadRemainingHours(record.code),
      ]);
    } else {
      fetchError.value = 'Thiết bị không tồn tại trong hệ thống.';
    }
  } catch (err: any) {
    console.error('loadEquipmentDetails error:', err);
    errorStatus.value = err?.response?.status || 500;
    fetchError.value = err?.response?.data?.message || 'Không thể tải thông tin chi tiết thiết bị.';
  } finally {
    loading.value = false;
  }
}

function handleBack() {
  router.push('/portal/equipment');
}

function navigateToDetail(sessionId: string, equipmentId: string, date: string) {
  router.push({
    path: '/maintenance/checklist/detail',
    query: {
      id: sessionId,
      equipment_id: equipmentId,
      date: date,
    },
  });
}

// ─── Daily Checklist Helpers ───
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
  return log?.checked_at ? new Date(log.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

function getDailyUsers(detail: DailyChecklistDetail): DailyChecklistUser[] {
  return detail.users || [];
}

function getStatusColor(status: string) {
  if (status === 'Passed') return 'success';
  if (status === 'Failed') return 'error';
  return 'warning';
}

onMounted(() => {
  loadEquipmentDetails();
});
</script>

<template>
  <div class="p-4 sm:p-6 min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40">
    <!-- ─── HEADER / ACTION BAR ─── -->
    <div class="mb-5 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button
          type="default"
          size="small"
          class="flex items-center justify-center p-1 rounded-lg"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <h1 class="text-base font-bold text-slate-800 dark:text-zinc-200 m-0">
          Chi tiết thiết bị
        </h1>
      </div>

      <Button
        v-if="activeEquipment"
        type="default"
        size="small"
        class="flex items-center gap-1 font-bold text-xs rounded-lg text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-zinc-700"
        @click="qrModalOpen = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-qr-code"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16V21H16"/><path d="M21 12H21.01"/><path d="M12 21H12.01"/><path d="M12 12H12.01"/><path d="M16 16H16.01"/><path d="M16 12H16.01"/><path d="M12 16H12.01"/></svg>
        Mã QR
      </Button>
    </div>

    <!-- ─── LOADING STATE ─── -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Spin size="large" />
    </div>

    <!-- ─── EXCEPTION/ERROR STATE (Does not exist or soft-deleted) ─── -->
    <div v-else-if="fetchError" class="py-12 bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800/80 px-4 text-center">
      <Result
        status="warning"
        title="Lỗi thiết bị"
        :sub-title="fetchError"
      >
        <template #extra>
          <Button type="primary" class="bg-indigo-600 border-none rounded-xl" @click="handleBack">
            Quay lại danh sách
          </Button>
        </template>
      </Result>
    </div>

    <!-- ─── DETAILS VIEW (When Equipment is Loaded) ─── -->
    <div v-else-if="activeEquipment" class="flex flex-col gap-5 mb-6">
      <!-- Card 1: General Info Card -->
      <Card class="rounded-2xl shadow-xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md p-0 overflow-hidden">
        <!-- Image Header (If any images available) -->
        <div v-if="activeEquipment?.equipment_images && activeEquipment.equipment_images.length > 0" class="w-full h-44 bg-slate-100 dark:bg-zinc-950 relative overflow-hidden">
          <img
            :src="getImageUrl(activeEquipment?.equipment_images?.[0]?.path)"
            alt="equipment image"
            class="w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div class="absolute bottom-3 left-4 right-4">
            <span class="text-white text-base font-bold block leading-tight">{{ activeEquipment?.name }}</span>
            <span class="text-slate-300 font-mono text-xs block mt-1">{{ activeEquipment?.code }}</span>
          </div>
        </div>

        <!-- Normal Text Header (If no images) -->
        <div v-else class="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
          <span class="text-lg font-bold text-slate-800 dark:text-zinc-200 block">{{ activeEquipment?.name }}</span>
          <span class="text-xs font-mono text-slate-400 dark:text-zinc-500 block mt-0.5">{{ activeEquipment?.code }}</span>
        </div>

        <!-- Information details list -->
        <div class="p-4 space-y-4">
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span class="text-slate-400 dark:text-zinc-500 block uppercase tracking-wider text-[9px] font-bold">Category</span>
              <span class="text-slate-700 dark:text-zinc-300 font-semibold mt-0.5 block">
                {{ activeEquipment?.equipment_category?.name || '—' }}
              </span>
            </div>
            <div>
              <span class="text-slate-400 dark:text-zinc-500 block uppercase tracking-wider text-[9px] font-bold">Status</span>
              <Tag :color="activeEquipment?.is_active ? 'success' : 'default'" class="text-[9px] px-1.5 py-0.5 mt-0.5 rounded-md font-bold uppercase inline-block">
                {{ activeEquipment?.is_active ? t('page.equipment.statusActive') : t('page.equipment.statusInactive') }}
              </Tag>
            </div>
          </div>

          <!-- Parameters Section -->
          <div v-if="activeEquipment?.equipment_parameters && activeEquipment.equipment_parameters.length > 0">
            <span class="text-slate-400 dark:text-zinc-500 block uppercase tracking-wider text-[9px] font-bold mb-1.5">Parameters</span>
            <div class="flex flex-wrap gap-1">
              <Tag
                v-for="param in activeEquipment?.equipment_parameters"
                :key="param.id"
                color="blue"
                class="text-[10px] px-1.5 py-0.5 rounded-md"
              >
                {{ param.code }}<span v-if="param.unit"> ({{ param.unit.name }})</span>
              </Tag>
            </div>
          </div>

          <!-- Errors Section -->
          <div v-if="activeEquipment?.equipment_errors && activeEquipment.equipment_errors.length > 0">
            <span class="text-slate-400 dark:text-zinc-500 block uppercase tracking-wider text-[9px] font-bold mb-1.5">Errors</span>
            <div class="flex flex-wrap gap-1">
              <Tag
                v-for="err in activeEquipment?.equipment_errors"
                :key="err.id"
                color="red"
                class="text-[10px] px-1.5 py-0.5 rounded-md"
              >
                {{ err.name }}
              </Tag>
            </div>
          </div>
        </div>
      </Card>

      <!-- Card 2: Operating & Maintenance Status Card -->
      <Card class="rounded-2xl shadow-xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md p-4 overflow-hidden">
        <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600 dark:text-indigo-400"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          {{ t('page.portal.operatingMaintenanceTitle') }}
        </h3>
        
        <div class="space-y-4">
          <!-- Maintenance Interval Info -->
          <div class="flex justify-between items-center text-xs border-b border-slate-50 dark:border-zinc-800/40 pb-2.5">
            <span class="text-slate-500 dark:text-zinc-400 font-medium">{{ t('page.portal.maintenanceInterval') }}</span>
            <span class="text-slate-800 dark:text-zinc-200 font-bold">
              {{ activeEquipment?.maintenance_interval_hours ? `${activeEquipment?.maintenance_interval_hours} hrs` : '—' }}
            </span>
          </div>

          <!-- Operating Hours Info -->
          <div class="flex justify-between items-center text-xs border-b border-slate-50 dark:border-zinc-800/40 pb-2.5">
            <span class="text-slate-500 dark:text-zinc-400 font-medium">{{ t('page.portal.operatingHours') }}</span>
            <span class="text-slate-800 dark:text-zinc-200 font-bold">
              {{ operatingHours !== null ? `${operatingHours} hrs` : '—' }}
            </span>
          </div>

          <!-- Time until next maintenance -->
          <div class="space-y-2">
            <div class="flex justify-between items-center text-xs">
              <span class="text-slate-500 dark:text-zinc-400 font-medium">{{ t('page.portal.nextMaintenanceRemaining') }}</span>
              <span :class="[remainingHours !== null && remainingHours <= 0 ? 'text-red-500 font-extrabold' : 'text-slate-800 dark:text-zinc-200 font-bold']">
                {{ remainingHours !== null ? `${remainingHours} hrs` : '—' }}
              </span>
            </div>
            
            <div v-if="remainingHours !== null" class="w-full">
              <Progress
                :percent="maintenancePercent"
                :status="maintenanceStatus"
                :stroke-color="strokeColor"
                class="m-0"
              />
              <div v-if="remainingHours <= 0" class="text-[10px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                <span>⚠️</span>
                <span>{{ t('page.portal.immediateMaintenanceRequired') }}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <!-- ─── TODAY'S CHECKLIST SECTION ─── -->
      <div class="border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 bg-white dark:bg-zinc-900/60 backdrop-blur-md shadow-xs">
        <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600 dark:text-indigo-400"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
          {{ t('page.portal.todayChecklistTitle') }}
        </h3>
        
        <div v-if="dailyLoading" class="flex justify-center py-6">
          <Spin />
        </div>
        
        <div v-else-if="dailyChecklistData && dailyChecklistData.details && dailyChecklistData.details.length > 0" class="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 pr-2 scrollbar-thin">
          <div v-for="item in dailyChecklistData.details" :key="item.id" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-slate-700 dark:text-zinc-300 break-words mb-1">{{ item.description }}</p>
              <div class="flex flex-wrap gap-1.5 items-center">
                <span class="text-[10px] text-slate-400 dark:text-zinc-500">
                  {{ t('page.portal.executor') }}:
                </span>
                <Tag v-for="user in getDailyUsers(item)" :key="user.id" class="text-[9px] px-1 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30 m-0">
                  {{ user.name }}
                </Tag>
                <span v-if="getDailyUsers(item).length === 0" class="text-[10px] text-slate-400 m-0">—</span>
                <span class="text-[10px] text-slate-300 dark:text-zinc-700 mx-1">|</span>
                <span class="text-[9px] text-slate-400 dark:text-zinc-500">
                  {{ getDailyLatestCheckedAt(item) || '—' }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Tag :color="getStatusColor(getDailyStatusText(item))" class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md m-0">
                {{ getDailyStatusText(item) }}
              </Tag>
              <Button type="primary" size="small" class="bg-indigo-600 hover:bg-indigo-700 border-none text-[11px] h-7 px-2.5 rounded-lg flex items-center justify-center font-bold" @click="navigateToDetail(dailyChecklistData!.id, dailyChecklistData!.equipment_id, dailyChecklistData!.session_date)">
                Check
              </Button>
            </div>
          </div>
        </div>
        
        <div v-else class="py-8 flex flex-col items-center justify-center text-center">
          <Empty :description="t('page.portal.noTodayChecklist')" />
        </div>
      </div>
    </div>

    <!-- Equipment QR Modal -->
    <EquipmentQrModal
      v-model:open="qrModalOpen"
      :equipment="activeEquipment"
    />
  </div>
</template>

<style scoped>
</style>
