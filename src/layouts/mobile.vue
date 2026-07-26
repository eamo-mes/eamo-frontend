<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';
import { computed, ref, watch, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { 
  Drawer, 
  Modal, 
  Input, 
  message 
} from 'ant-design-vue';
import { useUserStore, useAccessStore } from '@vben/stores';
import { preferences, usePreferences, updatePreferences } from '@vben/preferences';
import { Notification, UserDropdown } from '@vben/layouts';
import { IconifyIcon } from '@vben/icons';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import {
  getUserNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '#/api/core/notification';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const accessStore = useAccessStore();
const authStore = useAuthStore();
const { isDark } = usePreferences();

// Helper functions for Vben Menu Record properties compatibility
function getMenuTitle(item: any): string {
  if (!item) return '';
  const title = item.title ?? item.meta?.title ?? item.name ?? '';
  return typeof title === 'function' ? title() : String(title);
}

function getMenuIcon(item: any, fallback = 'lucide:file-text'): string {
  if (!item) return fallback;
  const icon = item.icon ?? item.meta?.icon;
  return typeof icon === 'string' ? icon : fallback;
}

function isHideInMenu(item: any): boolean {
  if (!item) return false;
  return Boolean(item.hideInMenu ?? item.meta?.hideInMenu);
}

// State controls
const drawerVisible = ref(false);
const searchModalVisible = ref(false);
const searchQuery = ref('');
const isRefreshing = ref(false);

// Expanded menu groups state
const expandedKeys = ref<Record<string, boolean>>({});

function toggleExpand(key: string) {
  expandedKeys.value[key] = !expandedKeys.value[key];
}

// Dynamic menus loaded from Web Admin accessStore
const webAdminMenus = computed(() => {
  const menus: any[] = accessStore.accessMenus || [];
  return menus.filter(item => !isHideInMenu(item));
});

// Auto expand active menu parent when drawer opens
watch(drawerVisible, (val) => {
  if (val) {
    webAdminMenus.value.forEach(item => {
      if (item.children && item.children.some((child: any) => route.path.startsWith(child.path))) {
        expandedKeys.value[item.path] = true;
      }
    });
  }
});

// Notification State
const notifications = ref<NotificationItem[]>([]);
const unreadCount = ref(0);
let pollInterval: any = null;

function mapNotification(item: any): NotificationItem {
  let avatar = '/avatar.png';
  const entityType = item.data?.entity_type;
  
  if (entityType === 'checklist_session') {
    avatar = 'https://avatar.vercel.sh/checklist.svg?text=CL';
  } else if (entityType === 'maintenance_schedule') {
    avatar = 'https://avatar.vercel.sh/maintenance.svg?text=MS';
  } else if (entityType === 'error_log') {
    avatar = 'https://avatar.vercel.sh/error.svg?text=EL';
  } else if (entityType === 'maintenance_item') {
    avatar = 'https://avatar.vercel.sh/item.svg?text=MI';
  }

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

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

const userMenus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile') || 'Trang cá nhân',
  },
]);

// User Actions
async function handleLogout() {
  await authStore.logout(false);
}

function handleReload() {
  isRefreshing.value = true;
  message.loading({ content: 'Đang tải lại...', key: 'reload', duration: 0.5 });
  setTimeout(() => {
    isRefreshing.value = false;
    window.location.reload();
  }, 400);
}

function toggleTheme() {
  updatePreferences({
    theme: {
      mode: isDark.value ? 'light' : 'dark',
    },
  });
}

function handleNavigate(path: string) {
  drawerVisible.value = false;
  searchModalVisible.value = false;
  router.push(path);
}

