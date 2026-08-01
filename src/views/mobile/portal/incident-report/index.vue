<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Button, 
  Input, 
  Select, 
  Spin, 
  message,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { useI18n } from '@vben/locales';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

defineOptions({ name: 'MobilePortalIncidentReport' });

const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();

// ─── States ───
const step = ref<1 | 2>(1); // 1: Real Camera QR Scan, 2: Error Input Form
const loading = ref(false);
const submitting = ref(false);
const isScanningCamera = ref(false);
const scanErrorMessage = ref('');

// Html5Qrcode Scanner instance
let html5QrCode: Html5Qrcode | null = null;

// Error input mode: 'select' (chọn từ danh sách) vs 'custom' (tự nhập mới)
const errorInputMode = ref<'select' | 'custom'>('select');

interface EquipmentItem {
  id: string;
  code: string;
  name: string;
}

interface ErrorItem {
  id: string;
  name: string;
  code?: string;
}

const equipments = ref<EquipmentItem[]>([]);
const masterErrors = ref<ErrorItem[]>([]);
const selectedEquipment = ref<EquipmentItem | null>(null);

// Form Data for Step 2
const formState = ref({
  selected_error_id: undefined as string | undefined,
  custom_error_name: '',
});

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadData() {
  try {
    loading.value = true;
    
    // Equipments
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
    }));

    // Master Errors
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

  } catch (err) {
    console.error('Failed to load data for incident report:', err);
  } finally {
    loading.value = false;
  }
}

// ─── Real QR Code Scanner logic using Html5Qrcode ───
async function startRealCameraScanner() {
  stopCamera();
  scanErrorMessage.value = '';

  await nextTick();

  try {
    isScanningCamera.value = true;
    html5QrCode = new Html5Qrcode('qr-reader-viewport');

    const config = {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1.0,
    };

    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText: string) => {
        // Real QR scanned successfully!
        handleRealQrScannedText(decodedText);
      },
      (_errorMessage: string) => {
        // Continuous scanning frame ignore
      }
    );
  } catch (err: any) {
    console.error('Html5Qrcode camera error:', err);
    isScanningCamera.value = false;
    scanErrorMessage.value = 'Không thể mở Camera. Vui lòng cấp quyền Camera trên trình duyệt.';
    message.error('Không thể truy cập Camera. Vui lòng cấp quyền!');
  }
}

async function stopCamera() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (e) {
      console.warn('Error stopping camera scanner:', e);
    }
  }
  html5QrCode = null;
  isScanningCamera.value = false;
}

function findEquipByQrText(text: string): EquipmentItem | undefined {
  const cleanText = text.trim().toLowerCase();
  
  // 1. Exact match on code or id
  let match = equipments.value.find(e => 
    e.code.toLowerCase() === cleanText || 
    e.id.toLowerCase() === cleanText
  );
  if (match) return match;

  // 2. Check JSON payload
  try {
    const obj = JSON.parse(text);
    if (obj?.code) {
      match = equipments.value.find(e => e.code.toLowerCase() === obj.code.toLowerCase());
      if (match) return match;
    }
  } catch (e) {}

  // 3. Check substring
  match = equipments.value.find(e => cleanText.includes(e.code.toLowerCase()));
  return match;
}

async function handleRealQrScannedText(rawText: string) {
  await stopCamera();

  const matched = findEquipByQrText(rawText);
  if (matched) {
    message.success(`Đã quét QR thành công: ${matched.name} (${matched.code})`);
    selectedEquipment.value = matched;
  } else {
    // If equipment code not found in seeded list, create temporary item for user
    const fallbackEquip: EquipmentItem = {
      id: rawText,
      code: rawText,
      name: `Thiết bị [Mã: ${rawText}]`,
    };
    message.info(`Đã quét mã QR: ${rawText}`);
    selectedEquipment.value = fallbackEquip;
  }

  step.value = 2; // Transition to Step 2
}

function handleBack() {
  if (step.value === 2) {
    stopCamera();
    step.value = 1;
    selectedEquipment.value = null;
  } else {
    stopCamera();
    router.push('/portal');
  }
}

