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
import axios from 'axios';
import { useAccessStore, useUserStore } from '@vben/stores';
import { getVNNowString } from '#/utils/date';
import { API_BASE_URL } from '#/api/config';

defineOptions({ name: 'MobilePortalErrorHandlingHandle' });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();
const userStore = useUserStore();

const equipmentId = computed(() => route.params.equipmentId as string);
const handledAtTime = computed(() => (route.query.scan_time as string) || getVNNowString());

// ─── Interfaces ───
interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category?: { name: string } | null;
  device_id?: string | null;
  equipment_errors?: ErrorItem[];
}

interface ErrorItem {
  id: string;
  name: string;
  code?: string;
  log_id?: string;
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
    message.error(t('page.portal.invalidEquipmentId') || 'Mã thiết bị không hợp lệ');
    router.push('/portal/error-handling');
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
        equipment_errors: rawEquip.equipment_errors || rawEquip.errors || [],
      };
    } else {
      equipment.value = {
        id: equipmentId.value,
        code: equipmentId.value,
        name: t('page.portal.fallbackEquipName', { code: equipmentId.value }) || `Thiết bị [Mã: ${equipmentId.value}]`,
      };
    }

    // 2. Query Active Error Logs for this equipment to match active unresolved incidents
    const logsRes = await axios.get(
      `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
      { headers: getAuthHeaders() }
    );
    const rawLogs = logsRes.data?.data ?? logsRes.data ?? [];
    const activeLogs = Array.isArray(rawLogs)
      ? rawLogs.filter(
          (log: { equipment_id: string; handled_at?: string | null; deleted_at?: string | null; is_handled?: boolean }) =>
            log.equipment_id === equipmentId.value &&
            !log.handled_at &&
            !log.deleted_at &&
            !log.is_handled
        )
      : [];

    const activeLogMap = new Map<string, string>();
    activeLogs.forEach(
      (log: { id: string; equipment_error_id?: string | null }) => {
        if (log.equipment_error_id) {
          activeLogMap.set(log.equipment_error_id, log.id);
        }
      }
    );

    // 3. Load Error List (ONLY errors configured specifically for this equipment)
    const errorsRes = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
      params: {
        equipment_id: equipmentId.value,
        per_page: 1000,
      },
    });
    const rawErrors = errorsRes.data?.data ?? errorsRes.data ?? [];
    masterErrors.value = Array.isArray(rawErrors)
      ? rawErrors.map((e: ErrorItem) => ({
          id: e.id,
          name: e.name,
          code: e.code,
          log_id: activeLogMap.get(e.id),
        }))
      : [];
  } catch (err: unknown) {
    console.error('Failed to load error handling details data:', err);
    equipment.value = {
      id: equipmentId.value,
      code: equipmentId.value,
      name: t('page.portal.fallbackEquipName', { code: equipmentId.value }) || `Thiết bị [Mã: ${equipmentId.value}]`,
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

// ─── Submit Error Resolution Log ───
async function handleSubmit() {
  if (!equipment.value) {
    message.error(t('page.portal.equipNotFound') || 'Không tìm thấy thông tin thiết bị');
    return;
  }

  if (!selectedErrorId.value) {
    message.error(t('page.portal.msgSelectErrorToHandle') || 'Vui lòng chọn loại lỗi đã xử lý từ danh sách!');
    return;
  }

  const matchedError = masterErrors.value.find((e) => e.id === selectedErrorId.value);
  const finalNotes = matchedError ? matchedError.name : t('page.portal.defaultHandlingNote') || 'Xử lý lỗi sau khi quét QR';

  try {
    submitting.value = true;
    const timeStr = handledAtTime.value;
    const currentUserId = userStore.userInfo?.userId || userStore.userInfo?.id;
    const handlerIds = currentUserId ? [currentUserId] : [];

    if (matchedError?.log_id) {
      // An active unresolved error log exists -> UPDATE it to resolve and soft-delete it
      const payload: Record<string, unknown> = {
        handled_at: timeStr,
        restarted_at: timeStr,
        is_handled: true,
        notes: finalNotes,
      };
      if (handlerIds.length > 0) {
        payload.handler_ids = handlerIds;
      }

      await axios.put(
        `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/${matchedError.log_id}`,
        payload,
        { headers: getAuthHeaders() }
      );
    } else {
      // No active log exists -> CREATE a new resolved error log
      const payload: Record<string, unknown> = {
        equipment_id: equipment.value.id,
        equipment_error_id: selectedErrorId.value,
        occurred_at: timeStr,
        handled_at: timeStr,
        restarted_at: timeStr,
        is_handled: true,
        notes: finalNotes,
      };
      if (handlerIds.length > 0) {
        payload.handler_ids = handlerIds;
      }

      await axios.post(
        `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
        payload,
        { headers: getAuthHeaders() }
      );
    }

    message.success(t('page.portal.msgHandleSuccess') || 'Đã hoàn tất xử lý và ghi nhận lỗi thành công!');
    router.push('/portal');
  } catch (err: unknown) {
    console.error('Failed to submit equipment error log:', err);
    const errObj = err as { response?: { data?: { message?: string } } };
    message.error(
      errObj?.response?.data?.message || t('page.portal.msgHandleFailed') || 'Xử lý thất bại, vui lòng thử lại!'
    );
  } finally {
    submitting.value = false;
  }
}