// Search System Pages dynamically built from webAdminMenus
const searchItems = computed(() => {
  const list: { title: string; path: string; icon?: string; category: string }[] = [
    { title: 'Trang chủ Mobile Portal', path: '/portal', icon: 'lucide:smartphone', category: 'Mobile' }
  ];
  webAdminMenus.value.forEach(menu => {
    const parentTitle = getMenuTitle(menu);
    if (menu.children && menu.children.length > 0) {
      menu.children.forEach((child: any) => {
        if (!isHideInMenu(child)) {
          const childTitle = getMenuTitle(child);
          list.push({
            title: childTitle,
            path: child.path,
            icon: getMenuIcon(child),
            category: parentTitle
          });
        }
      });
    } else {
      list.push({
        title: parentTitle,
        path: menu.path,
        icon: getMenuIcon(menu),
        category: 'Hệ thống'
      });
    }
  });
  return list;
});

const filteredSearchItems = computed(() => {
  if (!searchQuery.value.trim()) return searchItems.value;
  const q = searchQuery.value.toLowerCase();
  return searchItems.value.filter(item => 
    item.title.toLowerCase().includes(q) || 
    item.category.toLowerCase().includes(q)
  );
});

// Notifications Handlers
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

function handleNotificationClick(item: NotificationItem) {
  if (item.link) {
    router.push(item.link);
  }
}
</script>

