<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { Modal, Form, FormItem, Select, DatePicker, message } from 'ant-design-vue';
import axios from 'axios';
import type { Dayjs } from 'dayjs';
import { API_BASE_URL } from '#/api/config';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';

interface UserOption {
  id: string;
  name: string;
}

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  equipment_errors?: { id: string; name: string }[];
}

interface ErrorOption {
  id: string;
  name: string;
}

const props = defineProps<{
  open: boolean;
  equipments: EquipmentOption[];
  allMasterErrors: ErrorOption[];
  users?: UserOption[];
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
  handler_ids: [] as string[],
});

const rules = computed(() => ({
  equipment_id: [{ required: true, message: $t('page.ops.validationEquipment') }],
  equipment_error_id: [{ required: true, message: $t('page.ops.selectError') }],
}));

watch(
  () => props.open,
  (val) => {
    if (val) {
      formState.value = {
        equipment_id: undefined,
        equipment_error_id: undefined,
        occurred_at: undefined,
        handler_ids: [],
      };
      formRef.value?.resetFields();
    }
  },
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

    const selectedEquip = props.equipments.find((e) => e.id === formState.value.equipment_id);
    const existingErrorIds = (selectedEquip?.equipment_errors || [])
      .map((e) => (typeof e === 'string' ? e : e?.id))
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const newErrorId = formState.value.equipment_error_id;

    const updatedErrorIds = Array.from(
      new Set(
        [...existingErrorIds, newErrorId].filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    );

    const payload = {
      equipment_error_ids: updatedErrorIds,
      occurred_at: formState.value.occurred_at ? formState.value.occurred_at.format('YYYY-MM-DD HH:mm:ss') : null,
      handler_ids: formState.value.handler_ids,
    };

    await axios.post(
      `${API_BASE_URL}/v1/equipment/${formState.value.equipment_id}/errors`,
      payload,
      { headers: getAuthHeaders() },
    );

    message.success($t('page.ops.successSave'));
    emit('update:open', false);
    emit('success');
  } catch (err: unknown) {
    const formErr = err as { errorFields?: unknown[] };
    if (!formErr?.errorFields) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || $t('page.ops.saveFailed');
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
    :title="$t('page.ops.createEquipmentError')"
    :confirm-loading="submitting"
    :ok-text="$t('page.ops.btnOk')"
    :cancel-text="$t('page.ops.btnCancel')"
    width="600px"
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
          :options="props.allMasterErrors"
          :field-names="{ label: 'name', value: 'id' }"
          :placeholder="$t('page.ops.selectError')"
          class="w-full"
        />
      </FormItem>

      <FormItem :label="$t('page.ops.selectHandler')" name="handler_ids">
        <Select
          v-model:value="formState.handler_ids"
          mode="multiple"
          :options="props.users || []"
          :field-names="{ label: 'name', value: 'id' }"
          :placeholder="$t('page.ops.selectHandler')"
          allow-clear
          class="w-full"
        />
      </FormItem>

      <FormItem :label="$t('page.ops.occurredAt')" name="occurred_at">
        <DatePicker
          v-model:value="formState.occurred_at"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          style="width: 100%"
          allow-clear
        />
      </FormItem>
    </Form>
  </Modal>
</template>
