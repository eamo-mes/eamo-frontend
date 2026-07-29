<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@vben/locales';
import { useUserStore } from '@vben/stores';
import { useAuthStore } from '#/store';
import { Card, Button, Tag, Spin, Empty, message } from 'ant-design-vue';
import {
  getUserNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  type BackendNotification,
} from '#/api/core/notification';

defineOptions({ name: 'MobilePortalDashboardNotifications' });

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const authStore = useAuthStore();

const loading = ref(false);
const submitting = ref(false);
const notifications = ref<BackendNotification[]>([]);
const filterStatus = ref<'all' | 'unread' | 'read'>('all');

async function getUserId(): Promise<string> {
  let id = userStore.userInfo?.userId || (userStore.userInfo as { id?: string } | null)?.id;
  if (!id) {
    try {
      const info = await authStore.fetchUserInfo();
      id = info?.userId || (info as { id?: string } | null)?.id;
    } catch {
      // ignore
    }
  }
  return id || '';
}

async function fetchNotifications() {
  loading.value = true;
  try {
    const userId = await getUserId();
    if (!userId) {
      notifications.value = [];
      return;
    }

    const params: Record<string, unknown> = {
      page: 1,
      per_page: 50,
    };
    if (filterStatus.value === 'unread') {
      params.unread_only = true;
    }

    const res = await getUserNotificationsApi(userId, params);
    let list = res?.notifications?.data
      ?? (res as { data?: BackendNotification[] })?.data
      ?? (Array.isArray(res) ? res : []);

    if (filterStatus.value === 'read') {
      list = list.filter((item) => item.read_at !== null);
    }

    notifications.value = list;
  } catch (err: unknown) {
    console.error('[MobileNotifications] Error fetching notifications:', err);
    const apiErr = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    message.error(apiErr || t('page.ops.loadError') || 'Không thể tải danh sách thông báo');
  } finally {
    loading.value = false;
  }
}

async function handleMarkRead(item: BackendNotification) {
  try {
    await markNotificationReadApi(item.id);
    item.read_at = new Date().toISOString();
    message.success(t('page.notification.msgMarkReadSuccess') || 'Đã đánh dấu là đã đọc');
  } catch {
    message.error('Lỗi khi cập nhật trạng thái');
  }
}

async function handleMarkAllRead() {
  submitting.value = true;
  try {
    await markAllNotificationsReadApi();
    notifications.value.forEach((n) => {
      n.read_at = new Date().toISOString();
    });
    message.success(t('page.notification.msgMarkAllReadSuccess') || 'Đã đánh dấu tất cả thông báo là đã đọc');
    await fetchNotifications();
  } catch {
    message.error('Lỗi khi cập nhật trạng thái');
  } finally {
    submitting.value = false;
  }
}

function getEntityTypeLabel(entityType?: string): string {
  switch (entityType) {
    case 'checklist_session':
      return t('page.notification.typeChecklistSession') || 'Checklist';
    case 'maintenance_schedule':
      return t('page.notification.typeMaintenanceSchedule') || 'Bảo trì';
    case 'error_log':
      return t('page.notification.typeErrorLog') || 'Lỗi thiết bị';
    case 'maintenance_item':
      return t('page.notification.typeMaintenanceItem') || 'Hạng mục bảo trì';
    default:
      return entityType ? entityType : (t('page.notification.typeSystem') || 'Hệ thống');
  }
}

function getEntityTypeColor(entityType?: string): string {
  switch (entityType) {
    case 'checklist_session':
      return 'blue';
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

function formatTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function handleBack() {
  router.push('/portal');
}

onMounted(() => {
  fetchNotifications();
});

watch(filterStatus, () => {
  fetchNotifications();
});
</script>

<template>
  <div class="p-4 sm:p-6 min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-20">
    <!-- ─── HEADER / ACTION BAR ─── -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button
          type="default"
          size="small"
          class="flex items-center justify-center p-1.5 rounded-lg"
          @click="handleBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <h1 class="text-base font-bold text-slate-800 dark:text-zinc-200 m-0">
          {{ t('page.portal.notifications') || 'Thông báo' }}
        </h1>
      </div>

      <Button
        type="primary"
        size="small"
        class="bg-indigo-600 hover:bg-indigo-700 border-none text-[11px] font-bold h-8 rounded-lg px-2.5"
        :loading="submitting"
        @click="handleMarkAllRead"
      >
        {{ t('page.notification.btnMarkAllRead') || 'Đọc tất cả' }}
      </Button>
    </div>

    <!-- ─── FILTER TABS ─── -->
    <div class="mb-4 flex items-center gap-1.5 p-1 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl shadow-3xs">
      <button
        type="button"
        :class="[
          'flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer outline-none',
          filterStatus === 'all'
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
        ]"
        @click="filterStatus = 'all'"
      >
        {{ t('page.notification.filterAll') || 'Tất cả' }}
      </button>
      <button
        type="button"
        :class="[
          'flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer outline-none',
          filterStatus === 'unread'
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
        ]"
        @click="filterStatus = 'unread'"
      >
        {{ t('page.notification.filterUnread') || 'Chưa đọc' }}
      </button>
      <button
        type="button"
        :class="[
          'flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer outline-none',
          filterStatus === 'read'
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
        ]"
        @click="filterStatus = 'read'"
      >
        {{ t('page.notification.filterRead') || 'Đã đọc' }}
      </button>
    </div>

    <!-- ─── LOADING SPIN ─── -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Spin size="large" />
    </div>

    <!-- ─── NOTIFICATION CARDS LIST ─── -->
    <div v-else-if="notifications.length > 0" class="flex flex-col gap-3.5">
      <Card
        v-for="item in notifications"
        :key="item.id"
        class="rounded-2xl shadow-3xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden"
        :body-style="{ padding: '14px' }"
      >
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-1.5">
            <Tag :color="item.read_at ? 'default' : 'processing'" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md">
              {{ item.read_at ? (t('page.notification.statusRead') || 'Đã đọc') : (t('page.notification.statusUnread') || 'Chưa đọc') }}
            </Tag>
            <Tag :color="getEntityTypeColor(item.data?.entity_type)" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md">
              {{ getEntityTypeLabel(item.data?.entity_type) }}
            </Tag>
          </div>
          <span class="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
            {{ formatTime(item.created_at) }}
          </span>
        </div>

        <div class="space-y-1">
          <h3 class="text-xs font-bold text-slate-800 dark:text-zinc-200 m-0 leading-snug">
            {{ item.data?.entity_label || item.data?.message || 'Thông báo' }}
          </h3>
          <p v-if="item.data?.message" class="text-[11px] text-slate-500 dark:text-zinc-400 m-0 leading-relaxed">
            {{ item.data.message }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80">
          <Button
            v-if="!item.read_at"
            size="small"
            class="text-[11px] h-7 rounded-lg font-bold border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300"
            @click="handleMarkRead(item)"
          >
            {{ t('page.notification.btnMarkRead') || 'Đã đọc' }}
          </Button>
          <Button
            type="primary"
            size="small"
            class="bg-indigo-600 hover:bg-indigo-700 border-none text-[11px] h-7 rounded-lg font-bold"
            @click="navigateToEntity(item)"
          >
            {{ t('page.notification.btnViewDetail') || 'Xem chi tiết' }}
          </Button>
        </div>
      </Card>
    </div>

    <!-- ─── EMPTY STATE ─── -->
    <div v-else class="py-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
      <Empty :description="t('page.notification.empty') || 'Không có thông báo nào.'" />
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-card) {
  margin-bottom: 0 !important;
}
</style>
