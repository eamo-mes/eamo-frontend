<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Card,
  Tabs,
  TabPane,
  Button,
  Spin,
  Empty,
  Input,
  message,
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

interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category_id: string | null;
  equipment_category?: CategoryOption | null;
  is_active: boolean;
  device_id: string | null;
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

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
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

function selectEquipment(id: string) {
  router.push(`/portal/equipment/${id}`);
}

// ─── Actions ───
function triggerCapture() {
  fileInputRef.value?.click();
}

// ─── Backend QR Decoding Logic ───
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
    if (equipmentData && equipmentData.id) {
      message.success(t('page.portal.qrDecodeSuccess'));
      
      // Navigate directly to the dedicated detail screen!
      router.push(`/portal/equipment/${equipmentData.id}`);
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

onMounted(() => {
  loadEquipments();
});
</script>

<template>
  <div class="p-4 sm:p-6 min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40">
    <!-- ─── HEADER / ACTION BAR ─── -->
    <div class="mb-5 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h1 class="text-base font-bold text-slate-800 dark:text-zinc-200 m-0">
          {{ t('page.portal.equipment') }}
        </h1>
      </div>
    </div>

    <!-- ─── TABS VIEW ─── -->
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

            <!-- Frame for viewfinder -->
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
            
            <div v-if="loading" class="flex justify-center py-10">
              <Spin />
            </div>

            <div v-else-if="filteredEquipments.length > 0" class="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
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
