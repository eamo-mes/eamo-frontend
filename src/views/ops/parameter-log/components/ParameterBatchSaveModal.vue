<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import {
  Modal,
  Form,
  FormItem,
  Select,
  Input,
  DatePicker,
  Button,
  Skeleton,
  Tag,
  message
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { $t } from '#/locales';
import { batchSaveParameterLogsApi } from '../api';
import type { EquipmentOption, ParameterOption, UnitOption, BatchParameterItem } from '../types';

interface TimeRecordRow {
  _key: string;
  recorded_at?: Dayjs;
  value: string;
}

const props = defineProps<{
  open: boolean;
  equipments: EquipmentOption[];
  units: UnitOption[];
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}>();

const submitting = ref(false);
const loadingRecords = ref(false);
const selectedEquipmentId = ref<string | undefined>(undefined);
const selectedParameterId = ref<string | undefined>(undefined);
const selectedUnitId = ref<string | undefined>(undefined);
const recordRows = ref<TimeRecordRow[]>([]);

function generateKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Available parameters for selected equipment
const availableParameters = computed<ParameterOption[]>(() => {
  if (!selectedEquipmentId.value) return [];
  const equip = props.equipments.find((e) => e.id === selectedEquipmentId.value);
  return equip?.equipment_parameters ?? [];
});

// Selected parameter object
const selectedParameterObj = computed(() => {
  if (!selectedParameterId.value) return null;
  return availableParameters.value.find((p) => p.id === selectedParameterId.value) || null;
});

// Selected unit name
const unitName = computed(() => {
  if (!selectedUnitId.value) return '';
  const u = props.units.find((unit) => unit.id === selectedUnitId.value);
  return u ? u.name : '';
});

// Watch equipment selection to reset parameter & records
watch(selectedEquipmentId, () => {
  selectedParameterId.value = undefined;
  selectedUnitId.value = undefined;
  recordRows.value = [];
});

function addRecordRow(): void {
  recordRows.value.push({
    _key: generateKey(),
    recorded_at: dayjs(),
    value: '',
  });
}

function removeRecordRow(index: number): void {
  recordRows.value.splice(index, 1);
}

// Watch parameter selection to auto-select unit & initialize time records
watch(selectedParameterId, async (newParamId) => {
  recordRows.value = [];
  if (newParamId) {
    loadingRecords.value = true;
    const param = availableParameters.value.find((p) => p.id === newParamId);
    if (param && param.unit_id) {
      selectedUnitId.value = param.unit_id;
    } else {
      selectedUnitId.value = undefined;
    }

    // Skeleton loading feedback for user experience
    await new Promise((resolve) => setTimeout(resolve, 250));

    addRecordRow();
    loadingRecords.value = false;
  }
});

watch(
  () => props.open,
  (newVal) => {
    if (!newVal) {
      selectedEquipmentId.value = undefined;
      selectedParameterId.value = undefined;
      selectedUnitId.value = undefined;
      recordRows.value = [];
      loadingRecords.value = false;
    }
  }
);

async function handleSubmit(): Promise<void> {
  if (!selectedEquipmentId.value) {
    message.warning($t('page.ops.selectEquipment'));
    return;
  }

  if (!selectedParameterId.value) {
    message.warning($t('page.ops.selectParameter'));
    return;
  }

  const parametersPayload: BatchParameterItem[] = [];

  recordRows.value.forEach((row) => {
    if (row.value !== undefined && row.value !== null && String(row.value).trim() !== '') {
      parametersPayload.push({
        equipment_parameter_id: selectedParameterId.value!,
        unit_id: selectedUnitId.value || null,
        value: row.value,
        recorded_at: row.recorded_at ? row.recorded_at.format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
    }
  });

  if (parametersPayload.length === 0) {
    message.warning($t('page.ops.noParametersFound'));
    return;
  }

  submitting.value = true;
  try {
    await batchSaveParameterLogsApi({
      equipment_id: selectedEquipmentId.value,
      parameters: parametersPayload,
    });
    message.success($t('page.ops.batchSaveSuccess'));
    emit('success');
    emit('update:open', false);
  } catch (error) {
    message.error($t('page.ops.batchSaveError'));
    console.error('Failed to batch save parameter logs', error);
  } finally {
    submitting.value = false;
  }
}

function handleCancel(): void {
  emit('update:open', false);
}
</script>

<template>
  <Modal
    :open="props.open"
    :title="$t('page.ops.batchSaveTitle')"
    width="800px"
    :confirm-loading="submitting"
    :ok-text="$t('page.ops.btnOk')"
    :cancel-text="$t('page.ops.btnCancel')"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <div class="space-y-4 my-2">
      <!-- Top Section: Equipment & Parameter Selection -->
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-4">
          <FormItem :label="$t('page.ops.colEquipment')" required>
            <Select
              v-model:value="selectedEquipmentId"
              :options="props.equipments"
              :field-names="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectEquipment')"
              class="w-full"
              show-search
              option-filter-prop="name"
            />
          </FormItem>

          <FormItem :label="$t('page.ops.parameter')" required>
            <Select
              v-model:value="selectedParameterId"
              :options="availableParameters"
              :field-names="{ label: 'name', value: 'id' }"
              :placeholder="$t('page.ops.selectParameter')"
              :disabled="!selectedEquipmentId"
              class="w-full"
              show-search
              option-filter-prop="name"
            />
          </FormItem>
        </div>
      </Form>

      <!-- Selected Parameter Summary Banner (Slate Styling) -->
      <div v-if="selectedParameterObj" class="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-3.5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500 font-medium uppercase">{{ $t('page.ops.selectedParameter') }}:</span>
          <span class="font-semibold text-slate-800 dark:text-gray-200 text-sm">
            {{ selectedParameterObj.name }}
          </span>
          <Tag class="m-0 font-mono bg-slate-100 text-slate-700 border-slate-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
            {{ selectedParameterObj.code }}
          </Tag>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500 font-medium">{{ $t('page.ops.unitLabel') }}:</span>
            {{ unitName || '-' }}
          </div>
      </div>

      <!-- Nested Time-based Records Section -->
      <div v-if="selectedParameterId" class="mt-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 pb-2">
          <div class="font-semibold text-slate-700 dark:text-gray-200 text-sm">
            {{ $t('page.ops.nestedTimeRecordsTitle') }}
          </div>
        </div>

        <!-- Skeleton Loading State -->
        <div v-if="loadingRecords" class="py-4 space-y-3">
          <Skeleton active :paragraph="{ rows: 2 }" />
        </div>

        <!-- Dynamic Time Record Rows -->
        <div v-else class="max-h-[360px] divide-y divide-slate-100 dark:divide-gray-700 overflow-y-auto pr-1">
          <div
            v-for="(row, idx) in recordRows"
            :key="row._key"
            class="flex flex-wrap items-end gap-3 py-3 first:pt-0 last:pb-0"
          >
            <!-- Recorded At DatePicker -->
            <div class="flex-1 min-w-[280px]">
              <span class="text-xs text-slate-500 block mb-1 font-medium">{{ $t('page.ops.recordedAt') }}</span>
              <DatePicker
                v-model:value="row.recorded_at"
                show-time
                format="YYYY-MM-DD HH:mm:ss"
                class="w-full"
              />
            </div>

            <!-- Value Input with Unit Suffix -->
            <div class="flex-1 min-w-[260px]">
              <span class="text-xs text-slate-500 block mb-1 font-medium">{{ $t('page.ops.value') }}</span>
              <Input
                v-model:value="row.value"
                :placeholder="$t('page.ops.value')"
              >
                <template v-slot:addonAfter>
                  <span class="font-medium text-slate-600 dark:text-gray-400">{{ unitName || '-' }}</span>
                </template>
              </Input>
            </div>

            <!-- Remove Button -->
            <div class="pb-0.5">
              <Button
                type="text"
                danger
                @click="removeRecordRow(idx)"
              >
                {{ $t('page.company.btnDelete') }}
              </Button>
            </div>
          </div>
        </div>

        <Button type="dashed" block class="mt-3 text-slate-600 dark:text-gray-300 hover:text-slate-800" @click="addRecordRow">
          + {{ $t('page.ops.btnAddTimeRecord') }}
        </Button>
      </div>
    </div>
  </Modal>
</template>
