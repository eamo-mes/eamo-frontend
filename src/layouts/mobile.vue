<script lang="ts" setup>
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Drawer, Modal, Input, message, Avatar } from "ant-design-vue";
import { useUserStore, useAccessStore } from "@vben/stores";
import { usePreferences, updatePreferences } from "@vben/preferences";
import MobileUserDropdown from "#/views/mobile/components/MobileUserDropdown.vue";
import MobileNotificationDropdown from "#/views/mobile/components/MobileNotificationDropdown.vue";
import { VbenIconButton } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { $t } from "#/locales";
import { useI18n, loadLocaleMessages } from "@vben/locales";
import { useAuthStore } from "#/store";
import {
  getUserNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  type BackendNotification,
} from "#/api/core/notification";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const accessStore = useAccessStore();
const authStore = useAuthStore();
const { isDark } = usePreferences();
const { locale, t } = useI18n();

async function changeLang(lang: "zh-CN" | "en-US") {
  if (locale.value === lang) return;
  const hide = message.loading({
    content:
      lang === "zh-CN" ? "Đang chuyển ngôn ngữ..." : "Switching language...",
    key: "lang",
    duration: 0,
  });
  try {
    updatePreferences({ app: { locale: lang } });
    await loadLocaleMessages(lang);
  } catch (e) {
    console.error("Failed to change language:", e);
  } finally {
    hide();
  }
}

// Helper functions for Vben Menu Record properties compatibility
function getMenuTitle(item: any): string {
  if (!item) return "";
  const title = item.title ?? item.meta?.title ?? item.name ?? "";
  return typeof title === "function" ? title() : String(title);
}

function getMenuIcon(item: any, fallback = "lucide:file-text"): string {
  if (!item) return fallback;
  const icon = item.icon ?? item.meta?.icon;
  return typeof icon === "string" ? icon : fallback;
}

function isHideInMenu(item: any): boolean {
  if (!item) return false;
  return Boolean(item.hideInMenu ?? item.meta?.hideInMenu);
}

// State controls
const drawerVisible = ref(false);
const searchModalVisible = ref(false);
const searchQuery = ref("");
const isRefreshing = ref(false);
const floatMenuOpen = ref(false);

const floatMenuItems = computed(() => [
  {
    title: t("page.portal.title") || "Trang chủ",
    path: "/portal",
    icon: "lucide:home",
    color: "bg-slate-600 text-white hover:bg-slate-700 shadow-slate-500/25",
    exact: true,
  },
  {
    title: t("page.portal.errorHandling") || "Xử lý lỗi",
    path: "/portal/incident-report",
    icon: "lucide:qr-code",
    color: "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/25",
    exact: false,
  },
  {
    title: t("page.portal.equipment") || "Thiết bị",
    path: "/portal/equipment",
    icon: "lucide:wrench",
    color: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/25",
    exact: false,
  },
  {
    title: t("page.portal.notifications") || "Thông báo",
    path: "/portal/dashboard",
    icon: "lucide:bell",
    color: "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-500/25",
    exact: false,
  },
  {
    title: t("page.portal.errorHandling") || "Xử lý lỗi",
    path: "/portal/incident-report",
    icon: "lucide:qr-code",
    color: "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/25",
    exact: false,
  },
  {
    title: t("page.portal.checklist") || "Checklist",
    path: "/portal/checklist",
    icon: "lucide:clipboard-check",
    color: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/25",
    exact: false,
  },
  {
    title: t("page.portal.mPlans") || "Kế hoạch bảo trì",
    path: "/portal/maintain-plan",
    icon: "lucide:calendar-clock",
    color: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/25",
    exact: false,
  },
]);

// Expanded menu groups state
const expandedKeys = ref<Record<string, boolean>>({});

function toggleExpand(key: string) {
  expandedKeys.value[key] = !expandedKeys.value[key];
}

// Dynamic menus loaded from Web Admin accessStore
const webAdminMenus = computed(() => {
  const menus: any[] = accessStore.accessMenus || [];
  return menus.filter((item) => !isHideInMenu(item));
});

// Auto expand active menu parent when drawer opens
watch(drawerVisible, (val) => {
  if (val) {
    webAdminMenus.value.forEach((item) => {
      if (
        item.children &&
        item.children.some((child: any) => route.path.startsWith(child.path))
      ) {
        expandedKeys.value[item.path] = true;
      }
    });
  }
});

// Notification State
const notifications = ref<BackendNotification[]>([]);
const unreadCount = ref(0);
let pollInterval: any = null;

