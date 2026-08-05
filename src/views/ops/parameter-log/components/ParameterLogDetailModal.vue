<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import {
  Modal,
  Tag,
  Table,
  Button,
  Spin,
  Empty,
  message
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { $t } from '#/locales';
import { fetchParameterLogDetailApi, fetchEquipmentOverviewApi, fetchParameterLogsApi } from '../api';
import type { EquipmentOption, UnitOption, ParameterLogItem } from '../types';

const props = defineProps<{
  open: boolean;
  logId: string | null;
  equipments: EquipmentOption[];
  units: UnitOption[];
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const loading = ref(false);
const detailLog = ref<ParameterLogItem | null>(null);
const parameterRecords = ref<ParameterLogItem[]>([]);

function getParamId(item: ParameterLogItem | null | undefined): string | null {
  if (!item) return null;
  return (
    item.equipment_parameter_id ||
    item.equipment_parameter?.id ||
    item.parameter?.id ||
    (item as any).parameter_id ||
    null
  );
}

function getEquipId(item: ParameterLogItem | null | undefined): string | null {
  if (!item) return null;
  return item.equipment_id || item.equipment?.id || (item as any).equipment_id || null;
}

// Equipment details
const equipmentInfo = computed(() => {
  if (!detailLog.value) return null;
  const equip = props.equipments.find((e) => e.id === getEquipId(detailLog.value));
  return {
    name: equip?.name || detailLog.value.equipment?.name || detailLog.value.equipment_id || '',
    code: equip?.code || detailLog.value.equipment?.code || '',
  };
});

// Parameter details
const parameterInfo = computed(() => {
  if (!detailLog.value) return null;
  const paramObj = detailLog.value.parameter || detailLog.value.equipment_parameter;
  const equipId = getEquipId(detailLog.value);
  const equip = props.equipments.find((e) => e.id === equipId);
  const paramId = getParamId(detailLog.value);
  const param = equip?.equipment_parameters?.find(
    (p) => p.id === paramId || p.id === paramObj?.id
  );
  const name = param?.name || paramObj?.name || detailLog.value.equipment_parameter_id || '';
  const code = param?.code || paramObj?.code || '';
  return {
    name,
    code,
  };
});

// Unit name
const unitName = computed(() => {
  if (!detailLog.value) return '';
  const uId = detailLog.value.unit_id;
  if (!uId) return detailLog.value.unit?.name || '';
  const u = props.units.find((unit) => unit.id === uId);
  return u ? u.name : detailLog.value.unit?.name || '';
});

// Filtered logs for this parameter
const filteredRecords = computed(() => {
  if (!detailLog.value) return [];
  const targetParamId = getParamId(detailLog.value);

  if (targetParamId) {
    const matches = parameterRecords.value.filter((rec) => {
      const recParamId = getParamId(rec);
      return recParamId === targetParamId;
    });
    if (matches.length > 0) {
      return matches;
    }
  }

  // Fallback to all loaded records for the equipment if exact parameter ID match produced no items
  return parameterRecords.value;
});

async function loadData(id: string) {
  loading.value = true;
  try {
    const detail = await fetchParameterLogDetailApi(id);
    detailLog.value = detail;

    const equipId = getEquipId(detail);
    if (equipId) {
      try {
        const logs = await fetchEquipmentOverviewApi(equipId);
        if (Array.isArray(logs) && logs.length > 0) {
          parameterRecords.value = logs;
        } else {
          const allLogs = await fetchParameterLogsApi(true);
          parameterRecords.value = allLogs.filter((l) => getEquipId(l) === equipId);
        }
      } catch (e) {
        console.warn('fetchEquipmentOverviewApi failed, falling back to fetchParameterLogsApi', e);
        const allLogs = await fetchParameterLogsApi(true);
        parameterRecords.value = allLogs.filter((l) => getEquipId(l) === equipId);
      }
    } else {
      const allLogs = await fetchParameterLogsApi(true);
      parameterRecords.value = allLogs;
    }
  } catch (error) {
    message.error($t('page.ops.loadDetailError'));
    console.error('Failed to load detail history', error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (newVal) => {
    if (newVal && props.logId) {
      loadData(props.logId);
    } else {
      detailLog.value = null;
      parameterRecords.value = [];
    }
  }
);

function handleClose() {
  emit('update:open', false);
}

function getUserDisplayName(record: ParameterLogItem | Record<string, any>): string {
  const user = record.user as { name?: string; email?: string } | undefined;
  if (user?.name) return user.name;
  if (user?.email) return user.email;
  const userId = record.user_id as string | undefined;
  if (userId) {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId) || userId.length > 20;
    return isUuid ? 'System' : userId;
  }
  return 'System';
}

const columns = computed(() => [
  {
    title: $t('page.ops.recordedAt'),
    dataIndex: 'recorded_at',
    key: 'recorded_at',
    width: 220,
  },
  {
    title: $t('page.ops.value'),
    dataIndex: 'value',
    key: 'value',
    align: 'left' as const,
  },
  {
    title: 'Created At',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 220,
  },
  {
    title: $t('page.ops.colCreatedBy'),
    key: 'user',
    width: 180,
    align: 'center' as const,
  },
]);
</script>

<template>
  <Modal
    :open="props.open"
    width="1000px"
    :footer="null"
    destroy-on-close
    @cancel="handleClose"
  >
    <!-- Custom Modal Header -->
    <template #title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ $t('page.ops.detailTitle') }}
        </span>
      </div>
    </template>

    <Spin :spinning="loading">
      <div class="min-h-[320px] py-2">
        <div v-if="detailLog" class="space-y-6">
          <!-- Top Info Cards Section -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Equipment Card -->
            <div class="bg-gray-50/50 dark:bg-gray-800/20 border border-gray-150 dark:border-gray-800 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
              <div class="space-y-0.5">
                <span class="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  {{ $t('page.ops.colEquipment') }}
                </span>
                <h4 class="font-bold text-gray-800 dark:text-gray-200 text-[15px] leading-tight m-0">
                  {{ equipmentInfo?.name }}
                </h4>
                <div v-if="equipmentInfo?.code" class="mt-1">
                  <Tag color="blue" class="m-0 font-mono text-[10px] uppercase font-semibold">
                    {{ equipmentInfo.code }}
                  </Tag>
                </div>
              </div>
            </div>

            <!-- Parameter Card -->
            <div class="bg-gray-50/50 dark:bg-gray-800/20 border border-gray-150 dark:border-gray-800 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
              <div class="space-y-0.5">
                <span class="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  {{ $t('page.ops.parameter') }}
                </span>
                <h4 class="font-bold text-gray-800 dark:text-gray-200 text-[15px] leading-tight m-0">
                  {{ parameterInfo?.name }}
                </h4>
                <div v-if="parameterInfo?.code" class="mt-1">
                  <Tag color="blue" class="m-0 font-mono text-[10px] uppercase font-semibold">
                    {{ parameterInfo.code }}
                  </Tag>
                </div>
              </div>
            </div>

            <!-- Unit Card -->
            <div class="bg-gray-50/50 dark:bg-gray-800/20 border border-gray-150 dark:border-gray-800 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
              <div class="space-y-0.5">
                <span class="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  {{ $t('page.ops.unit') }} & Total Records
                </span>
                <h4 class="font-bold text-gray-800 dark:text-gray-200 text-[15px] leading-tight m-0">
                  {{ unitName || '-' }}
                </h4>
                <div class="mt-1">
                  <Tag color="blue" class="m-0 text-[10px] font-semibold">
                    {{ filteredRecords.length }} Records
                  </Tag>
                </div>
              </div>
            </div>
          </div>

          <!-- History Section Header -->
          <div class="border-b border-gray-100 dark:border-gray-800 pb-2">
            <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 m-0">
              Parameter Logs History
            </h3>
          </div>

          <!-- Empty State -->
          <Empty
            v-if="filteredRecords.length === 0"
            :description="$t('page.ops.noTimeRecords')"
            class="my-8"
          />

          <!-- Data History Table -->
          <Table
            v-else
            :columns="columns"
            :data-source="filteredRecords"
            row-key="id"
            size="middle"
            :pagination="{ pageSize: 5, showSizeChanger: true, size: 'small' }"
            class="w-full border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-2xs"
          >
            <template #bodyCell="{ column, record }">
              <!-- Recorded At Column -->
              <template v-if="column.key === 'recorded_at'">
                <div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>
                    {{ record.recorded_at ? dayjs(record.recorded_at).format('YYYY-MM-DD HH:mm:ss') : (record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-') }}
                  </span>
                </div>
              </template>

              <!-- Value Column -->
              <template v-else-if="column.key === 'value'">
                <span class="text-gray-800 dark:text-gray-250 font-semibold">
                  {{ record.value }}<span class="text-gray-400 dark:text-gray-500 ml-0.5">{{ unitName }}</span>
                </span>
              </template>

              <!-- Created At Column -->
              <template v-else-if="column.key === 'created_at'">
                <span class="text-gray-600 dark:text-gray-300">
                  {{ record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}
                </span>
              </template>

              <!-- Creator Column -->
              <template v-else-if="column.key === 'user'">
                <Tag color="blue" class="m-0 font-medium px-2 rounded-sm border-0">
                  {{ getUserDisplayName(record) }}
                </Tag>
              </template>
            </template>
          </Table>
        </div>
      </div>
    </Spin>

    <!-- Footer Actions -->
    <div class="flex justify-end mt-6 pt-3 border-t border-gray-100 dark:border-gray-800">
      <Button type="primary" class="px-6 rounded-md font-medium" @click="handleClose">
        {{ $t('page.ops.btnOk') }}
      </Button>
    </div>
  </Modal>
</template>

<style scoped>
:deep(.ant-table-thead > tr > th) {
  background-color: var(--ant-table-header-bg, #fafafa) !important;
  font-weight: 600 !important;
}
.dark :deep(.ant-table-thead > tr > th) {
  background-color: #1f1f1f !important;
}
</style>
