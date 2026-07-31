<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Button, 
  Input, 
  Select, 
  Spin, 
  Empty, 
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
const step = ref<1 | 2>(1); // 1: Choose Equipment (QR/List), 2: Enter Error Details
const loading = ref(false);
const submitting = ref(false);
const searchVal = ref('');

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
  equipment_error_id: undefined as string | undefined,
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

// Fetch Equipments & Error Types
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

    // Errors
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
    console.error('Failed to load data for incident report:', err);
  } finally {
    loading.value = false;
  }
}

// Search Filter
const filteredEquipments = computed(() => {
  if (!searchVal.value.trim()) return equipments.value;
  const q = searchVal.value.trim().toLowerCase();
  return equipments.value.filter(
    (e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
  );
});

// Select Equipment
function handleSelectEquipment(equip: EquipmentItem) {
  selectedEquipment.value = equip;
  step.value = 2;
}

// QR Scan Simulation
function handleScanQR() {
  if (equipments.value.length > 0) {
    const equip = equipments.value[Math.floor(Math.random() * equipments.value.length)];
    if (equip) {
      message.success(`Đã quét QR: ${equip.code}`);
      handleSelectEquipment(equip);
    }
  } else {
    message.warning('Chưa có danh sách thiết bị.');
  }
}

function handleBack() {
  if (step.value === 2) {
    step.value = 1;
    selectedEquipment.value = null;
  } else {
    router.push('/portal');
  }
}

// Submit Report
async function handleSubmit() {
  if (!selectedEquipment.value) {
    message.error('Vui lòng chọn thiết bị!');
    return;
  }

  let errorId = formState.value.equipment_error_id;
  if (!errorId && masterErrors.value.length > 0) {
    errorId = masterErrors.value[0]?.id;
  }

  try {
    submitting.value = true;
    const payload = {
      equipment_id: selectedEquipment.value.id,
      equipment_error_id: errorId,
      occurred_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      notes: formState.value.notes 
        ? `[Mức độ: ${formState.value.severity.toUpperCase()}] ${formState.value.notes}` 
        : `[Mức độ: ${formState.value.severity.toUpperCase()}] Báo cáo sự cố`,
    };

    await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
      payload,
      { headers: getAuthHeaders() }
    );

    message.success('Đã ghi nhận sự cố thành công!');
    router.push('/portal');
  } catch (err: any) {
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
  <div class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 p-4 pb-28 select-none">
    
    <!-- ─── HEADER ─── -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button
          type="default"
          size="small"
          class="flex items-center justify-center p-1 rounded-lg shrink-0"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <h1 class="text-base font-bold text-slate-800 dark:text-zinc-200 m-0">
          {{ t('page.portal.reportIncident') || 'Báo cáo sự cố' }}
        </h1>
      </div>

      <span class="text-xs text-slate-400 font-medium">
        Bước {{ step }}/2
      </span>
    </div>

    <!-- ─── BƯỚC 1: QUÉT QR / CHỌN MÁY ─── -->
    <div v-if="step === 1" class="space-y-4">
      
      <!-- QR Action Card -->
      <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-center space-y-3 shadow-3xs">
        <div class="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
          </svg>
        </div>
        <p class="text-xs text-slate-500 dark:text-zinc-400 m-0">Quét mã QR dán trên thiết bị để báo sự cố nhanh</p>
        <Button
          type="primary"
          block
          class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-xs h-10 rounded-xl"
          @click="handleScanQR"
        >
          Quét Mã QR Thiết Bị
        </Button>
      </div>

      <!-- Select List -->
      <div class="space-y-2">
        <p class="text-xs font-bold text-slate-500 dark:text-zinc-400 m-0">Hoặc chọn máy từ danh sách:</p>
        <Input.Search
          v-model:value="searchVal"
          placeholder="Tìm mã hoặc tên máy..."
          allow-clear
          class="w-full"
        />

        <Spin :spinning="loading">
          <div v-if="filteredEquipments.length > 0" class="space-y-2 max-h-[45vh] overflow-y-auto pt-1">
            <div
              v-for="equip in filteredEquipments"
              :key="equip.id"
              class="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3 cursor-pointer hover:border-indigo-400 active:scale-[0.99] transition-all"
              @click="handleSelectEquipment(equip)"
            >
              <div>
                <p class="text-sm font-bold text-slate-800 dark:text-zinc-100 m-0">{{ equip.name }}</p>
                <p class="text-xs text-indigo-600 dark:text-indigo-400 font-mono m-0">{{ equip.code }}</p>
              </div>
              <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Chọn →</span>
            </div>
          </div>

          <div v-else class="py-8 bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-center">
            <Empty description="Không có thiết bị nào" />
          </div>
        </Spin>
      </div>

    </div>

    <!-- ─── BƯỚC 2: NHẬP THÔNG TIN SỰ CỐ ─── -->
    <div v-else-if="step === 2 && selectedEquipment" class="space-y-4">
      
      <!-- Selected Equipment Info -->
      <div class="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl p-3 flex items-center justify-between">
        <div>
          <span class="text-[10px] uppercase font-bold text-indigo-500">Thiết bị chọn:</span>
          <p class="text-sm font-bold text-slate-800 dark:text-zinc-100 m-0">{{ selectedEquipment.name }} ({{ selectedEquipment.code }})</p>
        </div>
        <Button size="small" type="link" class="text-xs p-0 text-indigo-600" @click="step = 1">Đổi máy</Button>
      </div>

      <!-- Error Form Card -->
      <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3.5 shadow-3xs">
        
        <!-- Error Type -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Loại sự cố / Mã lỗi</label>
          <Select
            v-model:value="formState.equipment_error_id"
            placeholder="-- Chọn loại lỗi --"
            class="w-full"
            allow-clear
          >
            <Select.Option v-for="err in masterErrors" :key="err.id" :value="err.id">
              {{ err.name }} {{ err.code ? `(${err.code})` : '' }}
            </Select.Option>
          </Select>
        </div>

        <!-- Severity -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Mức độ khẩn cấp</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              @click="formState.severity = 'low'"
              :class="[
                'py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer outline-none',
                formState.severity === 'low'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-950/50'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500'
              ]"
            >
              Bình thường
            </button>

            <button
              type="button"
              @click="formState.severity = 'medium'"
              :class="[
                'py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer outline-none',
                formState.severity === 'medium'
                  ? 'bg-amber-50 border-amber-500 text-amber-600 dark:bg-amber-950/50'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500'
              ]"
            >
              Vừa
            </button>

            <button
              type="button"
              @click="formState.severity = 'high'"
              :class="[
                'py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer outline-none',
                formState.severity === 'high'
                  ? 'bg-rose-50 border-rose-500 text-rose-600 dark:bg-rose-950/50'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500'
              ]"
            >
              Khẩn cấp
            </button>
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Mô tả hiện tượng sự cố</label>
          <Input.TextArea
            v-model:value="formState.notes"
            :rows="3"
            placeholder="Nhập mô tả sự cố..."
            class="rounded-xl"
          />
        </div>

        <!-- Submit Button -->
        <Button
          type="primary"
          block
          size="large"
          :loading="submitting"
          class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-sm h-11 rounded-xl mt-2"
          @click="handleSubmit"
        >
          Ghi Nhận Sự Cố
        </Button>

      </div>

    </div>

  </div>
</template>
