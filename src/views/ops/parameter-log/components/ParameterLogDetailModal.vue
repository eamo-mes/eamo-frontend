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
import { fetchParameterLogDetailApi, fetchEquipmentOverviewApi } from '../api';
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

// Equipment details
const equipmentInfo = computed(() => {
  if (!detailLog.value) return null;
  const equip = props.equipments.find((e) => e.id === detailLog.value?.equipment_id);
  return {
    name: equip?.name || detailLog.value.equipment?.name || detailLog.value.equipment_id,
    code: equip?.code || detailLog.value.equipment?.code || '',
  };
});

// Parameter details
const parameterInfo = computed(() => {
  if (!detailLog.value) return null;
  const paramObj = detailLog.value.parameter || detailLog.value.equipment_parameter;
  const equip = props.equipments.find((e) => e.id === detailLog.value?.equipment_id);
  const param = equip?.equipment_parameters?.find(
    (p) => p.id === detailLog.value?.equipment_parameter_id
  );
  const name = param?.name || paramObj?.name || detailLog.value.equipment_parameter_id;
  const code = param?.code || paramObj?.code || '';
  return {
    name: code ? `${name} (${code})` : name,
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
  const paramId = detailLog.value.equipment_parameter_id;
  return parameterRecords.value.filter((rec) => rec.equipment_parameter_id === paramId);
});

async function loadData(id: string) {
  loading.value = true;
  try {
    const detail = await fetchParameterLogDetailApi(id);
    detailLog.value = detail;

    // Load full history logs for this equipment
    const logs = await fetchEquipmentOverviewApi(detail.equipment_id);
    parameterRecords.value = logs;
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
    width: 200,
  },
  {
    title: $t('page.ops.value'),
    dataIndex: 'value',
    key: 'value',
  },
  {
    title: 'Created At',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 200,
  },
  {
    title: $t('page.ops.colCreatedBy'),
    key: 'user',
    width: 180,
  },
]);
</script>

<template>
  <Modal
    :open="props.open"
    :title="$t('page.ops.detailTitle')"
    width="950px"
    :footer="null"
    @cancel="handleClose"
  >
    <Spin :spinning="loading">
      <div class="min-h-[250px]">
        <div v-if="detailLog" class="space-y-5 my-2">
          <!-- Top Info Banner -->
          <div class="bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-700 rounded-xl p-4 shadow-2xs">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-gray-700">
              <!-- Equipment Info -->
              <div class="flex flex-col justify-center">
                <span class="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                  {{ $t('page.ops.colEquipment') }}
                </span>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-slate-800 dark:text-gray-200 text-base">
                    {{ equipmentInfo?.name }}
                  </span>
                </div>
              </div>

              <!-- Parameter Info -->
              <div class="flex flex-col justify-center md:pl-4 pt-2 md:pt-0">
                <span class="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                  {{ $t('page.ops.parameter') }}
                </span>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-slate-800 dark:text-gray-200 text-base">
                    {{ parameterInfo?.name }}
                  </span>
                </div>
              </div>

              <!-- Unit Info & Total Records -->
              <div class="flex flex-col justify-center md:pl-4 pt-2 md:pt-0">
                <span class="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                  {{ $t('page.ops.unit') }} & Total
                </span>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-slate-800 dark:text-gray-200 text-base">
                    {{ unitName || '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Empty
            v-if="filteredRecords.length === 0"
            :description="$t('page.ops.noTimeRecords')"
            class="my-8"
          />

          <Table
            v-else
            :columns="columns"
            :data-source="filteredRecords"
            row-key="id"
            size="small"
            :pagination="{ pageSize: 5, showSizeChanger: true }"
            bordered
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'recorded_at'">
                <span class="text-slate-700 dark:text-gray-300">
                  {{ record.recorded_at ? dayjs(record.recorded_at).format('YYYY-MM-DD HH:mm:ss') : (record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-') }}
                </span>
              </template>

              <template v-else-if="column.key === 'value'">
                <span class="font-semibold text-slate-800 dark:text-gray-100 text-sm">
                  {{ record.value }} {{ unitName }}
                </span>
              </template>

              <template v-else-if="column.key === 'created_at'">
                <span class="text-slate-700 dark:text-gray-300">
                  {{ record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}
                </span>
              </template>

              <template v-else-if="column.key === 'user'">
                <Tag color="geekblue" class="rounded font-medium">
                  {{ getUserDisplayName(record) }}
                </Tag>
              </template>
            </template>
          </Table>
        </div>
      </div>
    </Spin>

    <div class="flex justify-end mt-4 pt-2 border-t border-gray-100 dark:border-gray-800">
      <Button type="primary" class="bg-primary px-6" @click="handleClose">
        {{ $t('page.ops.btnOk') }}
      </Button>
    </div>
  </Modal>
</template>
