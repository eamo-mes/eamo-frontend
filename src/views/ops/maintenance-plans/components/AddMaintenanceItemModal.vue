<script setup lang="ts">
import { ref, watch } from 'vue';
import { Modal, Form, FormItem, Input, Select, message } from 'ant-design-vue';
import { $t } from '#/locales';
import axios from 'axios';

interface UserOption {
  label: string;
  value: string;
}

interface MaintenanceItemOption {
  id: string;
  name: string;
  description: string | null;
  maintenance_category_id: string;
}

const props = defineProps<{
  open: boolean;
  categoryId: string | undefined;
  userOptions: UserOption[];
  apiBaseUrl: string;
  authHeaders: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'success', item: MaintenanceItemOption, userIds: string[]): void;
}>();

const newItemName = ref('');
const newItemDescription = ref('');
const newItemUserIds = ref<string[]>([]);
const addingItem = ref(false);

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      newItemName.value = '';
      newItemDescription.value = '';
      newItemUserIds.value = [];
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
    const res = await axios.post(
      `${props.apiBaseUrl}/v1/maintenance-items`,
      {
        name,
        description: newItemDescription.value.trim() || null,
        maintenance_category_id: props.categoryId,
      },
      { headers: props.authHeaders },
    );
    const created = res.data as MaintenanceItemOption;
    emit('success', created, newItemUserIds.value);
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

      <!-- Kỹ thuật viên chịu trách nhiệm -->
      <FormItem :label="$t('page.ops.assignedTechnicians')">
        <Select
          v-model:value="newItemUserIds"
          :options="props.userOptions"
          :placeholder="$t('page.ops.placeholderAssignedUsers')"
          mode="multiple"
          option-filter-prop="label"
          show-search
          allow-clear
          class="w-full"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
