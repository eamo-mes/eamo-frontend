<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Dropdown } from 'ant-design-vue';
import { VbenAvatar } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';
import { useAuthStore } from '#/store';
import { $t } from '#/locales';

const props = withDefaults(
  defineProps<{
    avatar?: string;
  }>(),
  {
    avatar: '/avatar.png',
  }
);

const emit = defineEmits<{
  (e: 'logout'): void;
}>();

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();

onMounted(async () => {
  if (!userStore.userInfo?.realName && !userStore.userInfo?.username) {
    try {
      await authStore.fetchUserInfo();
    } catch (e) {
      console.error('Failed to fetch user info:', e);
    }
  }
});

const userAvatar = computed(() => props.avatar || '/avatar.png');
const displayName = computed(() => 
  userStore.userInfo?.realName || 
  (userStore.userInfo as any)?.name || 
  userStore.userInfo?.username || 
  'User'
);
const displayUsername = computed(() => userStore.userInfo?.username || (userStore.userInfo as any)?.email || '');
const roleTag = computed(() => userStore.userInfo?.roles?.[0]?.toUpperCase() || '');

function handleProfile() {
  router.push('/portal/profile');
}

function handleLogout() {
  emit('logout');
}
</script>

<template>
  <Dropdown placement="bottomRight" :trigger="['click']">
    <!-- Trigger Button using VbenAvatar component -->
    <div class="cursor-pointer rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
      <div class="flex items-center justify-center">
        <VbenAvatar :alt="displayName" :src="userAvatar" class="size-8" dot />
      </div>
    </div>

    <!-- Dropdown Content (Matching Vben 5 Standard Shadcn UserDropdown) -->
    <template #overlay>
      <div class="mobile-user-dropdown-content min-w-60 rounded-xl p-0 pb-1 shadow-lg border border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md overflow-hidden my-1">
        
        <!-- Vben Standard Dropdown Header -->
        <div class="flex items-center p-3 border-b border-slate-100 dark:border-zinc-800">
          <VbenAvatar
            :alt="displayName"
            :src="userAvatar"
            class="size-12"
            dot
            dot-class="bottom-0 right-1 border-2 size-4 bg-green-500"
          />
          <div class="ml-2.5 w-full min-w-0">
            <div class="flex items-center text-sm font-medium text-slate-800 dark:text-zinc-100 truncate">
              <span>{{ displayName }}</span>
              <span v-if="roleTag" class="ml-2 text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
                {{ roleTag }}
              </span>
            </div>
            <div class="text-xs font-normal text-slate-400 dark:text-zinc-500 truncate mt-0.5">
              {{ displayUsername }}
            </div>
          </div>
        </div>

        <!-- Dropdown Menu Actions (Only Profile & Logout) -->
        <div class="p-1 flex flex-col gap-0.5">
          <button 
            @click="handleProfile"
            class="mx-1 flex cursor-pointer items-center rounded-md px-2.5 py-2 leading-6 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border-0 text-left"
          >
            <IconifyIcon icon="lucide:user" class="mr-2 size-4 text-slate-600 dark:text-zinc-300" />
            <span class="flex-1 truncate">{{ $t('page.auth.profile') || 'Trang cá nhân' }}</span>
          </button>

          <div class="my-1 border-t border-slate-100 dark:border-zinc-800"></div>

          <button 
            @click="handleLogout"
            class="mx-1 flex cursor-pointer items-center rounded-md px-2.5 py-2 leading-6 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border-0 text-left"
          >
            <IconifyIcon icon="lucide:log-out" class="mr-2 size-4 text-rose-500" />
            <span class="flex-1 truncate">Đăng xuất</span>
          </button>
        </div>

      </div>
    </template>
  </Dropdown>
</template>

<style scoped>
.mobile-user-dropdown-content {
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
}
</style>
