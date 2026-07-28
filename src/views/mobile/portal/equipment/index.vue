<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Card,
  Tabs,
  TabPane,
  Button,
  Tag,
  Spin,
  Empty,
  Input,
  message,
  Progress,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

defineOptions({ name: 'MobilePortalEquipment' });

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

// ─── App State ───
const activeTabKey = ref('qrcode');
const loading = ref(false);
const equipments = ref<EquipmentItem[]>([]);
const searchVal = ref('');

// QR Scanning State (Backend Decoding)
const uploading = ref(false);
const cameraError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

// Active Details View State
const activeEquipment = ref<EquipmentItem | null>(null);
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

// ─── Data Loading ───
async function loadEquipments() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải danh sách thiết bị');
  } finally {
    loading.value = false;
  }
}

async function selectEquipment(id: string) {
  loading.value = true;
  activeEquipment.value = null;
  dailyChecklistData.value = null;
  remainingHours.value = null;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/${id}`, {
      headers: getAuthHeaders(),
      params: { include_children: true },
    });
    const record = res.data?.data ?? res.data;
    if (record) {
      activeEquipment.value = record;
      await Promise.all([
        loadDailyChecklist(id),
        loadRemainingHours(record.code),
      ]);
    }
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải thông tin chi tiết thiết bị');
  } finally {
    loading.value = false;
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

// ─── Actions ───
function handleBack() {
  activeEquipment.value = null;
  dailyChecklistData.value = null;
  remainingHours.value = null;
}

// ─── Backend QR Decoding Logic ───
function triggerCapture() {
  fileInputRef.value?.click();
}

async function handleImageCaptured(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('qr_image', file);

  uploading.value = true;
  cameraError.value = '';

  try {
    const res = await axios.post(`${API_BASE_URL}/v1/equipment/decode-qr`, formData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });

    const equipmentData = res.data?.data;
    if (equipmentData) {
      message.success(t('page.portal.qrDecodeSuccess'));
      
      // 1. Chuyển sang Tab danh sách (List)
      activeTabKey.value = 'list';
      
      // 2. Điền mã thiết bị vào ô tìm kiếm để tự động lọc
      searchVal.value = equipmentData.code;
    }
  } catch (err: any) {
    console.error('QR decode error:', err);
    const apiMsg = err?.response?.data?.message || t('page.portal.unableToDecodeQr');
    cameraError.value = apiMsg;
    message.error(apiMsg);
  } finally {
    uploading.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
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

// ─── Filtered List ───
const filteredEquipments = computed(() => {
  if (!searchVal.value) return equipments.value;
  const q = searchVal.value.toLowerCase();
  return equipments.value.filter(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      (e.name && e.name.toLowerCase().includes(q)) ||
      e.id.toLowerCase().includes(q) ||
      (e.device_id && e.device_id.toLowerCase().includes(q))
  );
});

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
  loadEquipments();
});
</script>

<template>
  <div class="p-4 sm:p-6 min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40">
    <!-- ─── HEADER / ACTION BAR ─── -->
    <div class="mb-5 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button
          v-if="activeEquipment"
          type="default"
          size="small"
          class="flex items-center justify-center p-1 rounded-lg"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <h1 class="text-lg font-bold text-slate-800 m-0">
          {{ activeEquipment ? t('page.portal.backToList') : t('page.portal.equipment') }}
        </h1>
      </div>
    </div>

    <!-- ─── LOADING STATE ─── -->
    <div v-if="loading && !isScanning" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── TABS VIEW (When No Active Equipment) ─── -->
    <div v-else-if="!activeEquipment">
      <Card class="rounded-2xl shadow-xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden">
        <Tabs v-model:activeKey="activeTabKey" class="mobile-tabs w-full">
          <!-- ─── TAB 1: BACKEND QR CODE DECODER ─── -->
          <TabPane key="qrcode" :tab="t('page.portal.qrCodeTab')">
            <div class="flex flex-col items-center pt-2 pb-6">
              
              <!-- Hidden File Input for Capture -->
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden"
                @change="handleImageCaptured"
              />

              <!-- Frame for instructions and errors -->
              <div class="relative w-72 h-72 border border-slate-200/80 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-950/40 rounded-3xl flex flex-col items-center justify-center overflow-hidden shadow-inner p-4">
                <!-- Laser line scan animation when uploading/processing -->
                <div v-if="uploading" class="scanline absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_#6366f1] z-10"></div>
                
                <!-- Viewfinder Corner Brackets -->
                <div class="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg"></div>
                <div class="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg"></div>
                <div class="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg"></div>
                <div class="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg"></div>

                <div class="text-center z-5 flex flex-col items-center justify-center">
                  <!-- QR Code Icon Wrapper -->
                  <div class="mb-3 p-3.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="5" height="5" x="3" y="3" rx="1"/>
                      <rect width="5" height="5" x="16" y="3" rx="1"/>
                      <rect width="5" height="5" x="3" y="16" rx="1"/>
                      <path d="M21 16V21H16"/>
                      <path d="M21 12H21.01"/>
                      <path d="M12 21H12.01"/>
                      <path d="M12 12H12.01"/>
                      <path d="M16 16H16.01"/>
                      <path d="M16 12H16.01"/>
                      <path d="M12 16H12.01"/>
                    </svg>
                  </div>
                  <p class="text-sm font-bold text-slate-700 dark:text-zinc-200 m-0">
                    {{ uploading ? t('page.portal.sendingImageToDecode') : t('page.portal.pressButtonToCapture') }}
                  </p>
                  <p class="text-xs text-slate-400 dark:text-zinc-500 mt-2 px-4 leading-normal">
                    {{ t('page.portal.systemWillOpenCamera') }}
                  </p>
                  <p v-if="cameraError" class="text-[11px] text-red-500 font-semibold mt-3 bg-red-50 dark:bg-red-950/20 px-2 py-1.5 rounded-lg">
                    {{ cameraError }}
                  </p>
                </div>
              </div>

              <!-- Action Button -->
              <div class="mt-5 w-full max-w-[288px]">
                <Button 
                  type="primary" 
                  block 
                  size="large" 
                  :loading="uploading"
                  class="bg-indigo-600 hover:bg-indigo-700 border-none rounded-xl font-bold flex items-center justify-center gap-1.5"
                  @click="triggerCapture"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-camera"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  {{ t('page.portal.captureAndScanQr') }}
                </Button>
              </div>

            </div>
          </TabPane>

          <!-- ─── TAB 2: LIST VIEW ─── -->
          <TabPane key="list" :tab="t('page.portal.listTab')">
            <div class="space-y-4 pt-2">
              <Input
                v-model:value="searchVal"
                :placeholder="t('page.portal.searchPlaceholder')"
                class="rounded-xl border-slate-200/80 dark:border-zinc-800"
                size="large"
                allow-clear
              />
              
              <div v-if="filteredEquipments.length > 0" class="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
                <div
                  v-for="eq in filteredEquipments"
                  :key="eq.id"
                  class="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 dark:bg-zinc-950/30 dark:hover:bg-zinc-900/40 border border-slate-100 dark:border-zinc-800/40 rounded-xl cursor-pointer transition-all duration-200"
                  @click="selectEquipment(eq.id)"
                >
                  <div class="flex-1 min-w-0 pr-3">
                    <span class="text-xs font-bold text-slate-800 dark:text-zinc-200 block truncate">{{ eq.name || '—' }}</span>
                    <span class="text-[10px] font-mono text-slate-400 dark:text-zinc-500 block mt-0.5">{{ eq.code }}</span>
                  </div>
                </div>
              </div>

              <div v-else class="py-10 flex justify-center">
                <Empty :description="t('page.portal.noEquipmentFound')" />
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>

    <!-- ─── DETAILS VIEW (When Equipment is Selected) ─── -->
    <div v-else-if="activeEquipment" class="flex flex-col gap-6 mb-6">
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
  </div>
</template>

<style scoped>
/* ── Scanning laser line keyframes ── */
@keyframes scan {
  0% { top: 0%; }
  50% { top: 100%; }
  100% { top: 0%; }
}
.scanline {
  animation: scan 3.5s linear infinite;
}

/* Custom styling for Ant Design tabs under mobile view */
.mobile-tabs :deep(.ant-tabs-nav-list) {
  width: 100%;
}
.mobile-tabs :deep(.ant-tabs-tab) {
  flex: 1;
  text-align: center;
  justify-content: center;
}
</style>
