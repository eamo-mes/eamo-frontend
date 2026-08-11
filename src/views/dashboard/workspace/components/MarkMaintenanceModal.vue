<script setup lang="ts">
import { ref, watch } from 'vue';
import { Modal, Form, Select, Button, message } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import DatePicker from 'ant-design-vue/es/date-picker';
import dayjs, { type Dayjs } from 'dayjs';
import { requestClient } from '#/api/request';
import { $t } from '#/locales';
import type { EquipmentOption } from '../types';

interface Props {
  open: boolean;
  equipments: EquipmentOption[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'marked'): void;
}>();

const loading = ref(false);
const formRef = ref();

const formState = ref<{
  equipment_id: string | undefined;
  datetime: Dayjs | undefined;
}>({
  equipment_id: undefined,
  datetime: dayjs(),
});

const rules: Record<string, Rule[]> = {
  equipment_id: [{ required: true, message: $t('page.ops.selectEquipmentPrompt'), trigger: 'change' }],
  datetime: [{ required: true, message: $t('page.ops.selectDatetimePrompt'), trigger: 'change' }],
};

watch(
  () => props.open,
  (val) => {
    if (val) {
      formState.value = {
        equipment_id: undefined,
        datetime: dayjs(),
      };
      if (formRef.value) {
        formRef.value.resetFields();
      }
    }
  }
);

function handleCancel(): void {
  emit('update:open', false);
}

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  if (!formState.value.equipment_id || !formState.value.datetime) return;

  loading.value = true;
  try {
    await requestClient.request(`/v1/equipment/${formState.value.equipment_id}/last-maintenance`, {
      method: 'PATCH',
      data: {
        datetime: formState.value.datetime.format('YYYY-MM-DD HH:mm:ss'),
      }
    });

    message.success($t('page.ops.lastMaintenanceSetSuccess'));
    emit('marked');
    emit('update:open', false);
  } catch (error: unknown) {
    const apiMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiMsg || $t('page.ops.markError'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Modal
    :open="props.open"
    :title="$t('page.ops.markAsLastMaintenance')"
    width="600px"
    :confirm-loading="loading"
    @cancel="handleCancel"
  >
    <Form
      ref="formRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      class="mt-4"
    >
      <Form.Item
        name="equipment_id"
        :label="$t('page.ops.colEquipment')"
      >
        <Select
          v-model:value="formState.equipment_id"
          :placeholder="$t('page.ops.selectEquipment')"
          show-search
          option-filter-prop="label"
          class="w-full"
        >
          <Select.Option
            v-for="eq in props.equipments"
            :key="eq.id"
            :value="eq.id"
            :label="eq.name ? `${eq.code} — ${eq.name}` : eq.code"
          >
            <span class="font-semibold">{{ eq.code }}</span>
            <span v-if="eq.name" class="text-muted-foreground text-xs ml-1.5">— {{ eq.name }}</span>
          </Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="datetime"
        :label="$t('page.ops.maintenanceTime')"
      >
        <DatePicker
          v-model:value="formState.datetime"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          class="w-full"
        />
      </Form.Item>
    </Form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="handleCancel">
          {{ $t('page.ops.btnCancel') }}
        </Button>
        <Button type="primary" :loading="loading" @click="handleSubmit">
          {{ $t('page.ops.btnOk') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
