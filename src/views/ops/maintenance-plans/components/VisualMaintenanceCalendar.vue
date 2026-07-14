<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Calendar, Drawer, DatePicker, Select, Popconfirm, Button, Tag, message, Input } from 'ant-design-vue';
import { $t } from '#/locales';
import dayjs, { type Dayjs } from 'dayjs';
import axios from 'axios';
import { useAccessStore, useUserStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

const router = useRouter();
const route = useRoute();

interface LastMaintenanceInfo {
  equipment_id: string;
  maintenance_plan_id: string;
  datetime: string;
  user_id: string;
}

interface Equipment {
  id: string;
  code: string;
  name: string | null;
  last_maintenance?: LastMaintenanceInfo | null;
}

interface LastMaintenanceNode {
  isLastMaintenance: boolean;
  label: string;
  equipmentId?: string;
  equipmentCode?: string;
  datetime?: string;
}

interface UserOption {
  label: string;
  value: string;
}

interface MaintenanceItemOption {
  id: string;
  name: string;
  description: string | null;
  maintenance_category_id: string;
}

interface ScheduleRow {
  id?: string;
  maintenance_item_id: string;
  maintenance_plan_id?: string;
  date: string;
  user_ids: string[];
  _key: string;
  plan_code?: string;
  equipment_id?: string;
  maintenance_type?: string;
  item_name?: string;
  category_name?: string;
  equipment_name?: string;
  item_description?: string;
  result?: string | null;
}

interface MaintenanceCategoryOption {
  id: string;
  name: string;
}

interface EquipmentOption {
  id: string;
  code: string;
  name: string | null;
}

const props = withDefaults(
  defineProps<{
    schedules: ScheduleRow[];
    maintenanceItems: MaintenanceItemOption[];
    categories: MaintenanceCategoryOption[];
    userOptions: UserOption[];
    equipments?: EquipmentOption[];
    readOnly?: boolean;
    equipmentId?: string;
  }>(),
  {
    equipments: () => [],
    readOnly: false,
  }
);

const emit = defineEmits<{
  (e: 'update:schedules', newSchedules: ScheduleRow[]): void;
  (e: 'rangeChange', range: { start_date: string; end_date: string }): void;
  (e: 'createLog', schedule: ScheduleRow): void;
}>();

// --- Calendar logic ---
const calendarValue = ref<Dayjs>(dayjs());

function emitRange(date: Dayjs): void {
  const start_date = date.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
  const end_date = date.endOf('month').add(7, 'day').format('YYYY-MM-DD');
  emit('rangeChange', { start_date, end_date });
}

onMounted(() => {
  emitRange(calendarValue.value);
  fetchLocalEquipments();
});

function onPanelChange(date: any): void {
  calendarValue.value = date;
  emitRange(date);
}

function onSelect(date: any): void {
  const oldMonth = calendarValue.value.format('YYYY-MM');
  const newMonth = date.format('YYYY-MM');
  calendarValue.value = date;
  if (oldMonth !== newMonth) {
    emitRange(date);
  }
}
const schedulesWithNames = computed(() => {
  return props.schedules
    .map(s => {
      const item = props.maintenanceItems.find((i) => i.id === s.maintenance_item_id);
      return {
        ...s,
        itemName: s.item_name || (item ? item.name : '')
      };
    })
    .filter(s => s.itemName !== '');
});

function getSchedulesForDate(date: Dayjs) {
  const dateStr = date.format('YYYY-MM-DD');
  return schedulesWithNames.value.filter((s) => s.date === dateStr);
}

function getItemName(schedule: ScheduleRow): string {
  if (schedule.item_name) return schedule.item_name;
  const item = props.maintenanceItems.find((i) => i.id === schedule.maintenance_item_id);
  return item ? item.name : $t('page.ops.unidentified');
}

function getCategoryName(schedule: ScheduleRow): string {
  if (schedule.category_name) return schedule.category_name;
  const item = props.maintenanceItems.find((i) => i.id === schedule.maintenance_item_id);
  if (!item) return '';
  const category = props.categories.find((c) => c.id === item.maintenance_category_id);
  return category ? category.name : '';
}

function getEquipmentName(schedule: ScheduleRow): string {
  if (schedule.equipment_name) return schedule.equipment_name;
  if (!schedule.equipment_id) return '';
  const eq = props.equipments.find((e) => e.id === schedule.equipment_id);
  return eq ? `${eq.code}${eq.name ? ` — ${eq.name}` : ''}` : '';
}

function getUserLabel(userId: string): string {
  const opt = props.userOptions.find((o) => o.value === userId);
  return opt ? opt.label : userId;
}

// --- Drawer logic ---
const drawerVisible = ref(false);
const selectedSchedule = ref<ScheduleRow | null>(null);
const drawerSchedule = ref<{ date: string; user_ids: string[] } | null>(null);

function showScheduleDetail(schedule: ScheduleRow): void {
  selectedSchedule.value = schedule;
  drawerSchedule.value = {
    date: schedule.date,
    user_ids: [...schedule.user_ids],
  };
  logResult.value = schedule.result || '';
  logNote.value = '';
  existingLog.value = null;
  drawerVisible.value = true;
  if (schedule.id) {
    fetchLogForSchedule(schedule.id);
  }
}

async function handleSaveDrawer(): Promise<void> {
  if (selectedSchedule.value && drawerSchedule.value) {
    if (selectedSchedule.value.id) {
      logSubmitting.value = true;
      try {
        if (!logResult.value || logResult.value === '') {
          if (existingLog.value) {
            await axios.delete(
              `${API_BASE_URL}/v1/maintenance-logs/${existingLog.value.id}`,
              { headers: getAuthHeaders() }
            );
            existingLog.value = null;
          }
        } else {
          if (existingLog.value) {
            const res = await axios.put(
              `${API_BASE_URL}/v1/maintenance-logs/${existingLog.value.id}`,
              {
                result: logResult.value,
                note: logNote.value || null,
              },
              { headers: getAuthHeaders() }
            );
            existingLog.value = res.data?.data ?? res.data;
          } else {
            const res = await axios.post(
              `${API_BASE_URL}/v1/maintenance-logs`,
              {
                maintenance_schedule_id: selectedSchedule.value.id,
                result: logResult.value,
                note: logNote.value || null,
              },
              { headers: getAuthHeaders() }
            );
            existingLog.value = res.data?.data ?? res.data;
          }
        }
      } catch (err: unknown) {
        const apiError = (err as any)?.response?.data?.message;
        message.error(apiError || $t('page.ops.logSaveError'));
        return;
      } finally {
        logSubmitting.value = false;
      }
    }

    const updatedSchedules = props.schedules.map((s) => {
      if (s._key === selectedSchedule.value?._key) {
        return {
          ...s,
          date: drawerSchedule.value!.date,
          user_ids: [...drawerSchedule.value!.user_ids],
        };
      }
      return s;
    });
    emit('update:schedules', updatedSchedules);
    drawerVisible.value = false;
    message.success($t('page.ops.drawerSaveSuccess'));
  }
}

function handleCancelDrawer(): void {
  drawerVisible.value = false;
}

function handleDeleteDrawer(): void {
  if (selectedSchedule.value) {
    const updatedSchedules = props.schedules.filter((s) => s._key !== selectedSchedule.value?._key);
    emit('update:schedules', updatedSchedules);
    drawerVisible.value = false;
    message.success($t('page.ops.drawerDeleteSuccess'));
  }
}

function goToPlan(): void {
  if (selectedSchedule.value?.maintenance_plan_id) {
    router.push({ name: 'OpsMaintenancePlanDetail', query: { id: selectedSchedule.value.maintenance_plan_id } });
  }
}

// --- Maintenance Log Logic ---
const logResult = ref<string | undefined>('');
const logNote = ref('');
const logSubmitting = ref(false);
const existingLog = ref<any | null>(null);
const loadingLog = ref(false);

const resultOptions = computed(() => [
  { label: $t('page.ops.logResultPending'), value: '' },
  { label: $t('page.ops.logResultCompleted'), value: 'Completed' },
  { label: $t('page.ops.logResultPartial'), value: 'Partial' },
  { label: $t('page.ops.logResultFailed'), value: 'Failed' },
]);

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function fetchLogForSchedule(scheduleId: string): Promise<void> {
  loadingLog.value = true;
  existingLog.value = null;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-logs`, {
      headers: getAuthHeaders(),
      params: { maintenance_schedule_id: scheduleId },
    });
    const logs = res.data ?? [];
    if (logs.length > 0) {
      existingLog.value = logs[0];
      logResult.value = logs[0].result;
      logNote.value = logs[0].note || '';
    } else {
      logResult.value = '';
    }
  } catch {
    logResult.value = '';
  } finally {
    loadingLog.value = false;
  }
}

function getScheduleClass(result: string | undefined | null): string {
  switch (result) {
    case 'Completed':
      return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-250 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
    case 'Partial':
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-250 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40';
    case 'Failed':
      return 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-250 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40';
    default:
      return 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-250 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40';
  }
}

const selectedItemDetails = computed(() => {
  if (!selectedSchedule.value) return null;
  if (selectedSchedule.value.item_description !== undefined) {
    return {
      description: selectedSchedule.value.item_description,
    };
  }
  return (
    props.maintenanceItems.find((i) => i.id === selectedSchedule.value?.maintenance_item_id) ||
    null
  );
});

const userStore = useUserStore();
const localEquipments = ref<Equipment[]>([]);
const lastMaintenanceDrawerVisible = ref(false);
const markingLastMaintenance = ref(false);

async function fetchLocalEquipments(): Promise<void> {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    localEquipments.value = Array.isArray(raw) ? raw : [];
  } catch {
    localEquipments.value = [...props.equipments];
  }
}

async function markCurrentAsLastMaintenance(): Promise<void> {
  const equipmentId = props.equipmentId || props.schedules[0]?.equipment_id;
  const planId = props.schedules[0]?.maintenance_plan_id || route.query.id as string;

  if (!equipmentId || !planId) {
    message.error('Không tìm thấy thông tin thiết bị hoặc kế hoạch');
    return;
  }

  const eq = localEquipments.value.find((e) => e.id === equipmentId);
  if (!eq) {
    message.error($t('page.ops.notFoundEquipment'));
    return;
  }

  markingLastMaintenance.value = true;
  try {
    const payload = {
      code: eq.code,
      name: eq.name,
      last_maintenance: {
        equipment_id: equipmentId,
        maintenance_plan_id: planId,
        datetime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        user_id: userStore.userInfo?.userId || '',
      },
    };

    await axios.put(`${API_BASE_URL}/v1/equipment/${equipmentId}`, payload, {
      headers: getAuthHeaders(),
    });

    message.success($t('page.ops.lastMaintenanceSetSuccess'));
    await fetchLocalEquipments();
  } catch (err: any) {
    const errMsg = err?.response?.data?.message || $t('page.ops.markError');
    message.error(errMsg);
  } finally {
    markingLastMaintenance.value = false;
  }
}

const lastMaintenanceFilterDate = ref<string | null>(null);

function getLastMaintenanceForDate(date: Dayjs): LastMaintenanceNode[] {
  const dateStr = date.format('YYYY-MM-DD');

  if (!props.readOnly) {
    const eqId = props.equipmentId || props.schedules[0]?.equipment_id;
    if (!eqId) return [];
    const eq = localEquipments.value.find((e) => e.id === eqId);
    if (!eq || !eq.last_maintenance || !eq.last_maintenance.datetime) return [];

    // Verify plan ID matches
    const planId = route.query.id as string;
    if (eq.last_maintenance.maintenance_plan_id !== planId) return [];

    const matches = dayjs(eq.last_maintenance.datetime).format('YYYY-MM-DD') === dateStr;
    if (matches) {
      return [{
        isLastMaintenance: true,
        label: eq.code || '',
        equipmentId: eq.id,
        equipmentCode: eq.code,
        datetime: eq.last_maintenance.datetime
      }];
    }
    return [];
  }

  // On index view (readOnly = true), show for any equipment whose last maintenance matches this date
  const list: LastMaintenanceNode[] = [];
  localEquipments.value.forEach((eq) => {
    if (!eq.last_maintenance || !eq.last_maintenance.datetime) return;
    if (dayjs(eq.last_maintenance.datetime).format('YYYY-MM-DD') === dateStr) {
      list.push({
        isLastMaintenance: true,
        label: eq.code || '',
        equipmentId: eq.id,
        equipmentCode: eq.code,
        datetime: eq.last_maintenance.datetime
      });
    }
  });
  return list;
}

const hasLastMaintenance = computed(() => {
  return localEquipments.value.some((e) => e.last_maintenance && e.last_maintenance.equipment_id);
});

const equipmentsWithLastMaintenance = computed(() => {
  return localEquipments.value.filter(
    (e) => e.last_maintenance && e.last_maintenance.equipment_id
  );
});

const displayedLastMaintenanceEquipments = computed<Equipment[]>(() => {
  if (lastMaintenanceFilterDate.value) {
    return equipmentsWithLastMaintenance.value.filter((eq) => {
      if (!eq.last_maintenance || !eq.last_maintenance.datetime) return false;
      return dayjs(eq.last_maintenance.datetime).format('YYYY-MM-DD') === lastMaintenanceFilterDate.value;
    });
  }
  return equipmentsWithLastMaintenance.value;
});

function getPlanCodeById(planId: string): string {
  const schedule = props.schedules.find((s) => s.maintenance_plan_id === planId);
  return schedule?.plan_code || '';
}

function showLastMaintenanceDrawer(): void {
  lastMaintenanceFilterDate.value = null;
  lastMaintenanceDrawerVisible.value = true;
}

function showLastMaintenanceForDate(dateStr: string): void {
  lastMaintenanceFilterDate.value = dateStr;
  lastMaintenanceDrawerVisible.value = true;
}
</script>

<template>
  <div>
    <!-- ── Calendar View Section (Inside Card) ────────────────────────── -->
    <div class="border-t border-gray-150 pt-5 mt-5">
      <div class="flex justify-between items-center mb-3">
        <div class="font-semibold text-gray-700 dark:text-gray-300">{{ $t('page.ops.visualScheduleTitle') }}</div>
        <div class="flex gap-2">
          <!-- Standalone Mark Button -->
          <Button
            v-if="!props.readOnly"
            type="primary"
            size="small"
            class="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 rounded text-white flex items-center gap-1.5 font-medium"
            :loading="markingLastMaintenance"
            @click="markCurrentAsLastMaintenance"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ $t('page.ops.markAsLastMaintenance') }}
          </Button>

          <!-- View Button -->
          <Button 
            v-if="hasLastMaintenance" 
            type="default" 
            size="small" 
            class="rounded flex items-center gap-1.5 font-medium"
            @click="showLastMaintenanceDrawer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ $t('page.ops.viewLastMaintenanceDevice') }}
          </Button>
        </div>
      </div>
      <Calendar
        v-model:value="calendarValue"
        @panelChange="onPanelChange"
        @select="onSelect"
      >
        <template #dateCellRender="{ current }">
          <ul class="relative z-10 list-none p-0 m-0 overflow-y-auto max-h-[85px]">
            <!-- Latest Maintenance Node(s) -->
            <li
              v-for="node in getLastMaintenanceForDate(current)"
              :key="node.equipmentId"
              class="mb-1 py-0.5 px-2 text-xs rounded border truncate cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-[0.5px] hover:shadow-sm bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-250 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 font-semibold flex items-center gap-1"
              :title="node.label"
              @click="showLastMaintenanceForDate(current.format('YYYY-MM-DD'))"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{{ node.label }}</span>
            </li>
            <!-- Regular Maintenance Schedule Items -->
            <li
              v-for="s in getSchedulesForDate(current)"
              :key="s._key"
              class="mb-1 py-0.5 px-2 text-xs rounded border truncate cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-[0.5px] hover:shadow-sm"
              :class="getScheduleClass(s.result)"
              :title="s.itemName"
              @click="showScheduleDetail(s)"
            >
              {{ s.itemName }}
            </li>
          </ul>
        </template>
      </Calendar>
    </div>

    <!-- ── Drawer Chi Tiết Hạng Mục Lịch Trình ──────────────────────────────────── -->
    <Drawer
      v-model:open="drawerVisible"
      :title="$t('page.ops.scheduleDetailTitle')"
      placement="right"
      :width="460"
    >
      <div v-if="drawerSchedule" class="space-y-6 px-2">
        <!-- Hạng mục bảo trì & Danh mục -->
        <div class="space-y-1 pb-1">
          <Tag color="blue" class="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border-blue-200 text-blue-700 bg-blue-50/60 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-850">
            {{ getCategoryName(selectedSchedule!) }}
          </Tag>
          <div class="flex items-center gap-2 mt-2">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {{ getItemName(selectedSchedule!) }}
            </h3>
          </div>
        </div>

        <!-- Thông tin kế hoạch (chỉ hiển thị ở chế độ xem lịch chung) -->
        <div v-if="props.readOnly" class="space-y-4">
          <div>
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.colPlanCode') }}
            </span>
            <Input
              :value="selectedSchedule?.plan_code || '—'"
              disabled
              class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
          <div>
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.colMaintenanceType') }}
            </span>
            <Input
              :value="selectedSchedule?.maintenance_type || '—'"
              disabled
              class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
          <div>
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.placeholderEquipment') }}
            </span>
            <Input
              :value="getEquipmentName(selectedSchedule!) || '—'"
              disabled
              class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
        </div>

        <!-- Mô tả chi tiết -->
        <div class="space-y-2 border-t border-border pt-4">
          <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block">
            {{ $t('page.ops.itemDetailDescriptionLabel') }}
          </span>
          <div v-if="selectedItemDetails?.description" class="text-sm text-gray-650 dark:text-gray-350 leading-relaxed whitespace-pre-line bg-gray-50/20 p-3 rounded-lg border border-gray-100 dark:border-gray-850">
            {{ selectedItemDetails.description }}
          </div>
          <div v-else class="text-sm text-gray-400 dark:text-gray-550 italic bg-gray-50/20 p-3 rounded-lg border border-gray-100 dark:border-gray-850">
            {{ $t('page.ops.noItemDescription') }}
          </div>
        </div>

        <!-- Ngày thực hiện dự kiến -->
        <div class="space-y-2 border-t border-border pt-4">
          <span class="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-1">
            {{ $t('page.ops.expectedExecutionDate') }}
          </span>
          <DatePicker
            v-model:value="drawerSchedule.date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            :placeholder="$t('page.ops.placeholderScheduleDate')"
            class="w-full"
          />
        </div>

        <!-- Kỹ thuật viên thực hiện -->
        <div class="space-y-2 border-t border-border pt-4">
          <span class="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-1">
            {{ $t('page.ops.assignedTechnicians') }}
          </span>
          <Select
            v-model:value="drawerSchedule.user_ids"
            :options="props.userOptions"
            :placeholder="$t('page.ops.placeholderAssignedUsers')"
            mode="multiple"
            option-filter-prop="label"
            show-search
            allow-clear
            class="w-full"
          />
        </div>

        <!-- Ghi nhận nhật ký bảo trì -->
        <div class="space-y-4 border-t border-border pt-4">
          <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block">
            {{ $t('page.ops.logTitle') }}
          </span>

          <!-- Nếu lịch trình chưa lưu vào DB (chưa có id), bắt buộc lưu kế hoạch trước -->
          <div v-if="!selectedSchedule?.id" class="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-400 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/40">
            {{ $t('page.ops.logRequiredToSavePlan') }}
          </div>

          <Spin v-else :spinning="loadingLog">
            <div class="space-y-4">
              <!-- Kết quả -->
              <div class="space-y-1">
                <label class="text-xs text-gray-500 font-medium block">
                  {{ $t('page.ops.logResultLabel') }} <span class="text-red-500">*</span>
                </label>
                <Select
                  v-model:value="logResult"
                  :placeholder="$t('page.ops.logResultPlaceholder')"
                  :options="resultOptions"
                  class="w-full"
                />
              </div>

              <!-- Ghi chú -->
              <div class="space-y-1">
                <label class="text-xs text-gray-500 font-medium block">
                  {{ $t('page.ops.logNoteLabel') }}
                </label>
                <Input.TextArea
                  v-model:value="logNote"
                  :placeholder="$t('page.ops.logNotePlaceholder')"
                  :rows="3"
                  class="w-full"
                />
              </div>
            </div>
          </Spin>
        </div>

      </div>

      <!-- Drawer Footer with Save and Cancel buttons -->
      <template #footer>
        <div class="flex justify-between items-center py-2">
          <!-- Chế độ Chỉ xem (ReadOnly - ở màn danh sách) -->
          <template v-if="props.readOnly">
            <div class="flex gap-2">
              <Button @click="handleCancelDrawer">
                {{ $t('page.ops.btnCancel') }}
              </Button>
              <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" @click="goToPlan">
                {{ $t('page.ops.btnGoToPlan') }}
              </Button>
            </div>
          </template>

          <!-- Chế độ Chỉnh sửa (ở màn chi tiết) -->
          <template v-else>
            <div class="flex gap-2">
              <!-- Xóa lịch trình khỏi kế hoạch -->
              <Popconfirm
                :title="$t('page.ops.deleteMaintenanceItemConfirm')"
                :ok-text="$t('page.ops.btnDelete')"
                :cancel-text="$t('page.ops.btnCancel')"
                @confirm="handleDeleteDrawer"
              >
                <Button danger>
                  {{ $t('page.ops.btnDelete') }}
                </Button>
              </Popconfirm>
            </div>

            <div class="flex gap-2">
              <Button @click="handleCancelDrawer">
                {{ $t('page.ops.btnCancel') }}
              </Button>
              <!-- Lưu thay đổi của lịch trình và nhật ký bảo trì -->
              <Button
                type="primary"
                class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded text-white"
                :loading="logSubmitting"
                @click="handleSaveDrawer"
              >
                {{ $t('page.ops.btnSave') }}
              </Button>
            </div>
          </template>
        </div>
      </template>
    </Drawer>

    <!-- ── Drawer hiển thị thông tin log bảo trì gần nhất ──────────────────────────────────── -->
    <Drawer
      v-model:open="lastMaintenanceDrawerVisible"
      :title="$t('page.ops.lastMaintenanceDeviceTitle')"
      placement="right"
      :width="460"
    >
      <div class="space-y-6 px-2">
        <div 
          v-for="(eq, index) in displayedLastMaintenanceEquipments" 
          :key="eq.id"
          class="space-y-4"
        >
          <!-- Divider line between items -->
          <div v-if="index > 0" class="border-t border-border pt-4 mt-4"></div>

          <!-- Header or label with Tag -->
          <div class="flex justify-between items-center pb-2 border-b border-border">
            <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">
              {{ $t('page.ops.placeholderEquipment') }} {{ eq.code }}
            </span>
            <Tag color="green">{{ $t('page.ops.maintainedLabel') }}</Tag>
          </div>

          <!-- Fields -->
          <div class="space-y-3">
            <div>
              <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                {{ $t('page.ops.placeholderEquipment') }}
              </span>
              <Input
                :value="eq.code + (eq.name ? ` — ${eq.name}` : '')"
                disabled
                class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
              />
            </div>
            <div>
              <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                {{ $t('page.ops.colPlanCode') }}
              </span>
              <Input
                :value="eq.last_maintenance ? (getPlanCodeById(eq.last_maintenance.maintenance_plan_id) || eq.last_maintenance.maintenance_plan_id) : ''"
                disabled
                class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
              />
            </div>
            <div>
              <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                {{ $t('page.ops.maintenanceTime') }}
              </span>
              <Input
                :value="eq.last_maintenance?.datetime || ''"
                disabled
                class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
              />
            </div>
            <div>
              <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                {{ $t('page.ops.executor') }}
              </span>
              <Input
                :value="eq.last_maintenance ? getUserLabel(eq.last_maintenance.user_id) : ''"
                disabled
                class="bg-gray-50/50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 font-medium"
              />
            </div>
          </div>
        </div>
        <div v-if="displayedLastMaintenanceEquipments.length === 0" class="text-center py-8 text-gray-400 italic">
          {{ $t('page.ops.noLastMaintenanceDevice') }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end py-2">
          <Button @click="lastMaintenanceDrawerVisible = false">{{ $t('page.ops.btnClose') }}</Button>
        </div>
      </template>
    </Drawer>
  </div>
</template>
