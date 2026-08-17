import { computed } from 'vue';
import { useUserStore } from '@vben/stores';

/**
 * Reusable RBAC role check helper for UI elements.
 * Hierarchy: admin (level 4) >= manager (level 3) >= engineer (level 2) >= user (level 1)
 */
export function useRoleAccess() {
  const userStore = useUserStore();

  const userRoles = computed<string[]>(() => userStore.userInfo?.roles || []);

  const isAdmin = computed(() => userRoles.value.some((r) => ['admin', 'guest'].includes(r)));
  const isManager = computed(() => userRoles.value.some((r) => ['admin', 'manager', 'guest'].includes(r)));
  const isEngineer = computed(() =>
    userRoles.value.some((r) => ['admin', 'manager', 'engineer', 'guest'].includes(r)),
  );

  const isGuest = computed(() => userRoles.value.includes('guest'));

  return {
    isAdmin,
    isEngineer,
    isGuest,
    isManager,
    userRoles,
  };
}
