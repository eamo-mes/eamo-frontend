<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import {
  Modal,
  Form,
  FormItem,
  Select,
  InputNumber,
  DatePicker,
  Tag,
  message
} from 'ant-design-vue';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import axios from 'axios';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import type { EquipmentOption, OperatingTimeItem } from '../types';

const props = defineProps<{
  open: boolean;
  isEditing: boolean;
  editRecord: OperatingTimeItem | null;
  equipments: EquipmentOption[];
  getAuthHeaders: () => Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'success'): void;
}>();

const showModal = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
});

const submitting = ref(false);
const formRef = ref();
const formState = ref({
  equipment_id: undefined as string | undefined,
  planned_stop_time: 0,
  unplanned_stop_time: 0,
  start_time: undefined as Dayjs | undefined,
  end_time: undefined as Dayjs | undefined,
});

const rules = computed<Record<string, object[]>>(() => {
  const validateEndTime = async (_rule: unknown, value: Dayjs) => {
    if (!value) {
      return Promise.reject(new Error($t('page.ops.validationEndTimeAfterStartTime')));
    }
    if (formState.value.start_time && value.isBefore(formState.value.start_time)) {
      return Promise.reject(new Error($t('page.ops.validationEndTimeAfterStartTime')));
    }
    return Promise.resolve();
  };

  const validateStartTime = async (_rule: unknown, value: Dayjs) => {
    if (!value) {
      return Promise.reject(new Error($t('page.ops.validationStartTimeBeforeEndTime')));
    }
    if (formState.value.end_time && value.isAfter(formState.value.end_time)) {
      return Promise.reject(new Error($t('page.ops.validationStartTimeBeforeEndTime')));
    }
    return Promise.resolve();
  };

  return {
    equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
    planned_stop_time: [
      { required: true, message: $t('page.ops.validationPlannedStopTime'), trigger: 'change' },
      { type: 'number', min: 0, message: $t('page.ops.validationMinZero'), trigger: 'change' }
    ],
    unplanned_stop_time: [
      { required: true, message: $t('page.ops.validationUnplannedStopTime'), trigger: 'change' },
      { type: 'number', min: 0, message: $t('page.ops.validationMinZero'), trigger: 'change' }
    ],
    start_time: [{ required: true, validator: validateStartTime as unknown as (r: unknown, v: unknown) => Promise<void>, trigger: 'change' }],
    end_time: [{ required: true, validator: validateEndTime as unknown as (r: unknown, v: unknown) => Promise<void>, trigger: 'change' }],
  };
});

const clientWorkingTime = computed(() => {
  if (!formState.value.start_time || !formState.value.end_time) return 0;
  const diff = formState.value.end_time.diff(formState.value.start_time, 'minute');
  return Math.max(0, Number((diff / 60.0).toFixed(2)));
});

const planned_operating_time = computed(() => {
  return Math.max(0, clientWorkingTime.value - (formState.value.planned_stop_time || 0));
});

const actual_operating_time = computed(() => {
  return Number(
  Math.max(
    0,
    planned_operating_time.value - (formState.value.unplanned_stop_time || 0)
  ).toFixed(2)
);
});

const availability_factor = computed(() => {
  if (planned_operating_time.value <= 0) return 0;
  return Number(((actual_operating_time.value / planned_operating_time.value) * 100).toFixed(2));
});

