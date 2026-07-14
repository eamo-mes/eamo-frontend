<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { Spin } from 'ant-design-vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { $t } from '#/locales';
import { listUsersApi, type UserItem } from '#/api/core/users';
import { useAccessStore, useUserStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import VisualMaintenanceCalendar from '#/views/ops/maintenance-plans/components/VisualMaintenanceCalendar.vue';
import AssignedTasks from './components/AssignedTasks.vue';

interface EquipmentOption {
  id: string;
  code: string;
  name: string | null;
}

interface MaintenanceCategoryOption {
  id: string;
  name: string;
}

interface MaintenanceItemOption {
  id: string;
  name: string;
  description: string | null;
  maintenance_category_id: string;
}

const userStore = useUserStore();

const welcomeName = computed(() => {
  return userStore.userInfo?.realName || userStore.userInfo?.username || 'User';
});

const greeting = computed(() => {
  const hour = dayjs().hour();
  let greetText = $t('page.dashboard.gMorning');
  if (hour >= 12 && hour < 18) {
    greetText = $t('page.dashboard.gAfternoon');
  } else if (hour >= 18) {
    greetText = $t('page.dashboard.gEvening');
  }
  return `${greetText} ${welcomeName.value}`;
});

const equipments = ref<EquipmentOption[]>([]);
const categories = ref<MaintenanceCategoryOption[]>([]);
const allSchedules = ref<any[]>([]);
const users = ref<UserItem[]>([]);
const maintenanceItems = ref<MaintenanceItemOption[]>([]);
const loadingSchedules = ref(false);

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

const userOptions = computed(() =>
  users.value.map((u) => ({
    label: u.name,
    value: u.id,
  }))
);

async function loadEquipments(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? (raw as EquipmentOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadCategories(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-categories`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? (raw as MaintenanceCategoryOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadAllSchedules(startDate?: string, endDate?: string): Promise<void> {
  try {
    const params: any = { per_page: 1000, with_logs: true };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-schedules`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? res.data ?? [];
    allSchedules.value = (Array.isArray(raw) ? raw : []).map((s: any) => ({
      id: s.id,
      maintenance_item_id: s.maintenance_item_id,
      maintenance_plan_id: s.maintenance_plan_id,
      date: s.date,
      user_ids: (s.users ?? []).map((u: any) => u.id),
      result: s.maintenance_logs?.[0]?.result || null,
      _key: Math.random().toString(36).slice(2) + Date.now().toString(36),
      plan_code: s.maintenance_plan?.plan_code || '—',
      equipment_id: s.maintenance_plan?.equipment_id || '',
      maintenance_type: s.maintenance_plan?.maintenance_type || '—',
      equipment_name: s.maintenance_plan?.equipment
        ? `${s.maintenance_plan.equipment.code}${s.maintenance_plan.equipment.name ? ` — ${s.maintenance_plan.equipment.name}` : ''}`
        : '—',
      category_name: s.maintenance_plan?.maintenance_category?.name || '—',
      item_name: s.maintenance_item?.name || '—',
      item_description: s.maintenance_item?.description || '',
    }));
  } catch {
    // silently fail
  }
}

async function loadMaintenanceItems(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-items`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    maintenanceItems.value = Array.isArray(raw) ? (raw as MaintenanceItemOption[]) : [];
  } catch {
    // silently fail
  }
}

async function loadUsers(): Promise<void> {
  try {
    users.value = await listUsersApi({ per_page: 1000 });
  } catch {
    // silently fail
  }
}

const calendarRange = ref<{ start_date: string; end_date: string } | null>(null);

async function handleCalendarRangeChange(range: { start_date: string; end_date: string }): Promise<void> {
  calendarRange.value = range;
  loadingSchedules.value = true;
  try {
    await loadAllSchedules(range.start_date, range.end_date);
  } finally {
    loadingSchedules.value = false;
  }
}

onMounted(() => {
  loadEquipments();
  loadCategories();
  loadUsers();
  loadMaintenanceItems();
});
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Bottom Section: 2 Columns -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start pt-2">
      <!-- Left Column (Always displays Calendar) -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[400px]">
          <Spin :spinning="loadingSchedules">
            <VisualMaintenanceCalendar
              v-model:schedules="allSchedules"
              :maintenance-items="maintenanceItems"
              :categories="categories"
              :equipments="equipments"
              :user-options="userOptions"
              :read-only="true"
              @range-change="handleCalendarRangeChange"
            />
          </Spin>
        </div>
      </div>

      <!-- Right Column (Combined Notifications & Summary Stats) -->
      <div class="lg:col-span-1">
        <AssignedTasks />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