async function fetchNotifications() {
  const userId = userStore.userInfo?.userId;
  if (!userId) return;

  try {
    const res = await getUserNotificationsApi(userId);
    notifications.value = res.notifications?.data ?? [];
    unreadCount.value = res.unread_count ?? 0;
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
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
  { immediate: true },
);

// Floating Draggable Position & Gesture State
const floatPos = ref({ x: 0, y: 0 });
const isInitializedPos = ref(false);
const isDraggingFloat = ref(false);
const windowWidth = ref(
  typeof window !== "undefined" ? window.innerWidth : 375,
);
const windowHeight = ref(
  typeof window !== "undefined" ? window.innerHeight : 667,
);

let dragStart = { x: 0, y: 0 };
let initialFloatPos = { x: 0, y: 0 };
let isDragging = false;   // did user actually move?
let pointerMoved = false; // tracks movement within current gesture

function initFloatPos() {
  if (typeof window !== "undefined") {
    windowWidth.value = window.innerWidth;
    windowHeight.value = window.innerHeight;
    if (!isInitializedPos.value) {
      const btnSize = 52;
      floatPos.value = {
        x: window.innerWidth - btnSize - 20,
        y: window.innerHeight - btnSize - 28,
      };
      isInitializedPos.value = true;
    }
  }
}

function handleResize() {
  if (typeof window === "undefined") return;
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
  const btnSize = 52;
  const maxX = window.innerWidth - btnSize - 12;
  const maxY = window.innerHeight - btnSize - 12;
  floatPos.value.x = Math.max(12, Math.min(maxX, floatPos.value.x));
  floatPos.value.y = Math.max(12, Math.min(maxY, floatPos.value.y));
}

function startDrag(e: PointerEvent) {
  // capture pointer so we get move/up even outside element
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

  dragStart = { x: e.clientX, y: e.clientY };
  initialFloatPos = { ...floatPos.value };
  isDragging = false;
  pointerMoved = false;
  isDraggingFloat.value = false;

  window.addEventListener("pointermove", onDrag);
  window.addEventListener("pointerup", stopDrag, { once: true });
  window.addEventListener("pointercancel", stopDrag, { once: true });
}

function onDrag(e: PointerEvent) {
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;

  if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
    isDragging = true;
    pointerMoved = true;
    isDraggingFloat.value = true;
  }

  if (isDragging) {
    if (e.cancelable) e.preventDefault();
    const btnSize = 52;
    const maxX = window.innerWidth - btnSize - 12;
    const maxY = window.innerHeight - btnSize - 12;
    floatPos.value = {
      x: Math.max(12, Math.min(maxX, initialFloatPos.x + dx)),
      y: Math.max(12, Math.min(maxY, initialFloatPos.y + dy)),
    };
  }
}

function stopDrag() {
  window.removeEventListener("pointermove", onDrag);
  isDraggingFloat.value = false;
  isDragging = false;
  // pointerMoved stays true until click handler reads it
}

function handleFloatBtnClick() {
  if (pointerMoved) {
    pointerMoved = false;
    return; // was a drag, ignore click
  }
  floatMenuOpen.value = !floatMenuOpen.value;
}

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleResize);
  }
});

onMounted(() => {
  initFloatPos();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleResize);
  }
  if (!userStore.userInfo?.realName && !userStore.userInfo?.username) {
    authStore.fetchUserInfo().catch(() => {});
  }
});

const showDot = computed(() => unreadCount.value > 0);

const avatar = computed(() => {
  return "/avatar.png";
});

// User Actions
async function handleLogout() {
  await authStore.logout(false);
}

function handleReload() {
  isRefreshing.value = true;
  message.loading({
    content: t("page.portal.reloading") || "Đang tải lại...",
    key: "reload",
    duration: 0.5,
  });
  setTimeout(() => {
    isRefreshing.value = false;
    window.location.reload();
  }, 400);
}

function toggleTheme() {
  updatePreferences({
    theme: {
      mode: isDark.value ? "light" : "dark",
    },
  });
}

function handleNavigate(path: string) {
  drawerVisible.value = false;
  searchModalVisible.value = false;
  floatMenuOpen.value = false;
  router.push(path);
}

