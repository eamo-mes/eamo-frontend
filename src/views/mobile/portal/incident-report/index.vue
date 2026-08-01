<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
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
import { useI18n } from '@vben/locales';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

defineOptions({ name: 'MobilePortalIncidentReport' });

const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();

// ─── States ───
const step = ref<1 | 2>(1); // 1: QR Scan, 2: Error Input Form
const loading = ref(false);
const submitting = ref(false);
const isScanningCamera = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);
const mediaStream = ref<MediaStream | null>(null);

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

// ─── Camera & QR Scan Handlers ───
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
    console.warn('Camera access error:', e);
  }
}

function stopCamera() {
  isScanningCamera.value = false;
  if (mediaStream.value) {
    mediaStream.value.getTracks().forEach(track => track.stop());
    mediaStream.value = null;
  }
}

function onScanSuccess(equip: EquipmentItem) {
  stopCamera();
  selectedEquipment.value = equip;
  step.value = 2; // Transition to Step 2
}

function simulateQRScanSuccess() {
  if (equipments.value.length > 0) {
    const randomEquip = equipments.value[Math.floor(Math.random() * equipments.value.length)];
    if (randomEquip) {
      message.success(`Đã quét mã QR: ${randomEquip.name}`);
      onScanSuccess(randomEquip);
    }
  } else {
    message.warning('Chưa có danh sách thiết bị để quét.');
  }
}

// ─── Submit Incident Log ───
async function handleSubmit() {
  if (!selectedEquipment.value) {
    message.error('Vui lòng chọn hoặc quét thiết bị trước!');
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
    // Fallback error ID if required by backend API schema
    if (masterErrors.value.length > 0) {
      finalErrorId = masterErrors.value[0]?.id;
    }
  } else {
    if (!finalErrorId) {
      message.error('Vui lòng chọn loại lỗi từ danh sách!');
      return;
    }
    const matchedError = masterErrors.value.find(e => e.id === finalErrorId);
    finalNotes = matchedError ? matchedError.name : 'Báo cáo sự cố từ QR Code';
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
            {{ step === 1 ? 'Quét mã QR trên máy để bắt đầu' : 'Nhập thông tin sự cố phát hiện' }}
          </p>
        </div>
      </div>

      <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
        Bước {{ step }}/2
      </span>
    </div>

    <!-- ─── BƯỚC 1: QUÉT MÃ QR ─── -->
    <div v-if="step === 1" class="flex-1 flex flex-col justify-center">
      <div class="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl text-center overflow-hidden">
        
        <!-- Animated Scanner Viewport -->
        <div class="relative w-60 h-60 mx-auto border-2 border-indigo-500/70 rounded-2xl overflow-hidden bg-black/60 flex items-center justify-center my-3 shadow-inner">
          
          <!-- Live Camera Video Element -->
          <video 
            ref="videoRef" 
            class="absolute inset-0 w-full h-full object-cover" 
            v-show="isScanningCamera" 
            playsinline 
            muted
          ></video>

          <!-- Laser Scan Beam Animation -->
          <div class="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_15px_#ef4444] animate-scan-beam z-10"></div>

          <!-- Viewport Corner Bracket Highlights -->
          <div class="absolute top-3 left-3 w-5 h-5 border-t-3 border-l-3 border-indigo-400 rounded-tl"></div>
          <div class="absolute top-3 right-3 w-5 h-5 border-t-3 border-r-3 border-indigo-400 rounded-tr"></div>
          <div class="absolute bottom-3 left-3 w-5 h-5 border-b-3 border-l-3 border-indigo-400 rounded-bl"></div>
          <div class="absolute bottom-3 right-3 w-5 h-5 border-b-3 border-r-3 border-indigo-400 rounded-br"></div>

          <!-- QR Icon Overlay when not scanning camera -->
          <div v-if="!isScanningCamera" class="flex flex-col items-center justify-center text-zinc-400 gap-2 p-3">
            <svg class="w-16 h-16 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75ZM6.75 16.5h.008v.008H6.75V16.5ZM16.5 6.75h.008v.008H16.5V6.75ZM13.5 13.5h1.5v1.5h-1.5v-1.5ZM16.5 13.5h1.5v1.5h-1.5v-1.5ZM15 15h1.5v1.5H15V15ZM13.5 16.5h1.5v1.5h-1.5v-1.5ZM16.5 16.5h1.5v1.5h-1.5v-1.5ZM18 18h1.5v1.5H18V18ZM19.5 15h1.5v1.5h-1.5V15ZM19.5 18h1.5v1.5h-1.5V18ZM18 19.5h1.5v1.5H18v-1.5ZM13.5 19.5h1.5v1.5h-1.5v-1.5Z" />
            </svg>
            <span class="text-xs text-zinc-300 font-medium">Hướng Camera vào mã QR trên máy</span>
          </div>
        </div>

        <!-- Scan Controls Buttons -->
        <div class="mt-4 flex flex-col gap-2.5 max-w-xs mx-auto">
          <Button
            v-if="!isScanningCamera"
            type="primary"
            size="large"
            block
            class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-sm h-11 rounded-xl flex items-center justify-center gap-2 shadow-md"
            @click="startCameraScanner"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0c-.698.04-1.332.417-1.736 1.039l-.821 1.316Z" /></svg>
            Bật Camera Quét
          </Button>

          <Button
            type="default"
            size="large"
            block
            class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 font-semibold text-xs h-10 rounded-xl flex items-center justify-center gap-2"
            @click="simulateQRScanSuccess"
          >
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            Giả lập Quét mã QR
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
          @click="step = 1"
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
</style>
