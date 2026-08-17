import { computed } from 'vue';
import { useUserStore } from '@vben/stores';

/**
 * Reusable RBAC role check helper for UI elements.
 * Hierarchy: admin (level 4) >= manager (level 3) >= engineer (level 2) >= user (level 1)
 */
export function useRoleAccess() {
  const userStore = useUserStore();

  const userRoles = computed<string[]>(() => userStore.userInfo?.roles || []);

  const isAdmin = computed(() => userRoles.value.includes('admin'));
  const isManager = computed(() => userRoles.value.some((r) => ['admin', 'manager'].includes(r)));
  const isEngineer = computed(() =>
    userRoles.value.some((r) => ['admin', 'manager', 'engineer'].includes(r)),
  );

  const isGuest = computed(() =>
    userRoles.value.includes('guest') || (!isAdmin.value && !isManager.value && !isEngineer.value),
  );

  return {
    isAdmin,
    isEngineer,
    isGuest,
    isManager,
    userRoles,
  };
}