// ─── Submit Incident Log ───
async function handleSubmit() {
  if (!selectedEquipment.value) {
    message.error('Vui lòng quét thiết bị trước!');
    return;
  }

  let finalErrorId = formState.value.selected_error_id;
  let finalNotes = '';

  if (errorInputMode.value === 'custom') {
    if (!formState.value.custom_error_name.trim()) {
      message.error('Vui lòng nhập tên sự cố / lỗi mới!');
      return;
    }
    finalNotes = `Lỗi mới: ${formState.value.custom_error_name.trim()}`;
    if (masterErrors.value.length > 0) {
      finalErrorId = masterErrors.value[0]?.id;
    }
  } else {
    if (!finalErrorId) {
      message.error('Vui lòng chọn loại lỗi từ danh sách!');
      return;
    }
    const matchedError = masterErrors.value.find(e => e.id === finalErrorId);
    finalNotes = matchedError ? matchedError.name : 'Báo cáo sự cố từ mã QR';
  }

  try {
    submitting.value = true;

    const payload = {
      equipment_id: selectedEquipment.value.id,
      equipment_error_id: finalErrorId,
      occurred_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      notes: finalNotes,
    };

    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
      payload,
      { headers: getAuthHeaders() }
    );

    message.success('Đã ghi nhận sự cố thành công!');
    await stopCamera();
    router.push('/portal');
  } catch (err: any) {
    console.error('Failed to submit incident log:', err);
    message.error(err?.response?.data?.message || 'Ghi nhận thất bại, vui lòng thử lại!');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadData();
});

