<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Calendar, Drawer, DatePicker, Select, Popconfirm, Button, Tag, message } from 'ant-design-vue';
import { $t } from '#/locales';
import dayjs, { type Dayjs } from 'dayjs';

const router = useRouter();

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
  }>(),
  {
    equipments: () => [],
    readOnly: false,
  }
);

const emit = defineEmits<{
  (e: 'update:schedules', newSchedules: ScheduleRow[]): void;
  (e: 'rangeChange', range: { start_date: string; end_date: string }): void;
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
  drawerVisible.value = true;
}

function handleSaveDrawer(): void {
  if (selectedSchedule.value && drawerSchedule.value) {
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
</script>

<template>
  <div>
    <!-- ── Calendar View Section (Inside Card) ────────────────────────── -->
    <div class="border-t border-gray-150 pt-5 mt-5">
      <div class="font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ $t('page.ops.visualScheduleTitle') }}</div>
      <Calendar
        v-model:value="calendarValue"
        @panelChange="onPanelChange"
        @select="onSelect"
      >
        <template #dateCellRender="{ current }">
          <ul class="list-none p-0 m-0 overflow-y-auto max-h-[80px]">
            <li
              v-for="s in getSchedulesForDate(current)"
              :key="s._key"
              class="mb-1 py-0.5 px-2 text-xs rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 truncate cursor-pointer transition-all duration-200 ease-in-out hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:-translate-y-[0.5px] hover:shadow-sm"
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
      :width="420"
    >
      <div v-if="drawerSchedule" class="space-y-6 px-2">
        <!-- Hạng mục bảo trì & Danh mục -->
        <div class="space-y-1 pb-1">
          <Tag color="blue" class="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border-blue-200 text-blue-700 bg-blue-50/60 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-850">
            {{ getCategoryName(selectedSchedule!) }}
          </Tag>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-2">
            {{ getItemName(selectedSchedule!) }}
          </h3>
        </div>

        <!-- Thông tin kế hoạch (chỉ hiển thị ở chế độ xem lịch chung) -->
        <div v-if="props.readOnly" class="bg-gray-50/50 dark:bg-gray-900/30 border border-gray-150/60 dark:border-gray-800 rounded-xl p-4 space-y-3 shadow-xs">
          <span class="text-xs text-gray-400 font-bold uppercase tracking-wider block">
            {{ $t('page.ops.planInfoSectionTitle') }}
          </span>
          <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span class="text-xs text-gray-400 block mb-0.5">{{ $t('page.ops.colPlanCode') }}</span>
              <span class="font-semibold text-gray-700 dark:text-gray-250 truncate block">
                {{ selectedSchedule?.plan_code || '—' }}
              </span>
            </div>
            <div>
              <span class="text-xs text-gray-400 block mb-0.5">{{ $t('page.ops.colMaintenanceType') }}</span>
              <span class="font-semibold text-gray-700 dark:text-gray-250 truncate block">
                {{ selectedSchedule?.maintenance_type || '—' }}
              </span>
            </div>
            <div class="col-span-2 border-t border-gray-100 dark:border-gray-850 pt-2.5 mt-1">
              <span class="text-xs text-gray-400 block mb-0.5">{{ $t('page.ops.placeholderEquipment') }}</span>
              <span class="font-semibold text-gray-700 dark:text-gray-250 leading-relaxed block">
                {{ getEquipmentName(selectedSchedule!) || '—' }}
              </span>
            </div>
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
          <template v-if="props.readOnly">
            <div class="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-900/30 border border-gray-150/60 dark:border-gray-800 rounded-xl p-3.5 shadow-xs">
              <span class="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                <!-- Calendar icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <div>
                <span class="text-xs text-gray-400 font-medium block mb-0.5">{{ $t('page.ops.expectedExecutionDate') }}</span>
                <span class="font-bold text-gray-700 dark:text-gray-250">{{ drawerSchedule.date }}</span>
              </div>
            </div>
          </template>
          <template v-else>
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
          </template>
        </div>

        <!-- Kỹ thuật viên thực hiện -->
        <div class="space-y-2 border-t border-border pt-4">
          <template v-if="props.readOnly">
            <span class="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
              {{ $t('page.ops.assignedTechnicians') }}
            </span>
            <div class="flex flex-wrap gap-2" v-if="drawerSchedule.user_ids.length > 0">
              <span 
                v-for="userId in drawerSchedule.user_ids" 
                :key="userId" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-350 border border-emerald-100 dark:border-emerald-900/40"
              >
                <!-- User icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {{ getUserLabel(userId) }}
              </span>
            </div>
            <div v-else class="text-sm text-gray-400 dark:text-gray-550 italic bg-gray-50/20 p-3 rounded-lg border border-gray-100 dark:border-gray-850">
              {{ $t('page.ops.noAssignedTechnicians') }}
            </div>
          </template>
          <template v-else>
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
          </template>
        </div>
      </div>

      <!-- Drawer Footer with Save and Cancel buttons -->
      <template #footer>
        <div class="flex justify-between items-center py-2">
          <template v-if="props.readOnly">
            <Button @click="handleCancelDrawer">
              {{ $t('page.ops.btnCancel') }}
            </Button>
            <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" @click="goToPlan">
              {{ $t('page.ops.btnGoToPlan') }}
            </Button>
          </template>
          <template v-else>
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
            <div class="flex gap-2">
              <Button @click="handleCancelDrawer">
                {{ $t('page.ops.btnCancel') }}
              </Button>
              <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" @click="handleSaveDrawer">
                {{ $t('page.ops.btnSave') }}
              </Button>
            </div>
          </template>
        </div>
      </template>
    </Drawer>
  </div>
</template>