watch(() => props.open, (val) => {
  if (val) {
    if (props.isEditing && props.editRecord) {
      formState.value = {
        equipment_id: props.editRecord.equipment_id,
        planned_stop_time: Number(props.editRecord.planned_stop_time),
        unplanned_stop_time: Number(props.editRecord.unplanned_stop_time),
        start_time: props.editRecord.start_time ? dayjs(props.editRecord.start_time) : undefined,
        end_time: props.editRecord.end_time ? dayjs(props.editRecord.end_time) : undefined,
      };
    } else {
      formState.value = {
        equipment_id: undefined,
        planned_stop_time: 0,
        unplanned_stop_time: 0,
        start_time: dayjs().startOf('day'),
        end_time: dayjs().endOf('day'),
      };
    }
  }
});

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const selectedEquipment = props.equipments.find(e => e.id === formState.value.equipment_id);
    const payload = {
      equipment_id: formState.value.equipment_id,
      equipment_name: selectedEquipment?.name || '',
      planned_stop_time: typeof formState.value.planned_stop_time === 'number' ? formState.value.planned_stop_time : 0,
      unplanned_stop_time: typeof formState.value.unplanned_stop_time === 'number' ? formState.value.unplanned_stop_time : 0,
      start_time: formState.value.start_time ? formState.value.start_time.format('YYYY-MM-DD HH:mm:ss') : null,
      end_time: formState.value.end_time ? formState.value.end_time.format('YYYY-MM-DD HH:mm:ss') : null,
    };

    if (props.isEditing && props.editRecord?.id) {
      await axios.put(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times/${props.editRecord.id}`, payload, {
        headers: props.getAuthHeaders(),
      });
    } else {
      await axios.post(`${API_BASE_URL}/v1/equipment/error-monitoring/operating-times`, payload, {
        headers: props.getAuthHeaders(),
      });
    }
    message.success($t('page.ops.successSave'));
    showModal.value = false;
    emit('success');
  } catch (err: any) {
    if (!err?.errorFields) {
      let msg = err?.response?.data?.message || $t('page.ops.saveFailed');
      
      // Handle PostgreSQL SQLSTATE[23502] not-null constraint violation
      if (
        msg.includes('23502') || 
        msg.toLowerCase().includes('not null violation') || 
        msg.toLowerCase().includes('violates not-null constraint')
      ) {
        msg = `${$t('page.ops.validationUnplannedStopTime')} / ${$t('page.ops.validationPlannedStopTime')}`;
      }
      
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal
    v-model:open="showModal"
    :title="isEditing ? $t('page.ops.btnEditRecord') : $t('page.ops.btnAddRecord')"
    :confirm-loading="submitting"
    :ok-text="$t('page.ops.btnOk')"
    :cancel-text="$t('page.ops.btnCancel')"
    width="1000px"
    @ok="handleOk"
    @cancel="showModal = false"
  >
    <Form
      ref="formRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      class="mt-4"
    >
      <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id">
        <Select
          v-model:value="formState.equipment_id"
          :options="equipments"
          :fieldNames="{ label: 'name', value: 'id' }"
          :placeholder="$t('page.ops.selectEquipment')"
          class="w-full"
        />
      </FormItem>

      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="$t('page.ops.plannedStopTime')" name="planned_stop_time">
          <InputNumber v-model:value="formState.planned_stop_time" :min="0" style="width: 100%" />
        </FormItem>
        <FormItem :label="$t('page.ops.unplannedStopTime')" name="unplanned_stop_time">
          <InputNumber
            v-model:value="formState.unplanned_stop_time"
            :min="0"
            style="width: 100%"
          />
        </FormItem>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="$t('page.ops.startTime')" name="start_time">
          <DatePicker v-model:value="formState.start_time" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </FormItem>
        <FormItem :label="$t('page.ops.endTime')" name="end_time">
          <DatePicker v-model:value="formState.end_time" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </FormItem>
      </div>

      <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 grid grid-cols-4 gap-4 mt-6">
        <div class="flex flex-col items-center">
          <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.workingTime') }}</span>
          <span class="text-base font-semibold text-gray-700 dark:text-gray-200">{{ clientWorkingTime }} hrs</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.plannedOperatingTime') }}</span>
          <span class="text-base font-semibold text-gray-700 dark:text-gray-200">{{ planned_operating_time }} hrs</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.actualOperatingTime') }}</span>
          <span class="text-base font-semibold text-gray-700 dark:text-gray-200">{{ actual_operating_time }} hrs</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-xs text-gray-400 mb-1">{{ $t('page.ops.availabilityFactor') }}</span>
          <Tag :color="availability_factor >= 90 ? '#2ec7c9' : availability_factor >= 75 ? '#5ab1ef' : '#b6a2de'">
            {{ availability_factor }}%
          </Tag>
        </div>
      </div>
    </Form>
  </Modal>
</template>