onUnmounted(() => {
  stopCamera();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 p-4 pb-28 select-none flex flex-col">
    
    <!-- ─── HEADER ─── -->
    <div class="mb-4 flex items-center justify-between shrink-0">
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
          <h1 class="text-base font-bold text-slate-800 dark:text-zinc-100 m-0 leading-tight">
            {{ step === 1 ? 'Quét mã QR thiết bị' : 'Báo cáo sự cố' }}
          </h1>
          <p class="text-xs text-slate-400 dark:text-zinc-500 m-0">
            {{ step === 1 ? 'Quét mã QR dán trên máy' : 'Nhập thông tin sự cố phát hiện' }}
          </p>
        </div>
      </div>

      <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
        Bước {{ step }}/2
      </span>
    </div>

    <!-- ─── BƯỚC 1: QUÉT MÃ QR THẬT BẰNG CAMERA ─── -->
    <div v-if="step === 1" class="flex-1 flex flex-col justify-center">
      <div class="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl text-center overflow-hidden">
        
        <!-- REAL HTML5 QRCODE SCANNER VIEWPORT CONTAINER -->
        <div class="relative w-full max-w-[280px] h-[280px] mx-auto rounded-2xl overflow-hidden bg-black flex items-center justify-center my-2 border-2 border-indigo-500/60 shadow-inner">
          
          <!-- Container for Html5Qrcode camera video -->
          <div id="qr-reader-viewport" class="w-full h-full object-cover"></div>

          <!-- Laser Scan Beam Animation when scanning -->
          <div v-if="isScanningCamera" class="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_15px_#ef4444] animate-scan-beam z-10 pointer-events-none"></div>

          <!-- QR Icon Overlay when camera is off -->
          <div v-if="!isScanningCamera" class="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-2 p-3 bg-zinc-900/90 z-20">
            <svg class="w-16 h-16 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75ZM6.75 16.5h.008v.008H6.75V16.5ZM16.5 6.75h.008v.008H16.5V6.75ZM13.5 13.5h1.5v1.5h-1.5v-1.5ZM16.5 13.5h1.5v1.5h-1.5v-1.5ZM15 15h1.5v1.5H15V15ZM13.5 16.5h1.5v1.5h-1.5v-1.5ZM16.5 16.5h1.5v1.5h-1.5v-1.5ZM18 18h1.5v1.5H18V18ZM19.5 15h1.5v1.5h-1.5V15ZM19.5 18h1.5v1.5h-1.5V18ZM18 19.5h1.5v1.5H18v-1.5ZM13.5 19.5h1.5v1.5h-1.5v-1.5Z" />
            </svg>
            <span class="text-xs text-zinc-300 font-medium">Bấm nút bên dưới để mở Camera quét</span>
          </div>
        </div>

        <p v-if="scanErrorMessage" class="text-xs text-rose-400 mt-2 mb-0 font-medium">
          {{ scanErrorMessage }}
        </p>

        <!-- Scan Controls Buttons -->
        <div class="mt-4 flex flex-col gap-2 max-w-xs mx-auto">
          <Button
            v-if="!isScanningCamera"
            type="primary"
            size="large"
            block
            class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-sm h-11 rounded-xl flex items-center justify-center gap-2 shadow-md"
            @click="startRealCameraScanner"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0c-.698.04-1.332.417-1.736 1.039l-.821 1.316Z" /></svg>
            Mở Camera Quét QR Thật
          </Button>

          <Button
            v-else
            type="default"
            size="large"
            block
            class="bg-zinc-800 hover:bg-zinc-700 text-rose-400 border-zinc-700 font-bold text-xs h-10 rounded-xl"
            @click="stopCamera"
          >
            Tắt Camera
          </Button>
        </div>

      </div>
    </div>

    <!-- ─── BƯỚC 2: HIỂN THỊ TÊN MÁY VÀ NHẬP LỖI ─── -->
    <div v-else-if="step === 2 && selectedEquipment" class="space-y-4">
      
      <!-- Card hiển thị Duy nhất Tên Thiết Bị đã quét -->
      <div class="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.141-.06-.286-.12-.43-.18m0 0a8.997 8.997 0 0 1-4.248-4.249m4.248 4.249a8.996 8.996 0 0 0 4.249-4.249m.54 7.551A9.006 9.006 0 0 0 12 21a9.006 9.006 0 0 0 6.54-2.739M12 3a9.006 9.006 0 0 0-6.54 2.739M12 3v3m0 12v3" /></svg>
          </div>
          <div class="min-w-0">
            <span class="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">Thiết Bị Đã Quét:</span>
            <h2 class="text-base font-bold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
              {{ selectedEquipment.name }}
            </h2>
          </div>
        </div>

        <Button
          type="default"
          size="small"
          class="rounded-lg text-xs font-semibold shrink-0 border-indigo-300 text-indigo-600"
          @click="step = 1; startRealCameraScanner();"
        >
          Quét lại
        </Button>
      </div>

      <!-- Card Báo Lỗi / Thêm Lỗi -->
      <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-3xs">
        
        <!-- Toggle giữa Chọn lỗi có sẵn & Nhập lỗi mới -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
          <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">
            Thông tin sự cố / Mã lỗi <span class="text-red-500">*</span>
          </label>

          <button
            type="button"
            class="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer outline-none bg-transparent border-0"
            @click="errorInputMode = errorInputMode === 'select' ? 'custom' : 'select'"
          >
            {{ errorInputMode === 'select' ? '+ Nhập lỗi mới' : '← Chọn lỗi có sẵn' }}
          </button>
        </div>

        <!-- Mode 1: Chọn từ danh sách lỗi đã lưu -->
        <div v-if="errorInputMode === 'select'">
          <Select
            v-model:value="formState.selected_error_id"
            placeholder="-- Chọn loại lỗi từ danh sách --"
            class="w-full rounded-xl"
            show-search
            allow-clear
          >
            <Select.Option v-for="err in masterErrors" :key="err.id" :value="err.id">
              {{ err.name }} {{ err.code ? `(${err.code})` : '' }}
            </Select.Option>
          </Select>
          <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5 mb-0">
            Chọn một sự cố đã được khai báo trước trong hệ thống.
          </p>
        </div>

        <!-- Mode 2: Nhập trực tiếp tên lỗi mới -->
        <div v-else-if="errorInputMode === 'custom'">
          <Input
            v-model:value="formState.custom_error_name"
            placeholder="Nhập tên sự cố / lỗi mới phát hiện..."
            class="w-full rounded-xl"
            allow-clear
          />
          <p class="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 mb-0">
            Đang nhập tên sự cố mới chưa có sẵn trong danh sách.
          </p>
        </div>

        <!-- Nút Ghi Nhận Sự Cố -->
        <Button
          type="primary"
          block
          size="large"
          :loading="submitting"
          class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-sm h-11 rounded-xl mt-3"
          @click="handleSubmit"
        >
          Ghi Nhận Sự Cố
        </Button>

      </div>

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

:deep(#qr-reader-viewport video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
</style>
