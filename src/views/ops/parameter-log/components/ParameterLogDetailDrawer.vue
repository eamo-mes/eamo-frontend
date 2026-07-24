<script lang="ts" setup>
import { ref, watch } from 'vue';
import {
  Drawer,
  Descriptions,
  Tag,
  Button,
  Spin,
  message
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { $t } from '#/locales';
import { fetchParameterLogDetailApi } from '../api';
import type { ParameterLogItem } from '../types';

const DescriptionsItem = Descriptions.Item;

const props = defineProps<{
  open: boolean;
  logId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const loading = ref(false);
const detailData = ref<ParameterLogItem | null>(null);

async function loadDetail(id: string) {
  loading.value = true;
  try {
    const data = await fetchParameterLogDetailApi(id);
    detailData.value = data;
  } catch (error) {
    message.error($t('page.ops.loadDetailError'));
    console.error('Failed to load parameter log detail', error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (newVal) => {
    if (newVal && props.logId) {
      loadDetail(props.logId);
    } else {
      detailData.value = null;
    }
  }
);

function handleClose() {
  emit('update:open', false);
}
</script>

<template>
  <Drawer
    :open="props.open"
    :title="$t('page.ops.detailTitle')"
    width="800px"
    placement="right"
    @close="handleClose"
  >
    <Spin :spinning="loading">
      <div v-if="detailData" class="space-y-6">
        <!-- Main Parameter Log Info -->
        <Descriptions :title="$t('page.ops.parameterLog')" :column="1" bordered size="small">
          <DescriptionsItem :label="$t('page.ops.logId')">
            <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ detailData.id }}</span>
          </DescriptionsItem>

          <DescriptionsItem :label="$t('page.ops.colEquipment')">
            <span class="font-medium">
              {{ detailData.equipment?.name || detailData.equipment_id }}
            </span>
            <Tag v-if="detailData.equipment?.code" color="blue" class="ml-2">
              {{ detailData.equipment.code }}
            </Tag>
          </DescriptionsItem>

          <DescriptionsItem :label="$t('page.ops.parameter')">
            <span class="font-medium">
              {{ detailData.parameter?.name || detailData.equipment_parameter_id }}
            </span>
            <Tag v-if="detailData.parameter?.code" color="cyan" class="ml-2">
              {{ detailData.parameter.code }}
            </Tag>
          </DescriptionsItem>

          <DescriptionsItem :label="$t('page.ops.value')">
            <span class="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              {{ detailData.value }} {{ detailData.unit?.name || '' }}
            </span>
          </DescriptionsItem>
        </Descriptions>

        <!-- Timestamps & Metadata -->
        <Descriptions :title="$t('page.ops.loggedTime')" :column="1" bordered size="small">
          <DescriptionsItem :label="$t('page.ops.recordedAt')">
            <span class="font-medium text-blue-600 dark:text-blue-400">
              {{ detailData.recorded_at ? dayjs(detailData.recorded_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}
            </span>
          </DescriptionsItem>

          <DescriptionsItem label="Created At">
            <span>
              {{ detailData.created_at ? dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}
            </span>
          </DescriptionsItem>

          <DescriptionsItem :label="$t('page.ops.updatedAt')">
            <span>
              {{ detailData.updated_at ? dayjs(detailData.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-' }}
            </span>
          </DescriptionsItem>

          <DescriptionsItem v-if="detailData.deleted_at" :label="$t('page.ops.deletedAt')">
            <Tag color="red">
              {{ dayjs(detailData.deleted_at).format('YYYY-MM-DD HH:mm:ss') }}
            </Tag>
          </DescriptionsItem>

          <DescriptionsItem v-if="detailData.user" :label="$t('page.ops.colCreatedBy')">
            <span>{{ detailData.user.name }} ({{ detailData.user.email || detailData.user.id }})</span>
          </DescriptionsItem>
        </Descriptions>
      </div>
    </Spin>

    <template #footer>
      <div class="flex justify-end">
        <Button @click="handleClose">
          {{ $t('page.ops.btnCancel') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
