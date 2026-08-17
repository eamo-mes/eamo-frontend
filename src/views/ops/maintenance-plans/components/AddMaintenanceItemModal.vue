<script setup lang="ts">
import { ref, watch } from 'vue';
import { Modal, Form, FormItem, Input, message } from 'ant-design-vue';
import { $t } from '#/locales';
import {
  createMaintenanceItemApi,
  type MaintenanceItemOption,
} from '#/api/ops/maintenance-plans';

const props = defineProps<{
  open: boolean;
  categoryId: string | undefined;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'success', item: MaintenanceItemOption): void;
}>();

const newItemName = ref('');
const newItemDescription = ref('');
const addingItem = ref(false);

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      newItemName.value = '';
      newItemDescription.value = '';
    }
  }
);

function handleCancel(): void {
  emit('update:open', false);
}

async function handleSubmit(): Promise<void> {
  const name = newItemName.value.trim();
  if (!name || !props.categoryId) {
    message.error($t('page.ops.itemNameRequired'));
    return;
  }
  addingItem.value = true;
  try {
    const item = await createMaintenanceItemApi({
      name,
      description: newItemDescription.value.trim() || null,
      maintenance_category_id: props.categoryId,
    });
    emit('success', item);
    emit('update:open', false);
    message.success($t('page.ops.addItemSuccess'));
  } catch (err: unknown) {
    const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiError || $t('page.ops.addItemError'));
  } finally {
    addingItem.value = false;
  }
}
</script>

<template>
  <Modal
    :open="props.open"
    :title="$t('page.ops.addItemModalTitle')"
    @ok="handleSubmit"
    :confirm-loading="addingItem"
    @cancel="handleCancel"
    :ok-text="$t('page.ops.btnSave')"
    :cancel-text="$t('page.ops.btnCancel')"
    width="600px"
  >
    <Form layout="vertical" class="mt-4">
      <!-- Tên hạng mục -->
      <FormItem :label="$t('page.ops.newItemNameLabel')" required>
        <Input
          v-model:value="newItemName"
          :placeholder="$t('page.ops.placeholderNewItemName')"
          @press-enter="handleSubmit"
        />
      </FormItem>

      <!-- Mô tả -->
      <FormItem :label="$t('page.ops.colItemDesc')">
        <Input.TextArea
          v-model:value="newItemDescription"
          :placeholder="$t('page.ops.placeholderNewItemDesc')"
          :rows="3"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
