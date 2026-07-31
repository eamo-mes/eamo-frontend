<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Button, 
  Input, 
  Select, 
  DatePicker, 
  Spin, 
  Empty, 
  message,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import axios from 'axios';
import { useI18n } from '@vben/locales';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

defineOptions({ name: 'MobilePortalIncidentReport' });

const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();

// ─── States ───
const step = ref<1 | 2>(1); // 1: QR Scan & Select Equipment, 2: Fill Error Details
const loading = ref(false);
const submitting = ref(false);
const searchVal = ref('');
const isScanningCamera = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);
const mediaStream = ref<MediaStream | null>(null);

interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  status?: string;
}

interface ErrorItem {
  id: string;
  name: string;
  code?: string;
}

const equipments = ref<EquipmentItem[]>([]);
const masterErrors = ref<ErrorItem[]>([]);
const selectedEquipment = ref<EquipmentItem | null>(null);

// Form data for Step 2
const formState = ref({
  equipment_error_id: undefined as string | undefined,
  occurred_at: dayjs() as Dayjs,
  severity: 'medium' as 'low' | 'medium' | 'high',
  notes: '',
});

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

// ─── Fetch Equipments & Error Master Data ───
async function loadInitialData() {
  try {
    loading.value = true;
    
    // Fetch Equipments
    const equipRes = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { paginate: 'false' },
    });
    const rawEquip = equipRes.data;
    const listEquip = Array.isArray(rawEquip) ? rawEquip : (rawEquip?.data ?? []);
    equipments.value = listEquip.map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
      status: item.status || 'Active',
    }));

    // Fetch Master Equipment Errors
    const errorsRes = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const rawErrors = errorsRes.data?.data ?? errorsRes.data ?? [];
    masterErrors.value = Array.isArray(rawErrors) ? rawErrors.map((e: any) => ({
      id: e.id,
      name: e.name,
      code: e.code,
    })) : [];

  } catch (err: unknown) {
    console.error('Failed to load initial data for incident report:', err);
  } finally {
    loading.value = false;
  }
}

// ─── Filtered Equipments Search ───
const filteredEquipments = computed(() => {
  if (!searchVal.value.trim()) return equipments.value;
  const q = searchVal.value.trim().toLowerCase();
  return equipments.value.filter(
    (e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
  );
});

// ─── Equipment Selection Handlers ───
function selectEquipment(equip: EquipmentItem) {
  stopCamera();
  selectedEquipment.value = equip;
  step.value = 2; // Advance to Error Detail Form
}

function handleBack() {
  if (step.value === 2) {
    step.value = 1;
    selectedEquipment.value = null;
  } else {
    stopCamera();
    router.push('/portal');
  }
}

// ─── Live Camera Scanning Simulation / Native MediaDevices ───
async function startCameraScanner() {
  try {
    isScanningCamera.value = true;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      mediaStream.value = stream;
      if (videoRef.value) {
        videoRef.value.srcObject = stream;
        videoRef.value.play();
      }
    }
  } catch (e) {
    console.warn('Camera access error or restricted environment:', e);
  }
}

function stopCamera() {
  isScanningCamera.value = false;
  if (mediaStream.value) {
    mediaStream.value.getTracks().forEach(track => track.stop());
    mediaStream.value = null;
  }
}

// Simulate instant QR barcode detection on camera viewport tap or button
function simulateQRScanSuccess() {
  if (equipments.value.length > 0) {
    const randomEquip = equipments.value[Math.floor(Math.random() * equipments.value.length)];
    if (randomEquip) {
      message.success(`Đã quét QR thành công: ${randomEquip.code}`);
      selectEquipment(randomEquip);
    }
  } else {
    message.warning('Chưa có danh sách thiết bị để quét.');
  }
}

// ─── Submit Incident Report ───
async function handleSubmitReport() {
  if (!selectedEquipment.value) {
    message.error('Vui lòng chọn thiết bị trước khi ghi nhận!');
    return;
  }

  // Ensure an error is selected or entered
  let targetErrorId = formState.value.equipment_error_id;
  
  try {
    submitting.value = true;

    // If custom error name was entered without an ID, create temporary or pick first
    if (!targetErrorId && masterErrors.value.length > 0) {
      targetErrorId = masterErrors.value[0]?.id;
    }

    const payload = {
      equipment_id: selectedEquipment.value.id,
      equipment_error_id: targetErrorId,
      occurred_at: formState.value.occurred_at 
        ? formState.value.occurred_at.format('YYYY-MM-DD HH:mm:ss')
        : dayjs().format('YYYY-MM-DD HH:mm:ss'),
      notes: formState.value.notes ? `[Mức độ: ${formState.value.severity.toUpperCase()}] ${formState.value.notes}` : `[Mức độ: ${formState.value.severity.toUpperCase()}] Báo cáo sự cố từ Mobile Portal`,
    };

    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
      payload,
      { headers: getAuthHeaders() }
    );

    message.success('Đã ghi nhận sự cố thiết bị thành công!');
    stopCamera();
    router.push('/portal');
  } catch (err: any) {
    console.error('Failed to report incident:', err);
    message.error(err?.response?.data?.message || 'Ghi nhận sự cố thất bại. Vui lòng thử lại!');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadInitialData();
});
</script>