function handleBack() {
  router.push('/portal/error-handling');
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
          {{ t('page.portal.handleErrorCompleteTitle') }}
        </h1>
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
          {{ t('page.portal.step2Of2') }}
        </span>
      </div>
    </div>

    <!-- ─── CONTENT ─── -->
    <div class="pt-4 px-4 space-y-4">
      <div v-if="loading" class="flex justify-center py-12">
        <Spin size="large" />
      </div>

      <template v-else-if="equipment">
        <!-- Card hiển thị Duy nhất Tên Thiết Bị đã quét -->
        <div class="bg-white dark:bg-indigo-950/50 border border-slate-200/80 dark:border-indigo-800/60 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
          <div class="flex items-center gap-3 min-w-0">
            <div class="min-w-0">
              <span class="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">{{ t('page.portal.scannedEquipment') || 'Thiết Bị Đã Quét:' }}</span>
              <h2 class="text-base font-bold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
                {{ equipment?.name }}
              </h2>
            </div>
          </div>
        </div>

        <!-- Form Chọn Mã Lỗi / Sự Cố Để Xử Lý -->
        <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-3xs">
          
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
            <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">
              {{ t('page.portal.selectHandledErrorLabel') }} <span class="text-indigo-500">*</span>
            </label>
          </div>

          <!-- Live Search Filter -->
          <Input
            v-if="masterErrors.length > 4"
            v-model:value="errorSearchQuery"
            :placeholder="t('page.portal.searchErrorPlaceholder')"
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
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-600 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold ring-1 ring-indigo-600/30'
                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/70 text-slate-700 dark:text-zinc-300 hover:border-indigo-300 dark:hover:border-indigo-700'
              ]"
              @click="toggleSelectError(err.id)"
            >
              <svg v-if="selectedErrorId === err.id" class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>{{ err.name }}</span>
              <span v-if="err.code" class="text-[10px] opacity-75 font-mono">({{ err.code }})</span>
            </div>
          </div>

          <div v-else class="text-center py-6">
            <Empty :description="t('page.portal.noMatchingError')" />
          </div>

          <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 mb-0">
            {{ t('page.portal.handleErrorInstruction') }}
          </p>

          <!-- Submit Button -->
          <Button
            type="primary"
            block
            size="large"
            :loading="submitting"
            :disabled="!selectedErrorId"
            class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-sm h-11 rounded-xl mt-3 text-white"
            @click="handleSubmit"
          >
            {{ t('page.portal.btnConfirmHandleError') }}
          </Button>

        </div>
      </template>

      <div v-else class="py-12">
        <Empty :description="t('page.portal.noEquipFound')" />
      </div>

    </div>
  </div>
</template>
