<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { useI18n } from '@vben/locales';
import axios from 'axios';
import { useAccessStore, useUserStore } from '@vben/stores';
import { getVNNowString } from '#/utils/date';
import { API_BASE_URL } from '#/api/config';
import QrCameraScanner, { type EquipmentItem as QrEquipmentItem } from '../components/QrCameraScanner.vue';

defineOptions({ name: 'MobilePortalEmergencyStop' });

const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();
const userStore = useUserStore();

const EMERGENCY_STOP_ERROR_ID = 'emergency_stop';

// ─── Step: 1 = big red button, 2 = QR scan ───
const step = ref<1 | 2>(1);
const submitting = ref(false);
const equipments = ref<QrEquipmentItem[]>([]);

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
      params: { paginate: 'false' },
    });
    const raw = res.data;
    const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
    equipments.value = list.map((item: { id: string; code: string; name?: string | null }) => ({
      id: item.id,
      code: item.code,
      name: item.name || item.code,
    }));
  } catch (err) {
    console.error('Failed to load equipments for emergency stop:', err);
  }
}

function handleBack() {
  if (step.value === 2) {
    step.value = 1;
  } else {
    router.push('/portal');
  }
}

// ─── Step 1 → Step 2: activate QR scan ───
function handleEmergencyTrigger() {
  step.value = 2;
}

// ─── After QR scanned: auto-submit emergency_stop log ───
async function handleQrScanned(payload: { rawText: string; matchedEquipment?: QrEquipmentItem }) {
  const { rawText, matchedEquipment } = payload;

  const equipmentId = matchedEquipment?.id ?? rawText;
  const equipmentName = matchedEquipment?.name || matchedEquipment?.code || rawText;

  try {
    submitting.value = true;
    const currentUserId = userStore.userInfo?.userId || userStore.userInfo?.id;

    const postPayload: Record<string, unknown> = {
      equipment_id: equipmentId,
      equipment_error_id: EMERGENCY_STOP_ERROR_ID,
      occurred_at: getVNNowString(),
      is_handled: false,
      notes: `Emergency stop triggered for: ${equipmentName}`,
    };
    if (currentUserId) {
      postPayload.handler_ids = [currentUserId];
    }

    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
      postPayload,
      { headers: getAuthHeaders() }
    );

    message.success(t('page.portal.emergencyStopSuccess', { name: equipmentName }));
    router.push('/portal');
  } catch (err: any) {
    console.error('Failed to submit emergency stop log:', err);
    message.error(
      err?.response?.data?.message || t('page.portal.msgSubmitFailed')
    );
    // stay on scan step so user can retry
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadEquipments();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 flex flex-col">
    <!-- ─── HEADER ─── -->
    <div class="bg-white dark:bg-zinc-900 border-b border-slate-200/70 dark:border-zinc-800 px-4 pt-4 pb-3 flex items-center gap-3">
      <button
        type="button"
        class="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
        @click="handleBack"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 flex-1 truncate">
        {{ step === 1 ? t('page.portal.emergencyStopTitle') : t('page.portal.scanEquipment') }}
      </h1>
      <!-- Step badge -->
      <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
        {{ t('page.portal.stepBadge', { step }) }}
      </span>
    </div>

    <!-- ─── STEP 1: Big Red Emergency Button ─── -->
    <div v-if="step === 1" class="flex-1 flex flex-col items-center justify-center">
      <div class="text-center mb-6">
        <p class="text-xs text-red-500 font-bold uppercase tracking-widest">{{ t('page.portal.emergencySystem') }}</p>
        <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 max-w-[240px]">{{ t('page.portal.emergencyInstruction') }}</p>
      </div>

      <button
        type="button"
        @click="handleEmergencyTrigger"
        class="emergency-btn w-40 h-40 rounded-full bg-red-600 active:scale-95 text-white font-extrabold uppercase text-sm tracking-wider flex items-center justify-center flex-col gap-1 shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] transition-all duration-300 border-[10px] border-amber-500/80 cursor-pointer outline-none relative"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-octagon-alert mb-1 animate-pulse"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        <span>{{ t('page.portal.emergencyBtnLabel') }}</span>
        <span>{{ t('page.portal.emergencyBtnSub') }}</span>
      </button>

      <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-8 text-center max-w-[240px]">
        {{ t('page.portal.emergencyTapToScan') }}
      </p>
    </div>

    <!-- ─── STEP 2: QR Camera Scan ─── -->
    <div v-if="step === 2" class="flex-1 flex flex-col items-center pt-6 px-4 pb-6">
      <!-- Alert banner -->
      <div class="w-full max-w-[320px] mb-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl px-4 py-3 flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        <div>
          <p class="text-xs font-bold text-red-600 dark:text-red-400 m-0 leading-tight">
            {{ t('page.portal.emergencyStopTitle') }}
          </p>
          <p class="text-[11px] text-red-500/80 dark:text-red-400/70 m-0 mt-0.5">
            {{ t('page.portal.emergencyScanInstruction') }}
          </p>
      </div>

      <!-- Submitting overlay feedback -->
      <div v-if="submitting" class="flex flex-col items-center justify-center gap-3 py-8">
        <svg class="animate-spin w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <p class="text-sm font-semibold text-red-600">{{ t('page.portal.emergencySubmitting') }}</p>
      </div>

      <QrCameraScanner
        v-else
        :equipments="equipments"
        viewport-id="qr-emergency-viewport"
        @scanned="handleQrScanned"
      />
    </div>
  </div>
</template>

<style scoped>
.emergency-btn::before {
  content: '';
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  border: 2px dashed rgba(239, 68, 68, 0.4);
  animation: rotate-dashed 20s linear infinite;
}

@keyframes rotate-dashed {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(#qr-emergency-viewport video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
</style>
