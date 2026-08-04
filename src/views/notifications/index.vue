<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Table,
  Button,
  Tag,
  Select,
  DatePicker,
  message,
  Spin,
} from 'ant-design-vue';
import { useUserStore } from '@vben/stores';
import { useAuthStore } from '#/store';
import { $t } from '#/locales';
import {
  getUserNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  type BackendNotification,
} from '#/api/core/notification';

const RangePicker = DatePicker.RangePicker;
const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();

const loading = ref(false);
const notifications = ref<BackendNotification[]>([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const filterStatus = ref<'all' | 'unread' | 'read'>('all');
const filterDeadlineRange = ref<[string, string] | undefined>(undefined);

const columns = computed(() => [
  {
    title: $t('page.ops.colStatus') || 'Trạng thái',
    key: 'status',
    width: 120,
    align: 'center' as const,
  },
  {
    title: $t('page.ops.colCode') || 'Nội dung thông báo',
    key: 'title_content',
  },
  {
    title: $t('page.ops.colMaintenanceType') || 'Loại thông báo',
    key: 'type',
    width: 180,
  },
  {
    title: $t('page.ops.colDate') || 'Thời gian',
    key: 'created_at',
    width: 180,
  },
  {
    title: $t('page.company.colActions') || 'Hành động',
    key: 'actions',
    width: 280,
    align: 'right' as const,
    fixed: 'right' as const,
  },
]);

async function getUserId(): Promise<string> {
  const userInfo = userStore.userInfo as { userId?: string; id?: string } | undefined;
  let id = userInfo?.userId || userInfo?.id;
  if (!id) {
    try {
      const info = await authStore.fetchUserInfo() as { userId?: string; id?: string } | undefined;
      id = info?.userId || info?.id;
    } catch {
      // ignore
    }
  }
  return id || '';
}

async function loadNotifications(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const userId = await getUserId();
    if (!userId) {
      notifications.value = [];
      return;
    }

    const params: Record<string, unknown> = {
      page,
      per_page: size,
    };
    if (filterStatus.value === 'unread') {
      params.unread_only = true;
    }
    if (filterDeadlineRange.value && filterDeadlineRange.value.length === 2) {
      params.start_deadline = filterDeadlineRange.value[0];
      params.end_deadline = filterDeadlineRange.value[1];
    }

    const res = await getUserNotificationsApi(userId, params);
    let list = res.notifications?.data ?? [];

    if (filterStatus.value === 'read') {
      list = list.filter((item) => item.read_at !== null);
    }

    if (filterDeadlineRange.value && filterDeadlineRange.value.length === 2) {
      const [startTs, endTs] = filterDeadlineRange.value;
      const startTime = new Date(startTs).getTime();
      const endTime = new Date(endTs).getTime();
      list = list.filter((item) => {
        const itemDeadlineStr = item.data?.deadline || item.data?.due_date || item.created_at;
        if (!itemDeadlineStr) return false;
        const itemTime = new Date(itemDeadlineStr).getTime();
        return itemTime >= startTime && itemTime <= endTime;
      });
    }

    notifications.value = list;
    total.value = res.notifications?.total ?? list.length;
    currentPage.value = page;
    pageSize.value = size;
  } catch (err: unknown) {
    const errorObj = err as Error;
    message.error(errorObj?.message || 'Không thể tải danh sách thông báo');
  } finally {
    loading.value = false;
  }
}

async function handleMarkRead(record: BackendNotification) {
  try {
    await markNotificationReadApi(record.id);
    record.read_at = new Date().toISOString();
    message.success($t('page.notification.msgMarkReadSuccess') || 'Đã đánh dấu là đã đọc');
  } catch (err: unknown) {
    const errorObj = err as Error;
    message.error(errorObj?.message || 'Lỗi khi cập nhật trạng thái');
  }
}

async function handleMarkAllRead() {
  try {
    await markAllNotificationsReadApi();
    notifications.value.forEach((n) => {
      n.read_at = new Date().toISOString();
    });
    message.success($t('page.notification.msgMarkAllReadSuccess') || 'Đã đánh dấu tất cả thông báo là đã đọc');
  } catch (err: unknown) {
    const errorObj = err as Error;
    message.error(errorObj?.message || 'Lỗi khi cập nhật trạng thái');
  }
}

function handleFilterChange() {
  currentPage.value = 1;
  loadNotifications(1);
}

function handleReset() {
  filterStatus.value = 'all';
  filterDeadlineRange.value = undefined;
  currentPage.value = 1;
  loadNotifications(1);
}

function handleTableChange(pagination: { current?: number; pageSize?: number }) {
  const page = pagination.current || 1;
  const size = pagination.pageSize || 10;
  loadNotifications(page, size);
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getEntityTypeLabel(entityType?: string): string {
  switch (entityType) {
    case 'checklist_session':
      return $t('page.notification.typeChecklistSession') || 'Checklist Session';
    case 'maintenance_schedule':
      return $t('page.notification.typeMaintenanceSchedule') || 'Lịch bảo trì';
    case 'error_log':
      return $t('page.notification.typeErrorLog') || 'Lỗi thiết bị';
    case 'maintenance_item':
      return $t('page.notification.typeMaintenanceItem') || 'Hạng mục bảo trì';
    default:
      return entityType ? entityType : ($t('page.notification.typeSystem') || 'Thông báo hệ thống');
  }
}

function getEntityTypeColor(entityType?: string): string {
  switch (entityType) {
    case 'checklist_session':
      return 'processing';
    case 'maintenance_schedule':
      return 'purple';
    case 'error_log':
      return 'error';
    case 'maintenance_item':
      return 'warning';
    default:
      return 'default';
  }
}

function navigateToEntity(record: BackendNotification) {
  const data = record.data;
  if (!data) return;

  if (!record.read_at) {
    handleMarkRead(record);
  }

  if (data.entity_type === 'checklist_session' && data.entity_id) {
    router.push({
      path: '/maintenance/checklist/detail',
      query: { id: data.entity_id },
    });
  } else if (data.entity_type === 'maintenance_schedule') {
    router.push('/ops/maintenance-plans');
  } else if (data.entity_type === 'error_log') {
    router.push('/equipment/errors');
  }
}

onMounted(() => {
  loadNotifications();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar (following /equipment/units UI design pattern) -->
    <div class="action-bar bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
      <Select
        v-model:value="filterStatus"
        class="min-w-[160px]"
        @change="handleFilterChange"
      >
        <Select.Option value="all">
          {{ $t('page.notification.filterAll') || 'Tất cả thông báo' }}
        </Select.Option>
        <Select.Option value="unread">
          {{ $t('page.notification.filterUnread') || 'Chưa đọc' }}
        </Select.Option>
        <Select.Option value="read">
          {{ $t('page.notification.filterRead') || 'Đã đọc' }}
        </Select.Option>
      </Select>

      <RangePicker
        v-model:value="filterDeadlineRange"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        :placeholder="[
          $t('page.notification.deadlineFrom') || 'Hạn chót từ',
          $t('page.notification.deadlineTo') || 'Hạn chót đến'
        ]"
        class="min-w-[340px] flex-shrink-0"
        allow-clear
        @change="handleFilterChange"
      />

      <Button type="default" @click="handleFilterChange">
        {{ $t('page.company.btnFilter') }}
      </Button>

      <Button type="default" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>

      <div class="ml-auto">
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full"
          @click="handleMarkAllRead"
        >
          {{ $t('page.notification.btnMarkAllRead') || 'Đánh dấu tất cả đã đọc' }}
        </Button>
      </div>
    </div>

    <!-- Table Container (following /equipment/units UI design pattern) -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="notifications"
          row-key="id"
          :scroll="{ x: 'max-content' }"
          :pagination="{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (tot: number) => $t('page.company.users.showTotal', { total: tot }),
          }"
          class="w-full"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <!-- Status Column -->
            <template v-if="column.key === 'status'">
              <Tag v-if="!record.read_at" color="processing">
                {{ $t('page.notification.statusUnread') || 'Chưa đọc' }}
              </Tag>
              <Tag v-else color="default">
                {{ $t('page.notification.statusRead') || 'Đã đọc' }}
              </Tag>
            </template>

            <!-- Title & Message Column -->
            <template v-else-if="column.key === 'title_content'">
              <div class="flex flex-col gap-0.5 cursor-pointer hover:text-primary transition-colors" @click="navigateToEntity(record as BackendNotification)">
                <span class="font-semibold text-sm text-foreground">
                  {{ record.data?.entity_label || record.data?.message || 'Notification' }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ record.data?.message }}
                </span>
              </div>
            </template>

            <!-- Type Column -->
            <template v-else-if="column.key === 'type'">
              <Tag :color="getEntityTypeColor(record.data?.entity_type)">
                {{ getEntityTypeLabel(record.data?.entity_type) }}
              </Tag>
            </template>

            <!-- Created At Column -->
            <template v-else-if="column.key === 'created_at'">
              <span class="text-xs text-muted-foreground">
                {{ formatTime(record.created_at) }}
              </span>
            </template>

            <!-- Actions Column -->
            <template v-else-if="column.key === 'actions'">
              <div class="flex items-center justify-end gap-2 whitespace-nowrap">
                <Button
                  v-if="!record.read_at"
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="handleMarkRead(record as BackendNotification)"
                >
                  {{ $t('page.notification.btnMarkRead') || 'Đánh dấu đã đọc' }}
                </Button>
              </div>
            </template>
          </template>
        </Table>
      </Spin>
    </div>
  </div>
</template>
