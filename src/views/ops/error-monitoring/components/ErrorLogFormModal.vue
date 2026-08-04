<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Modal, Form, FormItem, Select, DatePicker, message } from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';

interface UserOption {
  id: string;
  name: string;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  equipment_errors?: ErrorOption[];
}

interface ErrorLogItem {
  id: string;
  equipment_id: string;
  equipment_error_id: string;
  occurred_at?: string | null;
  restarted_at?: string | null;
  handled_at?: string | null;
  created_at?: string;
  handler_ids?: string[];
  equipment_error?: { name: string };
  handlers?: Array<{ id: string; name: string }>;
}

const props = defineProps<{
  open: boolean;
  isEditing: boolean;
  record?: ErrorLogItem | null;
  equipments: EquipmentOption[];
  users: UserOption[];
  allMasterErrors?: ErrorOption[];
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}>();

const submitting = ref(false);
const formRef = ref();

const formState = ref({
  equipment_id: undefined as string | undefined,
  equipment_error_id: undefined as string | undefined,
  occurred_at: undefined as Dayjs | undefined,
  restarted_at: undefined as Dayjs | undefined,
  handled_at: undefined as Dayjs | undefined,
  handler_ids: [] as string[],
});

const rules = computed(() => ({
  equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
  equipment_error_id: [{ required: true, message: $t('page.ops.selectError') }],
  occurred_at: [{ required: true, message: $t('page.ops.occurredAt') }],
}));

// Computed available errors for selected equipment, with fallback to allMasterErrors if no errors assigned
const availableErrors = computed(() => {
  if (!formState.value.equipment_id) return [];
  const equip = props.equipments.find((e) => e.id === formState.value.equipment_id);
  if (equip?.equipment_errors && equip.equipment_errors.length > 0) {
    return equip.equipment_errors;
  }
  return props.allMasterErrors || [];
});

watch(
  () => formState.value.equipment_id,
  () => {
    if (!props.isEditing) {
      formState.value.equipment_error_id = undefined;
    }
  },
);

watch(
  () => props.open,
  (val) => {
    if (val) {
      if (props.isEditing && props.record) {
        formState.value = {
          equipment_id: props.record.equipment_id,
          equipment_error_id: props.record.equipment_error_id,
          occurred_at: props.record.occurred_at ? dayjs(props.record.occurred_at) : undefined,
          restarted_at: props.record.restarted_at ? dayjs(props.record.restarted_at) : undefined,
          handled_at: props.record.handled_at ? dayjs(props.record.handled_at) : undefined,
          handler_ids: props.record.handlers ? props.record.handlers.map((h) => h.id) : [],
        };
      } else {
        formState.value = {
          equipment_id: undefined,
          equipment_error_id: undefined,
          occurred_at: dayjs(),
          restarted_at: undefined,
          handled_at: undefined,
          handler_ids: [],
        };
      }
      nextTick(() => {
        formRef.value?.clearValidate();
      });
    }
  },
  { immediate: true },
);

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      equipment_id: formState.value.equipment_id,
      equipment_error_id: formState.value.equipment_error_id,
      occurred_at: formState.value.occurred_at
        ? formState.value.occurred_at.format('YYYY-MM-DD HH:mm:ss')
        : dayjs().format('YYYY-MM-DD HH:mm:ss'),
      restarted_at: formState.value.restarted_at ? formState.value.restarted_at.format('YYYY-MM-DD HH:mm:ss') : null,
      handled_at: formState.value.handled_at ? formState.value.handled_at.format('YYYY-MM-DD HH:mm:ss') : null,
      handler_ids: formState.value.handler_ids || [],
    };

    if (props.isEditing && props.record?.id) {
      await axios.put(
        `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs/${props.record.id}`,
        payload,
        { headers: getAuthHeaders() },
      );
      message.success($t('page.ops.successSave'));
    } else {
      await axios.post(
        `${API_BASE_URL}/v1/equipment/error-monitoring/equipment-error-logs`,
        payload,
        { headers: getAuthHeaders() },
      );
      message.success($t('page.ops.successSave'));
    }

    emit('update:open', false);
    emit('success');
  } catch (err: unknown) {
    const formErr = err as { errorFields?: unknown[] };
    if (!formErr?.errorFields) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const serverErrors = axiosErr?.response?.data?.errors;
      let msg = axiosErr?.response?.data?.message || $t('page.ops.saveFailed');
      if (serverErrors && typeof serverErrors === 'object') {
        const errorDetails = Object.values(serverErrors).flat().join(', ');
        if (errorDetails) {
          msg = `${msg}: ${errorDetails}`;
        }
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
    :open="props.open"
    :title="props.isEditing ? $t('page.ops.editErrorLog') : $t('page.ops.addErrorLog')"
    :confirm-loading="submitting"
    :ok-text="$t('page.ops.btnOk')"
    :cancel-text="$t('page.ops.btnCancel')"
    width="800px"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <Form
      ref="formRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      class="mt-4"
    >
      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="$t('page.ops.colEquipment')" name="equipment_id">
          <Select
            v-model:value="formState.equipment_id"
            :options="props.equipments"
            :field-names="{ label: 'name', value: 'id' }"
            :placeholder="$t('page.ops.selectEquipment')"
            class="w-full"
          />
        </FormItem>

        <FormItem :label="$t('page.ops.error')" name="equipment_error_id">
          <Select
            v-model:value="formState.equipment_error_id"
            :options="availableErrors"
            :field-names="{ label: 'name', value: 'id' }"
            :placeholder="$t('page.ops.selectError')"
            :disabled="!formState.equipment_id"
            class="w-full"
          />
        </FormItem>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <FormItem :label="$t('page.ops.occurredAt')" name="occurred_at">
          <DatePicker
            v-model:value="formState.occurred_at"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </FormItem>

        <FormItem :label="$t('page.ops.handledAt')" name="handled_at">
          <DatePicker
            v-model:value="formState.handled_at"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
            allow-clear
          />
        </FormItem>
      </div>

      <div class="border-t border-gray-100 dark:border-gray-700 pt-4">
        <FormItem :label="$t('page.ops.handler')" name="handler_ids">
          <Select
            v-model:value="formState.handler_ids"
            mode="multiple"
            :options="props.users"
            :field-names="{ label: 'name', value: 'id' }"
            :placeholder="$t('page.ops.selectHandler')"
            allow-clear
            class="w-full"
          />
        </FormItem>
      </div>
    </Form>
  </Modal>
</template>