// Search System Pages dynamically built from webAdminMenus
const searchItems = computed(() => {
  const list: {
    title: string;
    path: string;
    icon?: string;
    category: string;
  }[] = [
    {
      title: t("page.portal.homeTitle") || "Trang chủ Mobile Portal",
      path: "/portal",
      icon: "lucide:smartphone",
      category: "Mobile",
    },
  ];
  webAdminMenus.value.forEach((menu) => {
    const parentTitle = getMenuTitle(menu);
    if (menu.children && menu.children.length > 0) {
      menu.children.forEach((child: any) => {
        if (!isHideInMenu(child)) {
          const childTitle = getMenuTitle(child);
          list.push({
            title: childTitle,
            path: child.path,
            icon: getMenuIcon(child),
            category: parentTitle,
          });
        }
      });
    } else {
      list.push({
        title: parentTitle,
        path: menu.path,
        icon: getMenuIcon(menu),
        category: "Hệ thống",
      });
    }
  });
  return list;
});

const filteredSearchItems = computed(() => {
  if (!searchQuery.value.trim()) return searchItems.value;
  const q = searchQuery.value.toLowerCase();
  return searchItems.value.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q),
  );
});

// Notifications Handlers
async function markRead(id: string) {
  const item = notifications.value.find((item) => item.id === id);
  if (item && !item.read_at) {
    try {
      await markNotificationReadApi(String(id));
      item.read_at = new Date().toISOString();
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
  }
}

async function handleMakeAll() {
  try {
    await markAllNotificationsReadApi();
    notifications.value.forEach((item) => (item.read_at = new Date().toISOString()));
    unreadCount.value = 0;
  } catch (e) {
    console.error("Failed to mark all as read:", e);
  }
}
</script>

<template>
  <div
    class="mobile-layout min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 transition-colors duration-300"
  >
    <!-- Top Mobile Header Navigation -->
    <header
      class="sticky top-0 z-40 h-14 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 px-3 flex items-center justify-between shadow-2xs"
    >
      <!-- Left: Back Button & Open Sidebar Drawer Button -->
      <div class="flex items-center gap-1">
        <VbenIconButton class="text-foreground" @click="drawerVisible = true">
          <IconifyIcon icon="lucide:menu" class="size-4" />
        </VbenIconButton>
      </div>

      <!-- Right Action Icons -->
      <div class="flex items-center gap-1 sm:gap-2">
        <!-- Search Button -->
        <VbenIconButton
          class="text-foreground"
          @click="searchModalVisible = true"
        >
          <IconifyIcon icon="lucide:search" class="size-4" />
        </VbenIconButton>

        <!-- Mobile Notification Dropdown -->
        <MobileNotificationDropdown
          :notifications="notifications"
          :unread-count="unreadCount"
          @read="(id) => markRead(id)"
          @make-all="handleMakeAll"
          @view-all="() => handleNavigate('/portal/dashboard')"
        />

        <!-- Reload / Refresh Page Button -->
        <VbenIconButton
          class="text-foreground"
          :class="{ 'animate-spin': isRefreshing }"
          @click="handleReload"
        >
          <IconifyIcon icon="lucide:rotate-cw" class="size-4" />
        </VbenIconButton>

        <!-- MobileUserDropdown -->
        <MobileUserDropdown :avatar="avatar" @logout="handleLogout" />
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
      <div
        class="flex flex-col h-full bg-slate-900 text-slate-100 p-4 -m-6 min-h-screen"
      >
        <!-- User Info Header -->
        <div
          class="flex items-center gap-3 p-3 bg-slate-800/80 rounded-2xl border border-slate-700/50 mb-4"
        >
          <Avatar
            src="/avatar.png"
            :size="42"
            class="border border-indigo-400/40"
          />
          <div class="flex flex-col min-w-0">
            <span class="font-bold text-sm text-slate-100 truncate">{{
              userStore.userInfo?.realName || userStore.userInfo?.username
            }}</span>
          </div>
        </div>

        <div class="my-2 border-t border-slate-800/80"></div>

        <!-- Mobile Sidebar Navigation Items -->
        <div class="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
          <!-- 1. Home / Portal Landing -->
          <button
            @click="handleNavigate('/portal')"
            :class="[
              route.path === '/portal'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon icon="lucide:home" class="text-base flex-shrink-0" />
            <span class="flex-1 truncate">{{ t("page.portal.title") }}</span>
          </button>

          <!-- 2. Xử lý lỗi -->
          <button
            @click="handleNavigate('/portal/incident-report')"
            :class="[
              route.path.startsWith('/portal/incident-report')
                ? 'bg-rose-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon icon="lucide:qr-code" class="text-base flex-shrink-0 text-rose-400" />
            <span class="flex-1 truncate">{{
              t("page.portal.errorHandling") || "Xử lý lỗi"
            }}</span>
          </button>

          <!-- 3. Equipment -->
          <button
            @click="handleNavigate('/portal/equipment')"
            :class="[
              route.path.startsWith('/portal/equipment')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon icon="lucide:wrench" class="text-base flex-shrink-0" />
            <span class="flex-1 truncate">{{
              t("page.portal.equipment")
            }}</span>
          </button>

          <!-- 3. Notifications (Dashboard) -->
          <button
            @click="handleNavigate('/portal/dashboard')"
            :class="[
              route.path.startsWith('/portal/dashboard')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon icon="lucide:bell" class="text-base flex-shrink-0" />
            <span class="flex-1 truncate">{{
              t("page.portal.notifications")
            }}</span>
          </button>

          <!-- 4. Checklist -->
          <button
            @click="handleNavigate('/portal/checklist')"
            :class="[
              route.path.startsWith('/portal/checklist')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon
              icon="lucide:clipboard-check"
              class="text-base flex-shrink-0"
            />
            <span class="flex-1 truncate">{{
              t("page.portal.checklist") || "Checklist"
            }}</span>
          </button>

          <!-- 5. Maintenance Plans -->
          <button
            @click="handleNavigate('/portal/maintain-plan')"
            :class="[
              route.path.startsWith('/portal/maintain-plan')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon
              icon="lucide:calendar-clock"
              class="text-base flex-shrink-0"
            />
            <span class="flex-1 truncate">{{
              t("page.portal.mPlans") || "Kế hoạch bảo trì"
            }}</span>
          </button>

          <!-- Divider line separating quick actions -->
          <div class="my-2 border-t border-slate-800/80"></div>

          <!-- 7. Report Incident -->
          <button
            @click="handleNavigate('/portal/incident-report')"
            :class="[
              route.path.startsWith('/portal/incident-report')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon icon="lucide:alert-triangle" class="text-base flex-shrink-0 text-indigo-400" />
            <span class="flex-1 truncate">{{
              t("page.portal.reportIncident") || "Báo cáo sự cố"
            }}</span>
          </button>

          <!-- 7. Emergency Stop -->
          <button
            @click="handleNavigate('/portal/emergency-stop')"
            :class="[
              route.path.startsWith('/portal/emergency-stop')
                ? 'bg-rose-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80',
            ]"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
          >
            <IconifyIcon icon="lucide:square" class="text-base flex-shrink-0 text-rose-400" />
            <span class="flex-1 truncate">{{
              t("page.portal.emergencyStop") || "Dừng khẩn cấp"
            }}</span>
          </button>

          <div class="my-2 border-t border-slate-800/80"></div>

          <!-- Dynamic Web Admin Menus -->
          <div
            v-for="menu in webAdminMenus"
            :key="menu.path"
            class="flex flex-col gap-0.5"
          >
            <!-- Parent Menu with Children -->
            <template v-if="menu.children && menu.children.length > 0">
              <div
                @click="toggleExpand(menu.path)"
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <IconifyIcon
                    :icon="getMenuIcon(menu, 'lucide:folder')"
                    class="text-base flex-shrink-0 text-indigo-400"
                  />
                  <span class="truncate">{{ getMenuTitle(menu) }}</span>
                </div>
                <IconifyIcon
                  icon="lucide:chevron-down"
                  :class="{ 'rotate-180': expandedKeys[menu.path] }"
                  class="text-xs transition-transform duration-200 flex-shrink-0 opacity-70"
                />
              </div>

              <!-- Collapsible Sub-menu items -->
              <div
                v-show="expandedKeys[menu.path]"
                class="flex flex-col gap-0.5 pl-3.5 ml-2 border-l border-slate-800 my-0.5"
              >
                <button
                  v-for="child in menu.children.filter(
                    (c: any) => !isHideInMenu(c),
                  )"
                  :key="child.path"
                  @click="handleNavigate(child.path)"
                  :class="[
                    route.path === child.path
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80',
                  ]"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer border-0 text-left"
                >
                  <IconifyIcon
                    :icon="getMenuIcon(child, 'lucide:file-text')"
                    class="text-sm flex-shrink-0"
                  />
                  <span class="truncate">{{ getMenuTitle(child) }}</span>
                </button>
              </div>
            </template>

            <!-- Single Menu Item (No Children) -->
            <template v-else>
              <button
                @click="handleNavigate(menu.path)"
                :class="[
                  route.path === menu.path
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-800/80',
                ]"
                class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0 text-left"
              >
                <IconifyIcon
                  :icon="getMenuIcon(menu, 'lucide:file-text')"
                  class="text-base flex-shrink-0"
                />
                <span class="truncate">{{ getMenuTitle(menu) }}</span>
              </button>
            </template>
          </div>
        </div>

        <!-- Sidebar Footer Controls (Language, Theme & Logout) -->
        <div class="pt-4 border-t border-slate-800 flex flex-col gap-2">
          <!-- Language Switcher -->
          <div class="flex items-center gap-1 p-1 bg-slate-800/80 rounded-xl">
            <button
              @click="changeLang('zh-CN')"
              :class="[
                locale === 'zh-CN'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200',
              ]"
              class="flex-1 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer border-0 outline-none"
            >
              VI
            </button>
            <button
              @click="changeLang('en-US')"
              :class="[
                locale === 'en-US'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200',
              ]"
              class="flex-1 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer border-0 outline-none"
            >
              EN
            </button>
          </div>

          <!-- Theme & Logout Row -->
          <div class="flex items-center gap-2">
            <button
              @click="toggleTheme"
              class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer border-0"
            >
              <IconifyIcon
                :icon="isDark ? 'lucide:sun' : 'lucide:moon'"
                class="text-base"
              />
              <span>{{
                isDark
                  ? t("page.portal.lightMode") || "Sáng"
                  : t("page.portal.darkMode") || "Tối"
              }}</span>
            </button>

            <VbenIconButton
              class="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
              @click="handleLogout"
            >
              <IconifyIcon icon="lucide:log-out" class="size-4" />
            </VbenIconButton>
          </div>
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
          :placeholder="
            t('page.portal.searchAllPlaceholder') ||
            'Tìm kiếm trang, thiết bị...'
          "
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
              <IconifyIcon
                :icon="item.icon || 'lucide:file-text'"
                class="text-base text-indigo-500"
              />
              <span
                class="text-xs font-semibold text-slate-800 dark:text-zinc-200"
                >{{ item.title }}</span
              >
            </div>
            <span
              class="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 rounded-md"
              >{{ item.category }}</span
            >
          </div>
        </div>
      </div>
    </Modal>

    <!-- Floating Quick Navigation Speed Dial (||| Icon) -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="floatMenuOpen"
        class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs"
        @click="floatMenuOpen = false"
      />
    </Transition>

    <div
      class="fixed z-50 select-none touch-none"
      :style="{ left: `${floatPos.x}px`, top: `${floatPos.y}px` }"
    >
      <!-- Expanded Sub-Buttons relative to current position -->
      <TransitionGroup
        tag="div"
        :class="[
          'absolute flex flex-col gap-2.5 transition-all duration-200',
          floatPos.y > windowHeight / 2 ? 'bottom-full mb-3' : 'top-full mt-3',
          floatPos.x > windowWidth / 2
            ? 'right-0 items-end'
            : 'left-0 items-start',
        ]"
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-3 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-3 scale-95"
      >
        <template v-if="floatMenuOpen">
          <div
            v-for="(item, idx) in floatMenuItems"
            :key="item.path"
            :style="{ transitionDelay: `${idx * 30}ms` }"
            @click="handleNavigate(item.path)"
            :class="[
              'flex items-center gap-2.5 cursor-pointer group',
              floatPos.x > windowWidth / 2 ? 'flex-row' : 'flex-row-reverse',
            ]"
          >
            <!-- Label Pill -->
            <span
              class="px-3 py-1 rounded-xl text-xs font-semibold shadow-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700/80 whitespace-nowrap transition-transform duration-150 group-active:scale-95"
            >
              {{ item.title }}
            </span>

            <!-- Circular Icon Button -->
            <button
              type="button"
              :class="[
                (item.exact ? route.path === item.path : route.path.startsWith(item.path))
                  ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-transparent scale-110'
                  : 'hover:scale-105',
                item.color,
              ]"
              class="size-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 cursor-pointer border-0 outline-none active:scale-95"
            >
              <IconifyIcon :icon="item.icon" class="size-5" />
            </button>
          </div>
        </template>
      </TransitionGroup>

      <!-- Main Floating Trigger Button (Draggable FAB) -->
      <button
        type="button"
        :class="[
          floatMenuOpen
            ? 'bg-slate-700 dark:bg-zinc-600 rotate-45'
            : 'bg-indigo-600 hover:bg-indigo-500',
          isDraggingFloat ? 'scale-90 shadow-md' : 'shadow-xl hover:shadow-indigo-500/40',
        ]"
        class="size-13 rounded-full flex items-center justify-center border-0 outline-none cursor-pointer transition-all duration-200 active:scale-90"
        @pointerdown="startDrag"
        @click="handleFloatBtnClick"
      >
        <IconifyIcon
          :icon="floatMenuOpen ? 'lucide:x' : 'lucide:navigation'"
          class="size-5 text-white transition-all duration-200"
        />
      </button>
    </div>
  </div>
</template>
