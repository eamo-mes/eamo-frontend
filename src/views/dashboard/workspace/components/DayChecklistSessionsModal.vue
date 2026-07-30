<script setup lang="ts">
import { computed } from 'vue';
import { Modal, Table, Tag, Button, Empty } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';
import { $t } from '#/locales';
import type { ChecklistSession, ChecklistDetailItem, ChecklistLog } from '../types';

const props = defineProps<{
  open: boolean;
  date: Dayjs | null;
  sessions: ChecklistSession[];
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'selectSession', session: ChecklistSession): void;
}>();

const modalTitle = computed(() => {
  const dateStr = props.date ? props.date.format('DD/MM/YYYY') : '';
  return $t('page.ops.checklistModalTitle', { date: dateStr }) || `Danh sách phiên kiểm tra — ${dateStr}`;
});

const columns = [
  {
    title: $t('page.ops.colChecklistSession') || 'Tên phiên kiểm tra',
    key: 'session_name',
  },
  {
    title: $t('page.ops.colEquipment') || 'Thiết bị',
    key: 'equipment',
  },
  {
    title: $t('page.ops.colStatus') || 'Trạng thái',
    key: 'status',
    align: 'center' as const,
  },
  {
    title: $t('page.ops.colActions') || 'Thao tác',
    key: 'actions',
    width: 120,
    align: 'center' as const,
  },
];

function getLatestCompletedLog(detail: ChecklistDetailItem): ChecklistLog | undefined {
  return detail.logs
    ?.filter((log) => log.status === 'completed')
    .sort((left, right) => (left.checked_at ?? '').localeCompare(right.checked_at ?? ''))
    .at(-1);
}

function getSessionStatus(session: ChecklistSession): 'success' | 'processing' {
  if (!session.details || session.details.length === 0) return 'processing';
  const completedLogs = session.details.map(getLatestCompletedLog);
  const allCompleted = completedLogs.every((log) => log !== undefined);
  const allPassed = allCompleted && completedLogs.every((log) => log?.result === 'pass');
  return allPassed ? 'success' : 'processing';
}

function handleClose() {
  emit('update:open', false);
}

function handleEvaluate(session: ChecklistSession) {
  emit('selectSession', session);
  handleClose();
}
</script>

<template>
  <Modal
    :open="open"
    :title="modalTitle"
    width="1000px"
    :footer="null"
    destroy-on-close
    @cancel="handleClose"
  >
    <div class="py-2">
      <Table
        v-if="sessions.length > 0"
        :columns="columns"
        :data-source="sessions"
        row-key="id"
        :pagination="{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'] }"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'session_name'">
            <span class="font-semibold text-foreground">
              {{ (record as ChecklistSession).name || (record as ChecklistSession).equipment?.name || $t('page.ops.checklistDrawer.sessionText') }}
            </span>
          </template>

          <template v-else-if="column.key === 'equipment'">
            <div class="flex flex-col">
              <span class="font-medium text-foreground">{{ (record as ChecklistSession).equipment?.code || '—' }}</span>
              <span v-if="(record as ChecklistSession).equipment?.name" class="text-xs text-muted-foreground">
                {{ (record as ChecklistSession).equipment?.name }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'status'">
            <Tag :color="getSessionStatus(record as ChecklistSession) === 'success' ? 'success' : 'processing'">
              {{ getSessionStatus(record as ChecklistSession) === 'success' ? 'Pass' : 'Pending' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Button
              type="primary"
              size="small"
              ghost
              @click="handleEvaluate(record as ChecklistSession)"
            >
              {{ $t('page.ops.judgeSession') || 'Đánh giá' }}
            </Button>
          </template>
        </template>
      </Table>
      <div v-else class="py-12 flex justify-center">
        <Empty :description="$t('page.ops.noNodesForDate') || 'Không có bản ghi nào trong ngày này'" />
      </div>
    </div>
  </Modal>
</template>
