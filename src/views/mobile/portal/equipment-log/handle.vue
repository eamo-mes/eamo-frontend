<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import {
  Spin,
  Empty,
  Input,
  Button,
  Tag,
  message,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { getVNNowString } from '#/utils/date';
import { API_BASE_URL } from '#/api/config';
import { batchSaveParameterLogsApi, fetchUnitsApi } from '#/views/ops/parameter-log/api';
import type { UnitOption, BatchSavePayload } from '#/views/ops/parameter-log/types';

defineOptions({ name: 'MobilePortalEquipmentLogHandle' });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const accessStore = useAccessStore();

const equipmentId = computed(() => route.params.equipmentId as string);
const recordedAtTime = computed(() => (route.query.scan_time as string) || getVNNowString());

interface ParameterItem {
  id: string;
  name: string;
  code?: string | null;
  unit_id?: string | null;
  min_value?: number | string | null;
  max_value?: number | string | null;
  standard_min?: number | string | null;
  standard_max?: number | string | null;
  value: string;
}

interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category?: { name: string } | null;
  device_id?: string | null;
  equipment_parameters?: ParameterItem[];
}

const loading = ref(false);
const submitting = ref(false);
const equipment = ref<EquipmentItem | null>(null);
const parameters = ref<ParameterItem[]>([]);
const units = ref<UnitOption[]>([]);
const paramSearchQuery = ref('');

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getUnitName(unitId?: string | null): string {
  if (!unitId) return '';
  const u = units.value.find((item) => item.id === unitId);
  return u ? u.name : '';
}

function formatRangeText(param: ParameterItem): string {
  const minVal = param.standard_min ?? param.min_value;
  const maxVal = param.standard_max ?? param.max_value;
  if (minVal !== undefined && minVal !== null && maxVal !== undefined && maxVal !== null) {
    return `${minVal} - ${maxVal}`;
  }
  if (minVal !== undefined && minVal !== null) return `>= ${minVal}`;
  if (maxVal !== undefined && maxVal !== null) return `<= ${maxVal}`;
  return '';
}

async function loadData() {
  if (!equipmentId.value) {
    message.error(t('page.portal.invalidEquipmentId') || 'Mã thiết bị không hợp lệ');
    router.push('/portal/equipment-log');
    return;
  }

  loading.value = true;
  try {
    // 1. Fetch Units
    try {
      units.value = await fetchUnitsApi();
    } catch (unitErr) {
      console.warn('Failed to fetch units:', unitErr);
    }

    // 2. Fetch Equipment Details
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

      const rawParams = rawEquip.equipment_parameters || rawEquip.parameters || [];
      if (Array.isArray(rawParams) && rawParams.length > 0) {
        parameters.value = rawParams.map((p: Record<string, unknown>) => ({
          id: String(p.id || ''),
          name: String(p.name || p.code || 'Parameter'),
          code: p.code ? String(p.code) : null,
          unit_id: p.unit_id ? String(p.unit_id) : null,
          min_value: (p.min_value as number | string) ?? null,
          max_value: (p.max_value as number | string) ?? null,
          standard_min: (p.standard_min as number | string) ?? null,
          standard_max: (p.standard_max as number | string) ?? null,
          value: '',
        }));
      } else {
        // Fallback fetch equipment parameters list endpoint if empty
        const paramsRes = await axios.get(`${API_BASE_URL}/v1/equipment-parameters`, {
          headers: getAuthHeaders(),
          params: { equipment_id: equipmentId.value, per_page: 1000 },
        });
        const rawParamList = paramsRes.data?.data ?? paramsRes.data ?? [];
        parameters.value = Array.isArray(rawParamList)
          ? rawParamList.map((p: Record<string, unknown>) => ({
              id: String(p.id || ''),
              name: String(p.name || p.code || 'Parameter'),
              code: p.code ? String(p.code) : null,
              unit_id: p.unit_id ? String(p.unit_id) : null,
              min_value: (p.min_value as number | string) ?? null,
              max_value: (p.max_value as number | string) ?? null,
              standard_min: (p.standard_min as number | string) ?? null,
              standard_max: (p.standard_max as number | string) ?? null,
              value: '',
            }))
          : [];
      }
    } else {
      equipment.value = {
        id: equipmentId.value,
        code: equipmentId.value,
        name: t('page.portal.fallbackEquipName', { code: equipmentId.value }) || `Thiết bị [Mã: ${equipmentId.value}]`,
      };
    }
  } catch (err: unknown) {
    console.error('Failed to load equipment parameter details:', err);
    equipment.value = {
      id: equipmentId.value,
      code: equipmentId.value,
      name: t('page.portal.fallbackEquipName', { code: equipmentId.value }) || `Thiết bị [Mã: ${equipmentId.value}]`,
    };
  } finally {
    loading.value = false;
  }
}

const filteredParameters = computed(() => {
  if (!paramSearchQuery.value.trim()) return parameters.value;
  const q = paramSearchQuery.value.trim().toLowerCase();
  return parameters.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q))
  );
});

const filledCount = computed(() => {
  return parameters.value.filter((p) => p.value !== undefined && p.value !== null && String(p.value).trim() !== '').length;
});

