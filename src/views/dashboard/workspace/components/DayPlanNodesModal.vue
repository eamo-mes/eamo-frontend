<script setup lang="ts">
import { computed } from 'vue';
import { Modal, Table, Tag, Button, Empty } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';
import { $t } from '#/locales';
import type { ScheduleRow } from '#/api/ops/maintenance-plans';
import type { DailyPlanNode } from '../types';

const props = defineProps<{
  open: boolean;
  date: Dayjs | null;
  nodes: DailyPlanNode[];
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'selectSchedule', schedule: ScheduleRow): void;
}>();

const modalTitle = computed(() => {
  const dateStr = props.date ? props.date.format('DD/MM/YYYY') : '';
  return $t('page.ops.dayNodesModalTitle', { date: dateStr }) || `Danh sách kế hoạch bảo trì — ${dateStr}`;
});

const columns = [
  {
    title: $t('page.ops.colPlanCode') || 'Mã kế hoạch',
    dataIndex: 'plan_code',
    key: 'plan_code',
  },
  {
    title: $t('page.ops.colEquipment') || 'Thiết bị',
    key: 'equipment',
  },
  {
    title: $t('page.ops.colProgress') || 'Tiến độ',
    key: 'progress',
  },
  {
    title: $t('page.ops.colMaintenanceType') || 'Loại bảo trì',
    dataIndex: 'maintenance_type',
    key: 'maintenance_type',
  },
  {
    title: $t('page.ops.colStatus') || 'Trạng thái',
    dataIndex: 'result',
    key: 'result',
    align: 'center' as const,
  },
  {
    title: $t('page.ops.colActions') || 'Thao tác',
    key: 'actions',
    width: 120,
    align: 'center' as const,
  },
];

function handleClose() {
  emit('update:open', false);
}

function handleViewDetail(node: DailyPlanNode) {
  const schedule = node.schedules?.[0];
  if (schedule) {
    emit('selectSchedule', schedule);
    handleClose();
  }
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
        v-if="nodes.length > 0"
        :columns="columns"
        :data-source="nodes"
        row-key="key"
        :pagination="{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'] }"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'plan_code'">
            <span class="font-semibold text-foreground">{{ (record as DailyPlanNode).plan_code }}</span>
          </template>

          <template v-else-if="column.key === 'equipment'">
            <div class="flex flex-col">
              <span class="font-medium text-foreground">{{ (record as DailyPlanNode).equipment_code }}</span>
              <span v-if="(record as DailyPlanNode).equipment_name" class="text-xs text-muted-foreground">
                {{ (record as DailyPlanNode).equipment_name }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'progress'">
            <span class="text-sm">
              {{ (record as DailyPlanNode).completed_items }}/{{ (record as DailyPlanNode).total_items }}
            </span>
          </template>

          <template v-else-if="column.key === 'maintenance_type'">
            <Tag color="blue">
              {{ (record as DailyPlanNode).maintenance_type }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'result'">
            <Tag :color="(record as DailyPlanNode).result === 'Completed' ? 'success' : 'processing'">
              {{ (record as DailyPlanNode).result }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Button
              type="primary"
              size="small"
              ghost
              @click="handleViewDetail(record as DailyPlanNode)"
            >
              {{ $t('page.ops.viewDetail') || 'Xem chi tiết' }}
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
