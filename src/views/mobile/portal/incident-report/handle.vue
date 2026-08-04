<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Spin,
  Empty,
  Input,
  Button,
  message,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

defineOptions({ name: 'MobilePortalIncidentReportHandle' });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();

const equipmentId = computed(() => route.params.equipmentId as string);

// ─── Interfaces ───
interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category?: { name: string } | null;
  device_id?: string | null;
}

interface ErrorItem {
  id: string;
  name: string;
  code?: string;
}

// ─── App State ───
const loading = ref(false);
const submitting = ref(false);
const equipment = ref<EquipmentItem | null>(null);
const masterErrors = ref<ErrorItem[]>([]);

const selectedErrorId = ref<string | undefined>(undefined);
const errorSearchQuery = ref('');

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

// ─── Data Loading ───
async function loadData() {
  if (!equipmentId.value) {
    message.error('Mã thiết bị không hợp lệ');
    router.push('/portal/incident-report');
    return;
  }

  loading.value = true;
  try {
    // 1. Fetch Equipment Details
    const equipRes = await axios.get(`${API_BASE_URL}/v1/equipment/${equipmentId.value}`, {
      headers: getAuthHeaders(),
    });
    const rawEquip = equipRes.data?.data ?? equipRes.data;
    if (rawEquip) {
      equipment.value = {
        id: rawEquip.id,
        code: rawEquip.code,
        name: rawEquip.name || rawEquip.code,
        equipment_category: rawEquip.equipment_category,
        device_id: rawEquip.device_id,
      };
    } else {
      // Fallback
      equipment.value = {
        id: equipmentId.value,
        code: equipmentId.value,
        name: `Thiết bị [${equipmentId.value}]`,
      };
    }

    // 2. Fetch Master Errors List
    const errorsRes = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const rawErrors = errorsRes.data?.data ?? errorsRes.data ?? [];
    masterErrors.value = Array.isArray(rawErrors)
      ? rawErrors.map((e: any) => ({
          id: e.id,
          name: e.name,
          code: e.code,
        }))
      : [];
  } catch (err: unknown) {
    console.error('Failed to load equipment error handling page data:', err);
    // If equipment fetch fails by ID, use ID as fallback code
    equipment.value = {
      id: equipmentId.value,
      code: equipmentId.value,
      name: `Thiết bị [${equipmentId.value}]`,
    };
  } finally {
    loading.value = false;
  }
}

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
  if (selectedErrorId.value === id) {
    selectedErrorId.value = undefined;
  } else {
    selectedErrorId.value = id;
  }
}

// ─── Submit Handling Log ───
async function handleSubmit() {
  if (!equipment.value) {
    message.error('Không tìm thấy thông tin thiết bị');
    return;
  }

  if (!selectedErrorId.value) {
    message.error('Vui lòng chọn loại lỗi đã xử lý từ danh sách!');
    return;
  }

  const matchedError = masterErrors.value.find((e) => e.id === selectedErrorId.value);
  const finalNotes = matchedError ? matchedError.name : 'Xử lý lỗi sau khi quét QR';

  try {
    submitting.value = true;
    const payload = {
      equipment_id: equipment.value.id,
      equipment_error_id: selectedErrorId.value,
      occurred_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      notes: finalNotes,
    };

    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
      payload,
      { headers: getAuthHeaders() }
    );

    message.success('Đã hoàn tất xử lý và ghi nhận lỗi thành công!');
    router.push('/portal');
  } catch (err: any) {
    console.error('Failed to submit equipment error log:', err);
    message.error(
      err?.response?.data?.message || 'Xử lý thất bại, vui lòng thử lại!'
    );
  } finally {
    submitting.value = false;
  }
}

function handleBack() {
  router.push('/portal/incident-report');
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-6">
    <!-- ─── HEADER ─── -->
    <div class="bg-white dark:bg-zinc-900 border-b border-slate-200/70 dark:border-zinc-800 px-4 pt-4 pb-3">
      <div class="flex items-center gap-3">
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
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
          Bước 2/2
        </span>
      </div>
    </div>

    <!-- ─── CONTENT ─── -->
    <div class="pt-4 px-4 space-y-4">
      <div v-if="loading" class="flex justify-center py-12">
        <Spin size="large" />
      </div>

      <template v-else-if="equipment">
        <!-- Card Thông Tin Thiết Bị Đã Quét -->
        <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 shadow-3xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">Thiết Bị Đã Quét QR</span>
            <Button
              type="link"
              size="small"
              class="p-0 h-auto text-xs text-slate-400 hover:text-indigo-600"
              @click="handleBack"
            >
              Quét lại
            </Button>
          </div>

          <div>
            <h2 class="text-base font-bold text-slate-800 dark:text-zinc-100 m-0 leading-snug">
              {{ equipment.name }}
            </h2>
            <div class="flex flex-wrap items-center gap-2 mt-1">
              <span class="text-xs font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-zinc-400 font-semibold">
                Mã: {{ equipment.code }}
              </span>
              <span v-if="equipment.equipment_category?.name" class="text-xs bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md text-indigo-600 dark:text-indigo-400">
                {{ equipment.equipment_category.name }}
              </span>
            </div>
          </div>
        </div>

        <!-- Form Chọn Mã Lỗi / Sự Cố Để Xử Lý -->
        <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-3xs">
          
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
            <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Chọn sự cố / mã lỗi đã sửa <span class="text-red-500">*</span>
            </label>
          </div>

          <!-- Live Search Filter -->
          <Input
            v-if="masterErrors.length > 4"
            v-model:value="errorSearchQuery"
            placeholder="Tìm kiếm loại sự cố / mã lỗi..."
            size="small"
            class="rounded-xl text-xs"
            allow-clear
          />

          <!-- Error Cards Selection (Single choice) -->
          <div v-if="filteredMasterErrors.length > 0" class="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
            <div
              v-for="err in filteredMasterErrors"
              :key="err.id"
              :class="[
                'flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 select-none border',
                selectedErrorId === err.id
                  ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-600 text-rose-600 dark:text-rose-400 shadow-xs font-bold ring-1 ring-rose-600/30'
                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/70 text-slate-700 dark:text-zinc-300 hover:border-rose-300 dark:hover:border-rose-700'
              ]"
              @click="toggleSelectError(err.id)"
            >
              <svg v-if="selectedErrorId === err.id" class="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>{{ err.name }}</span>
              <span v-if="err.code" class="text-[10px] opacity-75 font-mono">({{ err.code }})</span>
            </div>
          </div>

          <div v-else class="text-center py-6">
            <Empty description="Không có loại lỗi nào phù hợp" />
          </div>

          <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 mb-0">
            Chạm vào 1 loại lỗi trong danh sách trên để xác nhận đã xử lý xong. Thời điểm khắc phục và người xử lý sẽ tự động được ghi nhận.
          </p>

          <!-- Submit Button -->
          <Button
            type="primary"
            block
            size="large"
            :loading="submitting"
            :disabled="!selectedErrorId"
            class="bg-rose-600 hover:bg-rose-500 border-none font-bold text-sm h-11 rounded-xl mt-3"
            @click="handleSubmit"
          >
            Ghi Nhận Hoàn Tất Xử Lý Lỗi
          </Button>

        </div>
      </template>

      <div v-else class="py-12">
        <Empty description="Không tìm thấy thiết bị" />
      </div>

    </div>
  </div>
</template>