<template>
  <div class="mobile-layout min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
    
    <!-- Top Mobile Header Navigation -->
    <header class="sticky top-0 z-40 h-14 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 px-3 flex items-center justify-between shadow-2xs">
      
      <!-- Left: Open Sidebar Drawer Button & Logo -->
      <div class="flex items-center gap-2.5">
        <button 
          @click="drawerVisible = true"
          class="p-2 rounded-xl text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
          aria-label="Open Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu">
            <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Right Action Icons -->
      <div class="flex items-center gap-1 sm:gap-2">
        
        <!-- Search Button -->
        <button 
          @click="searchModalVisible = true"
          class="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </button>

        <!-- Notification -->
        <Notification
          :dot="showDot"
          :notifications="notifications"
          @clear="handleNoticeClear"
          @read="(item) => item.id && markRead(item.id)"
          @remove="(item) => item.id && remove(item.id)"
          @make-all="handleMakeAll"
          @on-click="handleNotificationClick"
          @view-all="() => handleNavigate('/notifications')"
        />

        <!-- Reload / Refresh Page Button -->
        <button 
          @click="handleReload"
          :class="{ 'animate-spin': isRefreshing }"
          class="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-cw">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
          </svg>
        </button>

        <!-- UserDropdown -->
        <UserDropdown
          :avatar="avatar"
          :menus="userMenus"
          :text="userStore.userInfo?.realName"
          :description="userStore.userInfo?.username"
          :tag-text="userStore.userInfo?.roles?.[0]?.toUpperCase()"
          @logout="handleLogout"
          @clear-preferences-and-logout="handleLogout"
        />

      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 w-full relative">
      <RouterView />
    </main>

    <!-- Slide-out Sidebar Drawer Menu -->
    <Drawer 
      v-model:open="drawerVisible" 
      placement="left" 
      width="295px"
      :closable="false"
      class="mobile-sidebar-drawer"
    >
      <div class="flex flex-col h-full bg-slate-900 text-slate-100 p-4 -m-6 min-h-screen">
        
        <!-- User Info Header -->
        <div class="flex items-center gap-3 p-3 bg-slate-800/80 rounded-2xl border border-slate-700/50 mb-4">
          <Avatar :src="avatar" :size="42" class="border border-indigo-400/40" />
          <div class="flex flex-col min-w-0">
            <span class="font-bold text-sm text-slate-100 truncate">{{ userStore.userInfo?.realName || userStore.userInfo?.username }}</span>
            <span class="text-[11px] text-slate-400 truncate">{{ userStore.userInfo?.roles?.[0] || 'User' }}</span>
          </div>
        </div>

        <!-- Mobile Sidebar Navigation Items -->
        <div class="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
          
          <!-- Home Mobile Portal Link -->
          <button 
            @click="handleNavigate('/portal')"
            :class="[route.path === '/portal' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:bg-slate-800/80']"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left mb-1"
          >
            <IconifyIcon icon="lucide:smartphone" class="text-base flex-shrink-0" />
            <span class="flex-1 truncate">Trang chủ Mobile</span>
          </button>

          <div class="my-1 border-t border-slate-800/80"></div>

          <!-- Dynamic Web Admin Menus -->
          <div v-for="menu in webAdminMenus" :key="menu.path" class="flex flex-col gap-0.5">
            
            <!-- Parent Menu with Children -->
            <template v-if="menu.children && menu.children.length > 0">
              <div 
                @click="toggleExpand(menu.path)"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <IconifyIcon :icon="getMenuIcon(menu, 'lucide:folder')" class="text-base flex-shrink-0 text-indigo-400" />
                  <span class="truncate">{{ getMenuTitle(menu) }}</span>
                </div>
                <IconifyIcon 
                  icon="lucide:chevron-down" 
                  :class="{ 'rotate-180': expandedKeys[menu.path] }"
                  class="text-xs transition-transform duration-200 flex-shrink-0 opacity-70"
                />
              </div>

              <!-- Collapsible Sub-menu items -->
              <div v-show="expandedKeys[menu.path]" class="flex flex-col gap-0.5 pl-3.5 ml-2 border-l border-slate-800 my-0.5">
                <button 
                  v-for="child in menu.children.filter((c: any) => !isHideInMenu(c))" 
                  :key="child.path"
                  @click="handleNavigate(child.path)"
                  :class="[route.path === child.path ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800/80']"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer border-0 text-left"
                >
                  <IconifyIcon :icon="getMenuIcon(child, 'lucide:file-text')" class="text-sm flex-shrink-0" />
                  <span class="truncate">{{ getMenuTitle(child) }}</span>
                </button>
              </div>
            </template>

            <!-- Single Menu Item (No Children) -->
            <template v-else>
              <button 
                @click="handleNavigate(menu.path)"
                :class="[route.path === menu.path ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800/80']"
                class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
              >
                <IconifyIcon :icon="getMenuIcon(menu, 'lucide:file-text')" class="text-base flex-shrink-0" />
                <span class="truncate">{{ getMenuTitle(menu) }}</span>
              </button>
            </template>

          </div>

        </div>

        <!-- Sidebar Footer Controls (Theme & Logout) -->
        <div class="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <button 
            @click="toggleTheme" 
            class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer border-0"
          >
            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            <span>{{ isDark ? 'Giao diện Sáng' : 'Giao diện Tối' }}</span>
          </button>

          <button 
            @click="handleLogout" 
            class="flex items-center justify-center p-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors cursor-pointer border-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>

      </div>
    </Drawer>

    <!-- Search Modal -->
    <Modal 
      v-model:open="searchModalVisible" 
      :footer="null" 
      :closable="false"
      centered
      width="90%"
    >
      <div class="py-2">
        <Input 
          v-model:value="searchQuery" 
          placeholder="Tìm kiếm trang, thiết bị, bài kiểm tra..." 
          allow-clear 
          autofocus
          class="rounded-xl py-2 mb-4"
        />
        <div class="max-h-[300px] overflow-y-auto flex flex-col gap-1.5">
          <div 
            v-for="item in filteredSearchItems" 
            :key="item.path" 
            @click="handleNavigate(item.path)"
            class="p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-zinc-800/80 flex items-center justify-between cursor-pointer transition-colors"
          >
            <div class="flex items-center gap-2">
              <IconifyIcon :icon="item.icon || 'lucide:file-text'" class="text-base text-indigo-500" />
              <span class="text-xs font-semibold text-slate-800 dark:text-zinc-200">{{ item.title }}</span>
            </div>
            <span class="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 rounded-md">{{ item.category }}</span>
          </div>
        </div>
      </div>
    </Modal>

  </div>
</template>
