<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { getVNNowString } from '#/utils/date';
import QrCameraScanner, { type EquipmentItem as QrEquipmentItem } from '../components/QrCameraScanner.vue';

defineOptions({ name: 'MobilePortalErrorHandlingIndex' });

const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();

interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  device_id?: string | null;
}

const equipments = ref<EquipmentItem[]>([]);
const qrScannerRef = ref<InstanceType<typeof QrCameraScanner> | null>(null);

function getAuthHeaders() {
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
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch (err: unknown) {
    console.error('Failed to load equipments:', err);
  }
}

// ─── QR Scanned Handler ───
function handleQrScanned(payload: { rawText: string; matchedEquipment?: QrEquipmentItem }) {
  const { rawText, matchedEquipment } = payload;
  const equipId = matchedEquipment?.id || rawText;

  message.success(t('page.portal.msgScanSuccessWithCode') || 'Quét mã QR thành công!');
  qrScannerRef.value?.stopCamera();
  const scanTime = getVNNowString();
  router.push(`/portal/error-handling/${equipId}?scan_time=${encodeURIComponent(scanTime)}`);
}

function handleBack() {
  qrScannerRef.value?.stopCamera();
  router.push('/portal');
}

onMounted(() => {
  loadEquipments();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-6">
    <!-- ─── HEADER ─── -->
    <div class="bg-white dark:bg-zinc-900 border-b border-slate-200/70 dark:border-zinc-800 px-4 py-3">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 flex-1 truncate">
          {{ t('page.portal.handleErrorTitle') }}
        </h1>
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
          {{ t('page.portal.step1Of2') }}
        </span>
      </div>
    </div>

    <!-- ─── CONTENT: CAMERA QR SCANNER ONLY ─── -->
    <div class="pt-4 px-4 flex flex-col items-center pb-6">
      <QrCameraScanner
        ref="qrScannerRef"
        :equipments="equipments"
        viewport-id="qr-error-handling-viewport"
        @scanned="handleQrScanned"
      />
    </div>
  </div>
</template>
