<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Popover } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { useI18n } from '@vben/locales';
import dayjs from 'dayjs';
import type { BackendNotification } from '#/api/core/notification';

const props = withDefaults(
  defineProps<{
    notifications?: BackendNotification[];
    unreadCount?: number;
  }>(),
  {
    notifications: () => [],
    unreadCount: 0,
  }
);

const emit = defineEmits<{
  (e: 'read', id: string): void;
  (e: 'makeAll'): void;
  (e: 'remove', id: string): void;
  (e: 'viewAll'): void;
}>();

const router = useRouter();
const { t } = useI18n();
const popoverOpen = ref(false);

function getMobileRoute(item: BackendNotification): string {
  const entityType = item.data?.entity_type;

  if (entityType === 'checklist_session') {
    return '/portal/checklist';
  }
  if (entityType === 'maintenance_schedule' || entityType === 'maintenance_item') {
    return '/portal/maintain-plan';
  }
  if (entityType === 'error_log') {
    return '/portal/incident-report';
  }
  if (entityType === 'equipment') {
    return '/portal/equipment';
  }
  return '/portal/dashboard';
}

function handleItemClick(item: BackendNotification) {
  popoverOpen.value = false;
  if (!item.read_at) {
    emit('read', item.id);
  }
  const routePath = getMobileRoute(item);
  router.push(routePath);
}

function handleViewAll() {
  popoverOpen.value = false;
  emit('viewAll');
  router.push('/portal/dashboard');
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <Popover
    v-model:open="popoverOpen"
    placement="bottomRight"
    trigger="click"
    overlay-class-name="mobile-notif-popover"
    :arrow="false"
  >
    <!-- Trigger Icon Button -->
    <div class="relative cursor-pointer p-2 rounded-full text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center">
      <IconifyIcon icon="lucide:bell" class="size-5" />
      <span
        v-if="unreadCount > 0"
        class="absolute top-1 right-1 flex size-2.5 items-center justify-center"
      >
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
        <span class="relative inline-flex size-2 rounded-full bg-rose-500"></span>
      </span>
    </div>

    <!-- Popover Content -->
    <template #content>
      <div class="w-[330px] max-w-[92vw] -m-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl overflow-hidden text-slate-800 dark:text-zinc-100">
        
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50">
          <span class="font-bold text-base text-slate-800 dark:text-zinc-200">
            {{ t('page.portal.notifications') }}
          </span>
        </div>

        <!-- Notification List -->
        <div class="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 scrollbar-thin">
          <template v-if="notifications.length > 0">
            <div
              v-for="item in notifications"
              :key="item.id"
              :class="[
                'flex items-start gap-3 p-3.5 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50',
                !item.read_at ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
              ]"
              @click="handleItemClick(item)"
            >
              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="font-bold text-sm text-slate-800 dark:text-zinc-200 truncate leading-tight">
                    {{ item.data?.entity_label || t('page.portal.systemNotification') }}
                  </span>
                  <span class="text-xs text-slate-400 dark:text-zinc-500 shrink-0">
                    {{ formatDate(item.created_at) }}
                  </span>
                </div>
                <p class="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 m-0 leading-relaxed">
                  {{ item.data?.message || '' }}
                </p>
              </div>

              <!-- Unread dot indicator -->
              <span v-if="!item.read_at" class="size-2.5 rounded-full bg-indigo-600 shrink-0 mt-1"></span>
            </div>
          </template>

          <div v-else class="py-8 flex flex-col items-center justify-center text-slate-400">
            <IconifyIcon icon="lucide:bell-off" class="size-8 mb-2 opacity-50" />
            <span class="text-sm font-medium">{{ t('page.portal.noNotif') }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-2.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-center">
          <button
            type="button"
            class="w-full py-2 rounded-xl text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors border-0 bg-transparent cursor-pointer"
            @click="handleViewAll"
          >
            {{ t('page.portal.viewAllDashboard') }}
          </button>
        </div>

      </div>
    </template>
  </Popover>
</template>

<style scoped>
:deep(.ant-popover-inner) {
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 1rem !important;
}
</style>
