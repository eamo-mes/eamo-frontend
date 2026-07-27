<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { onUnmounted } from 'vue';
import {
  getUserNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '#/api/core/notification';

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();

const notifications = ref<NotificationItem[]>([]);
const unreadCount = ref(0);
let pollInterval: any = null;

function mapNotification(item: any): NotificationItem {
  const avatar = '/avatar.png';
  const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : '';

  return {
    id: item.id,
    avatar,
    date: dateStr,
    isRead: item.read_at !== null,
    message: item.data?.message ?? '',
    title: item.data?.entity_label ?? 'Notification',
  };
}

async function fetchNotifications() {
  const userId = userStore.userInfo?.userId;
  if (!userId) return;

  try {
    const res = await getUserNotificationsApi(userId);
    notifications.value = (res.notifications?.data ?? []).map(mapNotification);
    unreadCount.value = res.unread_count ?? 0;
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
  }
}

watch(
  () => userStore.userInfo?.userId,
  (newUserId) => {
    if (newUserId) {
      fetchNotifications();
      if (!pollInterval) {
        pollInterval = setInterval(fetchNotifications, 30000);
      }
    } else {
      notifications.value = [];
      unreadCount.value = 0;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});

const showDot = computed(() => unreadCount.value > 0);

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
]);

const avatar = computed(() => {
  return '/avatar.png';
});

async function handleLogout() {
  await authStore.logout(false);
}

function handleNoticeClear() {
  notifications.value = [];
}

async function markRead(id: number | string) {
  const item = notifications.value.find((item) => item.id === id);
  if (item && !item.isRead) {
    try {
      await markNotificationReadApi(String(id));
      item.isRead = true;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  }
}

function remove(id: number | string) {
  notifications.value = notifications.value.filter((item) => item.id !== id);
}

async function handleMakeAll() {
  try {
    await markAllNotificationsReadApi();
    notifications.value.forEach((item) => (item.isRead = true));
    unreadCount.value = 0;
  } catch (e) {
    console.error('Failed to mark all as read:', e);
  }
}

const viewAll = () => {
  router.push('/notifications');
};

const handleClick = (item: NotificationItem) => {
  // 如果通知项有链接，点击时跳转
  if (item.link) {
    navigateTo(item.link, item.query, item.state);
  }
};

function navigateTo(
  link: string,
  query?: Record<string, any>,
  state?: Record<string, any>,
) {
  if (link.startsWith('http://') || link.startsWith('https://')) {
    // 外部链接，在新标签页打开
    window.open(link, '_blank');
  } else {
    // 内部路由链接，支持 query 参数和 state
    router.push({
      path: link,
      query: query || {},
      state,
    });
  }
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => accessStore.loginExpired,
  (expired) => {
    if (expired) {
      handleLogout();
    }
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        :description="userStore.userInfo?.username"
        :tag-text="userStore.userInfo?.roles?.[0]?.toUpperCase()"
        @logout="handleLogout"
        @clear-preferences-and-logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @on-click="handleClick"
        @view-all="viewAll"
      />
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
