<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Spin,
  Empty,
  Input,
  Button,
  message,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
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

const activeTabKey = ref<'qrcode' | 'list'>('qrcode');
const loading = ref(false);
const equipments = ref<EquipmentItem[]>([]);
const equipSearchVal = ref('');
const qrScannerRef = ref<InstanceType<typeof QrCameraScanner> | null>(null);

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadEquipments() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
  } catch (err: unknown) {
    console.error('Failed to load equipments:', err);
    message.error('Không thể tải danh sách thiết bị');
  } finally {
    loading.value = false;
  }
}

// ─── QR Scanned Handler ───
function handleQrScanned(payload: { rawText: string; matchedEquipment?: QrEquipmentItem }) {
  const { rawText, matchedEquipment } = payload;
  const equipId = matchedEquipment?.id || rawText;

  message.success(t('page.portal.msgScanSuccessWithCode') || 'Quét mã QR thành công!');
  qrScannerRef.value?.stopCamera();
  router.push(`/portal/error-handling/${equipId}`);
}

function selectEquipmentToHandle(id: string) {
  qrScannerRef.value?.stopCamera();
  router.push(`/portal/error-handling/${id}`);
}

function handleBack() {
  qrScannerRef.value?.stopCamera();
  router.push('/portal');
}

const filteredEquipments = computed(() => {
  if (!equipSearchVal.value.trim()) return equipments.value;
  const q = equipSearchVal.value.trim().toLowerCase();
  return equipments.value.filter(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      (e.name && e.name.toLowerCase().includes(q)) ||
      e.id.toLowerCase().includes(q)
  );
});

watch(activeTabKey, (newVal) => {
  if (newVal !== 'qrcode') {
    qrScannerRef.value?.stopCamera();
  }
});

onMounted(() => {
  loadEquipments();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-6">
    <!-- ─── HEADER ─── -->
    <div class="bg-white dark:bg-zinc-900 border-b border-slate-200/70 dark:border-zinc-800 px-4 pt-4 pb-0">
      <div class="flex items-center gap-3 mb-3">
        <button
          type="button"
          class="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-sm font-bold text-slate-800 dark:text-zinc-200 m-0 flex-1 truncate">
          Xử lý lỗi thiết bị
        </h1>
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
          Bước 1/2
        </span>
      </div>

      <!-- Underline tab bar -->
      <div class="flex">
        <button
          type="button"
          @click="activeTabKey = 'qrcode'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 pb-3 text-xs font-bold border-0 bg-transparent cursor-pointer outline-none transition-all duration-200',
            activeTabKey === 'qrcode'
              ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-600 dark:border-rose-400 -mb-px'
              : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
          ]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
          </svg>
          Quét mã QR
        </button>

        <button
          type="button"
          @click="activeTabKey = 'list'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 pb-3 text-xs font-bold border-0 bg-transparent cursor-pointer outline-none transition-all duration-200',
            activeTabKey === 'list'
              ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-600 dark:border-rose-400 -mb-px'
              : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
          ]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          Danh sách máy
          <span :class="[
            'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums',
            activeTabKey === 'list'
              ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
          ]">{{ equipments.length }}</span>
        </button>
      </div>
    </div>

    <!-- ─── CONTENT ─── -->
    <div class="pt-4 px-4">
      
      <!-- Tab 1: QR Camera Scanner -->
      <div v-show="activeTabKey === 'qrcode'">
        <div class="flex flex-col items-center pb-6">
          <QrCameraScanner
            ref="qrScannerRef"
            :equipments="equipments"
            viewport-id="qr-error-handling-viewport"
            @scanned="handleQrScanned"
          />
        </div>
      </div>

      <!-- Tab 2: Equipment List -->
      <div v-show="activeTabKey === 'list'">
        <div class="space-y-4">
          <Input
            v-model:value="equipSearchVal"
            placeholder="Tìm theo mã máy hoặc tên thiết bị..."
            class="rounded-xl border-slate-200/80 dark:border-zinc-800"
            size="large"
            allow-clear
          />
          
          <div v-if="loading" class="flex justify-center py-10">
            <Spin />
          </div>

          <div v-else-if="filteredEquipments.length > 0" class="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin">
            <div
              v-for="eq in filteredEquipments"
              :key="eq.id"
              class="group flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-3xs transition-all duration-150 cursor-pointer"
              @click="selectEquipmentToHandle(eq.id)"
            >
              <div class="flex-1 min-w-0 pr-3">
                <span class="text-xs font-bold text-slate-800 dark:text-zinc-200 block truncate">{{ eq.name || '—' }}</span>
                <span class="text-[10px] font-mono text-slate-400 dark:text-zinc-500 block mt-0.5">{{ eq.code }}</span>
              </div>

              <Button
                type="primary"
                size="small"
                class="rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs shrink-0"
              >
                Xử lý lỗi
              </Button>
            </div>
          </div>

          <div v-else class="py-10 flex justify-center">
            <Empty description="Không tìm thấy thiết bị" />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