<template>
  <div class="min-h-[90vh] bg-slate-50 dark:bg-zinc-950/40 pb-28 select-none">
    
    <!-- ─── HEADER ─── -->
    <div class="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-b border-slate-200/70 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shadow-3xs">
      <div class="flex items-center gap-2.5">
        <Button
          type="default"
          size="small"
          class="flex items-center justify-center p-1.5 rounded-lg shrink-0 border-slate-200 dark:border-zinc-800"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <div>
          <h1 class="text-sm font-bold text-slate-800 dark:text-zinc-100 m-0 leading-tight">
            {{ step === 1 ? (t('page.portal.scanEquipment') || 'Quét / Chọn thiết bị') : (t('page.portal.reportIncident') || 'Ghi nhận sự cố') }}
          </h1>
          <p class="text-[11px] text-slate-400 dark:text-zinc-500 m-0">
            {{ step === 1 ? 'Bước 1/2: Xác định máy bị lỗi' : 'Bước 2/2: Nhập thông tin sự cố' }}
          </p>
        </div>
      </div>

      <!-- Step Badge -->
      <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
        Bước {{ step }}/2
      </span>
    </div>

    <!-- ─── STEP 1: SCAN QR CODE & SELECT EQUIPMENT ─── -->
    <div v-if="step === 1" class="p-4 space-y-4">
      
      <!-- QR Scanner Viewport Card -->
      <div class="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-hidden shadow-sm text-center">
        
        <!-- Animated Scanner Viewport -->
        <div class="relative w-48 h-48 mx-auto border-2 border-indigo-500/60 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center my-2">
          
          <!-- Live Camera Video Element -->
          <video 
            ref="videoRef" 
            class="absolute inset-0 w-full h-full object-cover" 
            v-show="isScanningCamera" 
            playsinline 
            muted
          ></video>

          <!-- Laser Scan Beam Animation -->
          <div class="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-scan-beam z-10"></div>

          <!-- Viewport Corner Bracket Highlights -->
          <div class="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-indigo-400"></div>
          <div class="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-indigo-400"></div>
          <div class="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-indigo-400"></div>
          <div class="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-indigo-400"></div>

          <!-- QR Icon Overlay when not scanning camera -->
          <div v-if="!isScanningCamera" class="flex flex-col items-center justify-center text-zinc-400 gap-1.5 p-2">
            <svg class="w-12 h-12 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75ZM6.75 16.5h.008v.008H6.75V16.5ZM16.5 6.75h.008v.008H16.5V6.75ZM13.5 13.5h1.5v1.5h-1.5v-1.5ZM16.5 13.5h1.5v1.5h-1.5v-1.5ZM15 15h1.5v1.5H15V15ZM13.5 16.5h1.5v1.5h-1.5v-1.5ZM16.5 16.5h1.5v1.5h-1.5v-1.5ZM18 18h1.5v1.5H18V18ZM19.5 15h1.5v1.5h-1.5V15ZM19.5 18h1.5v1.5h-1.5V18ZM18 19.5h1.5v1.5H18v-1.5ZM13.5 19.5h1.5v1.5h-1.5v-1.5Z" />
            </svg>
            <span class="text-xs text-zinc-300 font-medium">Hướng Camera vào mã QR</span>
          </div>
        </div>

        <!-- Scan Controls Buttons -->
        <div class="mt-3 flex gap-2 justify-center">
          <Button
            v-if="!isScanningCamera"
            type="primary"
            class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold flex items-center gap-1.5 rounded-xl text-xs h-9 px-4"
            @click="startCameraScanner"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0c-.698.04-1.332.417-1.736 1.039l-.821 1.316Z" /></svg>
            Bật Camera Quét
          </Button>

          <Button
            type="default"
            class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 font-semibold flex items-center gap-1.5 rounded-xl text-xs h-9 px-4"
            @click="simulateQRScanSuccess"
          >
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Giả lập Quét thành công
          </Button>
        </div>
      </div>

      <!-- Or Select Equipment Manually -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider m-0">
            Hoặc chọn thiết bị từ danh sách
          </h2>
          <span class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
            {{ filteredEquipments.length }} máy
          </span>
        </div>

        <!-- Search Bar -->
        <div class="mb-3">
          <Input.Search
            v-model:value="searchVal"
            placeholder="Tìm theo mã máy hoặc tên thiết bị..."
            allow-clear
            class="w-full rounded-xl"
          />
        </div>

        <!-- Equipments List -->
        <Spin :spinning="loading">
          <div v-if="filteredEquipments.length > 0" class="space-y-2.5 max-h-[45vh] overflow-y-auto pr-0.5">
            <div
              v-for="equip in filteredEquipments"
              :key="equip.id"
              class="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 cursor-pointer hover:border-indigo-400 active:scale-[0.98] transition-all shadow-3xs"
              @click="selectEquipment(equip)"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                  {{ equip.code.slice(0, 3) }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
                    {{ equip.name }}
                  </p>
                  <p class="text-[11px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5 mb-0 truncate">
                    Mã: <span class="text-indigo-600 dark:text-indigo-400 font-semibold">{{ equip.code }}</span>
                  </p>
                </div>
              </div>

              <!-- Select Arrow Button -->
              <Button type="default" size="small" class="rounded-lg text-xs font-semibold shrink-0">
                Chọn
              </Button>
            </div>
          </div>

          <div v-else class="py-12 bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center">
            <Empty description="Không tìm thấy thiết bị phù hợp" />
          </div>
        </Spin>
      </div>

    </div>

    <!-- ─── STEP 2: INCIDENT REPORTING FORM ─── -->
    <div v-else-if="step === 2 && selectedEquipment" class="p-4 space-y-4">
      
      <!-- Selected Equipment Header Card -->
      <div class="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-3.5 flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
            {{ selectedEquipment.code.slice(0, 3) }}
          </div>
          <div class="min-w-0">
            <span class="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">THIẾT BỊ ĐÃ CHỌN</span>
            <h2 class="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
              {{ selectedEquipment.name }}
            </h2>
            <p class="text-[11px] font-mono text-slate-500 dark:text-zinc-400 m-0">
              Mã: {{ selectedEquipment.code }}
            </p>
          </div>
        </div>

        <Button
          type="default"
          size="small"
          class="rounded-lg text-[11px] font-semibold shrink-0 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
          @click="step = 1"
        >
          Đổi máy
        </Button>
      </div>

      <!-- Incident Form Fields Card -->
      <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-3xs">
        
        <!-- Error Type Selection -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
            Loại sự cố / Mã lỗi <span class="text-red-500">*</span>
          </label>
          
          <Select
            v-model:value="formState.equipment_error_id"
            placeholder="-- Chọn danh mục lỗi --"
            class="w-full rounded-xl"
            allow-clear
          >
            <Select.Option v-for="errItem in masterErrors" :key="errItem.id" :value="errItem.id">
              {{ errItem.name }} {{ errItem.code ? `(${errItem.code})` : '' }}
            </Select.Option>
          </Select>
        </div>

        <!-- Occurred At Time -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
            Thời điểm phát hiện sự cố
          </label>
          <DatePicker
            v-model:value="formState.occurred_at"
            show-time
            format="YYYY-MM-DD HH:mm"
            class="w-full rounded-xl"
          />
        </div>

        <!-- Severity Chips -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
            Mức độ khẩn cấp
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              @click="formState.severity = 'low'"
              :class="[
                'py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer outline-none flex items-center justify-center gap-1',
                formState.severity === 'low'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
              ]"
            >
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              Bình thường
            </button>

            <button
              type="button"
              @click="formState.severity = 'medium'"
              :class="[
                'py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer outline-none flex items-center justify-center gap-1',
                formState.severity === 'medium'
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
              ]"
            >
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              Cần kiểm tra
            </button>

            <button
              type="button"
              @click="formState.severity = 'high'"
              :class="[
                'py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer outline-none flex items-center justify-center gap-1',
                formState.severity === 'high'
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
              ]"
            >
              <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              Khẩn cấp
            </button>
          </div>
        </div>

        <!-- Description Notes -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
            Mô tả chi tiết sự cố / Hiện tượng hỏng hóc
          </label>
          <Input.TextArea
            v-model:value="formState.notes"
            :rows="3"
            placeholder="Mô tả hiện tượng hỏng hóc (Ví dụ: Động cơ kêu to, rò rỉ dầu thủy lực tại van số 2...)"
            class="rounded-xl"
          />
        </div>

      </div>

    </div>

    <!-- ─── FIXED BOTTOM BAR FOR STEP 2 SUBMIT ─── -->
    <div v-if="step === 2" class="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-zinc-800/60 p-4">
      <Button
        type="primary"
        size="large"
        block
        :loading="submitting"
        class="h-12 bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2"
        @click="handleSubmitReport"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
        Ghi Nhận Sự Cố Thiết Bị
      </Button>
    </div>

  </div>
</template>

<style scoped>
@keyframes scan-beam {
  0% { top: 0%; }
  50% { top: 100%; }
  100% { top: 0%; }
}
.animate-scan-beam {
  animation: scan-beam 2.5s ease-in-out infinite;
}
</style>
