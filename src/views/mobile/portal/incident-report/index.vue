<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Button, message } from 'ant-design-vue';
import axios from 'axios';
import { useI18n } from '@vben/locales';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

defineOptions({ name: 'MobilePortalIncidentReport' });

const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();

const isScanningCamera = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);
const mediaStream = ref<MediaStream | null>(null);

interface EquipmentItem {
  id: string;
  code: string;
  name: string;
}

const equipments = ref<EquipmentItem[]>([]);

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadEquipments() {
  try {
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
  } catch (err) {
    console.error('Failed to load equipments for QR scan:', err);
  }
}

function handleBack() {
  stopCamera();
  router.push('/portal');
}

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

function simulateQRScanSuccess() {
  if (equipments.value.length > 0) {
    const randomEquip = equipments.value[Math.floor(Math.random() * equipments.value.length)];
    if (randomEquip) {
      message.success(t('page.portal.msgScanSuccess', { code: randomEquip.code }) || `Đã quét QR thành công: ${randomEquip.code}`);
      stopCamera();
      router.push('/portal');
    }
  } else {
    message.warning(t('page.portal.noEquipmentsToScan') || 'Chưa có danh sách thiết bị để quét.');
  }
}

onMounted(() => {
  loadEquipments();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 p-4 pb-28 select-none flex flex-col">
    
    <!-- ─── HEADER ─── -->
    <div class="mb-4 flex items-center gap-2.5 shrink-0">
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
          {{ t('page.portal.scanEquipment') || 'Quét mã QR thiết bị' }}
        </h1>
        <p class="text-xs text-slate-400 dark:text-zinc-500 m-0">
          {{ t('page.portal.aimCameraAtQR') || 'Hướng Camera vào mã QR trên máy' }}
        </p>
      </div>
    </div>

    <!-- ─── QR CODE SCANNER ONLY ─── -->
    <div class="flex-1 flex flex-col justify-center">
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
            <span class="text-xs text-zinc-300 font-medium">{{ t('page.portal.aimCameraAtQR') || 'Hướng Camera vào mã QR' }}</span>
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
            {{ t('page.portal.btnTurnOnCamera') || 'Bật Camera Quét' }}
          </Button>

          <Button
            type="default"
            size="large"
            block
            class="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 font-semibold text-xs h-10 rounded-xl flex items-center justify-center gap-2"
            @click="simulateQRScanSuccess"
          >
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            {{ t('page.portal.btnSimulateScanSuccess') || 'Giả lập Quét mã QR' }}
          </Button>
        </div>

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
