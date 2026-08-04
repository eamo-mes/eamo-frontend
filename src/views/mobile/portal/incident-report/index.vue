<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Button, 
  Input, 
  Select, 
  message,
} from 'ant-design-vue';
import axios from 'axios';
import { useI18n } from '@vben/locales';
import { useAccessStore, useUserStore } from '@vben/stores';
import { getVNNowString } from '#/utils/date';
import { API_BASE_URL } from '#/api/config';
import QrCameraScanner, { type EquipmentItem as QrEquipmentItem } from '../components/QrCameraScanner.vue';

defineOptions({ name: 'MobilePortalIncidentReport' });

const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();
const userStore = useUserStore();

// ─── States ───
const step = ref<1 | 2>(1); // 1: Real Camera QR Scan, 2: Error Input Form
const loading = ref(false);
const submitting = ref(false);

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

const errorSearchQuery = ref('');
const scanTimestamp = ref<string | null>(null);

const filteredMasterErrors = computed(() => {
  if (!errorSearchQuery.value.trim()) return masterErrors.value;
  const q = errorSearchQuery.value.trim().toLowerCase();
  return masterErrors.value.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      (e.code && e.code.toLowerCase().includes(q))
  );
});

function toggleSelectError(id: string) {
  if (formState.value.selected_error_id === id) {
    formState.value.selected_error_id = undefined;
  } else {
    formState.value.selected_error_id = id;
  }
}

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
    equipments.value = listEquip.map((item: { id: string; code: string; name?: string | null }) => ({
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
    masterErrors.value = Array.isArray(rawErrors) ? rawErrors.map((e: { id: string; name: string; code?: string }) => ({
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

// ─── Shared QR Camera Scanner Event Handler ───
function handleQrScanned(payload: { rawText: string; matchedEquipment?: QrEquipmentItem }) {
  const { rawText, matchedEquipment } = payload;

  if (matchedEquipment) {
    message.success(
      t('page.portal.msgScanSuccessWithCode') ||
      'Quét mã QR thành công!'
    );
    selectedEquipment.value = {
      id: matchedEquipment.id,
      code: matchedEquipment.code,
      name: matchedEquipment.name || matchedEquipment.code,
    };
  } else {
    // Fallback equipment placeholder if equipment is not in master list
    const fallbackEquip: EquipmentItem = {
      id: rawText,
      code: rawText,
      name: t('page.portal.fallbackEquipName', { code: rawText }) || `Thiết bị [Mã: ${rawText}]`,
    };
    selectedEquipment.value = fallbackEquip;
  }

  scanTimestamp.value = getVNNowString();

  step.value = 2;
}

function handleBack() {
  if (step.value === 2) {
    step.value = 1;
    selectedEquipment.value = null;
  } else {
    router.push('/portal');
  }
}

// ─── Submit Incident Log ───
async function handleSubmit() {
  if (!selectedEquipment.value) {
    message.error(t('page.portal.msgScanEquipFirst') || 'Vui lòng quét thiết bị trước!');
    return;
  }

  const finalErrorId = formState.value.selected_error_id;
  if (!finalErrorId) {
    message.error(t('page.portal.msgSelectErrorFromList') || 'Vui lòng chọn loại lỗi từ danh sách!');
    return;
  }

  const matchedError = masterErrors.value.find(e => e.id === finalErrorId);
  const finalNotes = matchedError ? matchedError.name : 'Báo cáo sự cố từ mã QR';

    try {
      submitting.value = true;
      const currentUserId = userStore.userInfo?.userId || userStore.userInfo?.id;
      const payload: Record<string, unknown> = {
        equipment_id: selectedEquipment.value.id,
        equipment_error_id: finalErrorId,
        occurred_at: scanTimestamp.value || getVNNowString(),
        is_handled: false,
        notes: finalNotes,
      };
      if (currentUserId) {
        payload.handler_ids = [currentUserId];
      }

    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
      payload,
      { headers: getAuthHeaders() }
    );

    message.success(t('page.portal.msgSubmitSuccess') || 'Đã ghi nhận sự cố thành công!');
    router.push('/portal');
  } catch (err: any) {
    console.error('Failed to submit incident log:', err);
    message.error(err?.response?.data?.message || t('page.portal.msgSubmitFailed') || 'Ghi nhận thất bại, vui lòng thử lại!');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-6">
    
    <!-- ─── HEADER ─── -->
    <div class="bg-white dark:bg-zinc-900 border-b border-slate-200/70 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          class="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 leading-tight truncate">
          {{ step === 1 ? (t('page.portal.scanEquipment') || 'Quét mã QR thiết bị') : (t('page.portal.reportIncident') || 'Báo cáo sự cố') }}
        </h1>
      </div>

      <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
        {{ t('page.portal.stepBadge', { step: step }) || `Bước ${step}/2` }}
      </span>
    </div>

    <!-- ─── CONTENT ─── -->
    <div class="pt-4 px-4">
      
      <!-- ─── BƯỚC 1: QUÉT MÃ QR ─── -->
      <div v-if="step === 1" class="flex flex-col items-center pb-6">
        <QrCameraScanner
          :equipments="equipments"
          viewport-id="qr-incident-viewport"
          @scanned="handleQrScanned"
        />
      </div>

      <!-- ─── BƯỚC 2: HIỂN THỊ TÊN MÁY VÀ NHẬP LỖI ─── -->
      <div v-if="step === 2 && selectedEquipment" class="space-y-4">
        
        <!-- Card hiển thị Duy nhất Tên Thiết Bị đã quét -->
        <div class="bg-white dark:bg-indigo-950/50 border border-slate-200/80 dark:border-indigo-800/60 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
          <div class="flex items-center gap-3 min-w-0">
            <div class="min-w-0">
              <span class="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">{{ t('page.portal.scannedEquipment') || 'Thiết Bị Đã Quét:' }}</span>
              <h2 class="text-base font-bold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
                {{ selectedEquipment?.name }}
              </h2>
            </div>
          </div>
        </div>

        <!-- Card Báo Lỗi / Thêm Lỗi -->
        <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-3xs">
          
          <!-- Toggle giữa Chọn lỗi có sẵn & Nhập lỗi mới -->
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
            <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">
              {{ t('page.portal.labelErrorType') || 'Thông tin sự cố / Mã lỗi' }} <span class="text-red-500">*</span>
            </label>
          </div>

          <!-- Danh sách dạng chọn duy nhất (Single-choice Selection Cards/Chips) -->
          <div class="space-y-2.5">
            <!-- Tìm kiếm nếu danh sách có nhiều hơn 4 lỗi -->
            <Input
              v-if="masterErrors.length > 4"
              v-model:value="errorSearchQuery"
              :placeholder="t('page.portal.searchErrorPlaceholder') || 'Tìm kiếm loại sự cố / mã lỗi...'"
              size="small"
              class="rounded-xl text-xs"
              allow-clear
            />

            <!-- Danh sách dạng thẻ/nút chọn duy nhất -->
            <div v-if="filteredMasterErrors.length > 0" class="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              <div
                v-for="err in filteredMasterErrors"
                :key="err.id"
                :class="[
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 select-none border',
                  formState.selected_error_id === err.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-600 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold ring-1 ring-indigo-600/30'
                    : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/70 text-slate-700 dark:text-zinc-300 hover:border-indigo-300 dark:hover:border-indigo-700'
                ]"
                @click="toggleSelectError(err.id)"
              >
                <!-- Checkmark icon khi được chọn -->
                <svg v-if="formState.selected_error_id === err.id" class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span>{{ err.name }}</span>
                <span v-if="err.code" class="text-[10px] opacity-75 font-mono">({{ err.code }})</span>
              </div>
            </div>

            <div v-else class="text-center py-4 text-xs text-slate-400">
              Không tìm thấy loại lỗi phù hợp.
            </div>

            <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 mb-0">
              {{ t('page.portal.descSelectExistingError') || 'Chạm vào 1 loại sự cố trong danh sách để chọn (chọn duy nhất).' }}
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
            {{ t('page.portal.btnSubmitIncidentLog') || 'Ghi Nhận Sự Cố' }}
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

:deep(#qr-reader-viewport video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
</style>