async function handleSubmit() {
  if (!equipment.value) {
    message.error(t('page.portal.equipNotFound') || 'Không tìm thấy thông tin thiết bị');
    return;
  }

  // Filter ONLY non-empty parameters
  const validItems = parameters.value.filter(
    (p) => p.value !== undefined && p.value !== null && String(p.value).trim() !== ''
  );

  if (validItems.length === 0) {
    message.error(t('page.portal.msgEnterAtLeastOneParam') || 'Vui lòng nhập giá trị cho ít nhất 1 thông số trước khi lưu!');
    return;
  }

  try {
    submitting.value = true;

    const payload: BatchSavePayload = {
      equipment_id: equipment.value.id,
      recorded_at: recordedAtTime.value,
      parameters: validItems.map((p) => ({
        equipment_parameter_id: p.id,
        unit_id: p.unit_id || null,
        value: String(p.value).trim(),
        recorded_at: recordedAtTime.value,
      })),
    };

    await batchSaveParameterLogsApi(payload);

    message.success(t('page.portal.msgSaveParamsSuccess') || `Đã lưu thành công ${validItems.length} thông số!`);
    router.push('/portal');
  } catch (err: unknown) {
    console.error('Failed to save parameter logs:', err);
    const errObj = err as { response?: { data?: { message?: string } } };
    message.error(
      errObj?.response?.data?.message || t('page.portal.msgSaveParamsFailed') || 'Lưu thông số thất bại, vui lòng thử lại!'
    );
  } finally {
    submitting.value = false;
  }
}

function handleBack() {
  router.push('/portal/equipment-log');
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
          {{ t('page.portal.inputParameterTitle') || 'Nhập Thông Số Đo Đạc' }}
        </h1>
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
          {{ t('page.portal.step2Of2') || 'Bước 2/2' }}
        </span>
      </div>
    </div>

    <!-- ─── CONTENT ─── -->
    <div class="pt-4 px-4 space-y-4">
      <div v-if="loading" class="flex justify-center py-12">
        <Spin size="large" />
      </div>

      <template v-else-if="equipment">
        <!-- Card hiển thị Thiết bị & Ngày quét -->
        <div class="bg-white dark:bg-blue-950/40 border border-slate-200/80 dark:border-blue-800/60 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
          <div class="flex items-center gap-3 min-w-0">
            <div class="min-w-0">
              <span class="text-[10px] font-bold uppercase text-blue-500 tracking-wider">
                {{ t('page.portal.scannedEquipment') || 'Thiết Bị Đã Quét:' }}
              </span>
              <h2 class="text-base font-bold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight">
                {{ equipment?.name }}
              </h2>
              <div v-if="equipment?.code" class="mt-1">
                <Tag color="blue" class="m-0 text-[10px] font-mono font-semibold">
                  {{ equipment.code }}
                </Tag>
              </div>
            </div>
          </div>
        </div>

        <!-- Form Danh Sách Parameters -->
        <div class="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-3xs">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
            <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">
              {{ t('page.portal.parameterListLabel') || 'Danh sách Thông Số Đo' }}
            </label>
            <Tag color="blue" class="m-0 text-[11px] font-bold rounded-full">
              {{ filledCount }} / {{ parameters.length }} {{ t('page.portal.filledCountLabel') || 'Đã nhập' }}
            </Tag>
          </div>

          <!-- Quick Search Filter -->
          <Input
            v-if="parameters.length > 4"
            v-model:value="paramSearchQuery"
            :placeholder="t('page.portal.searchParamPlaceholder') || 'Tìm kiếm thông số...'"
            size="small"
            class="rounded-xl text-xs"
            allow-clear
          />

          <!-- List of Parameters -->
          <div v-if="filteredParameters.length > 0" class="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 pr-1 scrollbar-thin">
            <div
              v-for="param in filteredParameters"
              :key="param.id"
              class="py-3 first:pt-0 last:pb-0 space-y-1.5"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <span class="text-xs font-bold text-slate-800 dark:text-zinc-200 block truncate">
                    {{ param.name }}
                  </span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span v-if="param.code" class="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                      {{ param.code }}
                    </span>
                    <span v-if="formatRangeText(param)" class="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Standard: {{ formatRangeText(param) }}
                    </span>
                  </div>
                </div>

                <!-- Unit Badge -->
                <span v-if="getUnitName(param.unit_id)" class="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md shrink-0">
                  {{ getUnitName(param.unit_id) }}
                </span>
              </div>

              <!-- Value Input Field -->
              <div>
                <Input
                  v-model:value="param.value"
                  :placeholder="t('page.portal.inputParamPlaceholder') || 'Nhập chỉ số đo đạc...'"
                  class="rounded-xl text-xs font-semibold"
                  allow-clear
                />
              </div>
            </div>
          </div>

          <div v-else class="text-center py-6">
            <Empty :description="t('page.portal.noMatchingParam') || 'Không tìm thấy thông số phù hợp'" />
          </div>

          <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 mb-0">
            * {{ t('page.portal.skipEmptyParamNote') || 'Các thông số để trống sẽ tự động được bỏ qua, không khởi tạo bản ghi log.' }}
          </p>

          <!-- Submit Button -->
          <Button
            type="primary"
            block
            size="large"
            :loading="submitting"
            :disabled="filledCount === 0"
            class="bg-blue-600 hover:bg-blue-500 border-none font-bold text-sm h-11 rounded-xl mt-3 text-white"
            @click="handleSubmit"
          >
            {{ t('page.portal.btnConfirmSaveParams') || `Xác Nhận Lưu (${filledCount} Thông Số)` }}
          </Button>

        </div>
      </template>

      <div v-else class="py-12">
        <Empty :description="t('page.portal.noEquipFound') || 'Không tìm thấy thiết bị'" />
      </div>

    </div>
  </div>
</template>
