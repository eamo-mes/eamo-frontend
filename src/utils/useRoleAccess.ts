import { computed } from 'vue';
import { useUserStore } from '@vben/stores';

/**
 * Reusable RBAC role check helper for UI elements.
 * Hierarchy: admin (level 4) >= manager (level 3) >= engineer (level 2) >= user (level 1)
 */
export function useRoleAccess() {
  const userStore = useUserStore();

  const userRoles = computed<string[]>(() => {
    const info = userStore.userInfo as any;
    if (!info) return [];
    const roles: string[] = Array.isArray(info.roles) ? [...info.roles] : [];
    if (info.role && typeof info.role === 'string' && !roles.includes(info.role)) {
      roles.push(info.role);
    }
    return roles;
  });

  const isAdmin = computed(() => userRoles.value.includes('admin'));
  const isManager = computed(() => userRoles.value.some((r) => ['admin', 'manager'].includes(r)));
  const isEngineer = computed(() =>
    userRoles.value.some((r) => ['admin', 'manager', 'engineer'].includes(r)),
  );

  return {
    isAdmin,
    isEngineer,
    isManager,
    userRoles,
  };
}
