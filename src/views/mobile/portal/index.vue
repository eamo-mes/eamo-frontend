<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Card, 
  Button, 
  Tag, 
  Spin, 
  Empty, 
  DatePicker, 
  Progress 
} from 'ant-design-vue';
import { useI18n } from '@vben/locales';
import { useUserStore } from '@vben/stores';
import dayjs, { type Dayjs } from 'dayjs';
import { getChecklistSessionsApi } from '#/api/ops/checklist';
import { listMaintenanceSchedulesApi } from '#/api/ops/maintenance-plans';

defineOptions({ name: 'MobilePortalHome' });

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();

const activeTab = ref<'checklist' | 'maintenance'>('checklist');
const selectedDate = ref<Dayjs>(dayjs());
const loading = ref(false);

const checklistSessions = ref<any[]>([]);
const maintenanceSchedules = ref<any[]>([]);

const currentUserId = computed(() => userStore.userInfo?.userId || (userStore.userInfo as { id?: string } | null)?.id || '');

// ─── Fetch Checklist Sessions ───
async function fetchChecklists() {
  try {
    const dateStr = selectedDate.value.format('YYYY-MM-DD');
    const raw = await getChecklistSessionsApi({
      include_details: true,
      start_date: dateStr,
      end_date: dateStr,
      per_page: 100,
    });
    const responseData = (raw as any)?.data ?? (raw as any)?.items ?? (Array.isArray(raw) ? raw : []);
    checklistSessions.value = Array.isArray(responseData) ? responseData : [];
  } catch (err) {
    console.error('Failed to fetch checklists:', err);
  }
}

// ─── Fetch Maintenance Schedules ───
async function fetchMaintenance() {
  try {
    const dateStr = selectedDate.value.format('YYYY-MM-DD');
    const rawSchedules = await listMaintenanceSchedulesApi({
      start_date: dateStr,
      end_date: dateStr,
      with_logs: true,
    });
    const scheduleArray = Array.isArray(rawSchedules) ? rawSchedules : [];
    maintenanceSchedules.value = groupSchedulesByPlan(scheduleArray, dateStr);
  } catch (err) {
    console.error('Failed to fetch maintenance:', err);
  }
}

// Group schedules by plan code
function getLatestResult(schedule: any): string | null {
  if (schedule.result) return schedule.result;
  if (schedule.maintenance_logs && schedule.maintenance_logs.length > 0) {
    return schedule.maintenance_logs[0]?.result || null;
  }
  return null;
}

function groupSchedulesByPlan(rows: any[], dateStr: string): any[] {
  const planMap = new Map<string, any>();
  const dayRows = rows.filter((s) => s.date && s.date.startsWith(dateStr));

  for (const s of dayRows) {
    const planKey = s.maintenance_plan_id || s.plan_code || s.id || 'unknown';
    const latestRes = getLatestResult(s);
    const isCompleted = Boolean(latestRes);
    const isPassed = latestRes === 'pass' || latestRes === 'normal' || latestRes === 'completed';
    const isFailed = latestRes === 'fail' || latestRes === 'abnormal';

    const eqCode = s.equipment_code || s.maintenance_plan?.equipment?.code || '—';
    const eqName = s.equipment_name || s.maintenance_plan?.equipment?.name || null;
    const planCode = s.plan_code || s.maintenance_plan?.plan_code || 'KẾ HOẠCH BẢO TRÌ';
    const mType = s.maintenance_type || s.maintenance_plan?.maintenance_type || '—';
    const users = s.users || s.maintenance_plan?.users || [];

    if (!planMap.has(planKey)) {
      planMap.set(planKey, {
        key: `plan-${planKey}-${dateStr}`,
        plan_id: s.maintenance_plan_id || '',
        plan_code: planCode,
        date: dateStr,
        equipment_code: eqCode,
        equipment_name: eqName,
        maintenance_type: mType,
        schedules: [s],
        total_items: 1,
        completed_items: isCompleted ? 1 : 0,
        status: isFailed ? 'fail' : isCompleted && isPassed ? 'pass' : 'pending',
        users,
      });
    } else {
      const node = planMap.get(planKey)!;
      node.schedules.push(s);
      node.total_items += 1;
      if (isCompleted) {
        node.completed_items += 1;
      }

      if (isFailed || node.status === 'fail') {
        node.status = 'fail';
      } else if (node.completed_items === node.total_items) {
        node.status = 'pass';
      } else {
        node.status = 'pending';
      }
    }
  }
  return Array.from(planMap.values());
}

// ─── Filter lists to show ONLY current logged-in user ───
const myChecklistSessions = computed(() => {
  return checklistSessions.value.filter((s) => {
    return s.users?.some((u: any) => u.id === currentUserId.value) || s.created_by === currentUserId.value;
  });
});

const myMaintenancePlans = computed(() => {
  return maintenanceSchedules.value.filter((p) => {
    return p.users?.some((u: any) => u.id === currentUserId.value);
  });
});

// ─── Status Tags ───
function getSessionStatusTag(session: any) {
  if (!session.details || session.details.length === 0) return { color: 'warning', label: 'Chưa xong' };
  
  const completedCount = session.details.filter((d: any) => {
    const logs = d.logs || [];
    return logs.some((log: any) => log.status === 'completed');
  }).length;
  
  const allCompleted = completedCount === session.details.length;
  if (!allCompleted) return { color: 'warning', label: 'Chưa xong' };
  
  const allPassed = session.details.every((d: any) => {
    const logs = d.logs || [];
    const latestLog = logs.filter((log: any) => log.status === 'completed').sort((l: any, r: any) => (l.checked_at ?? '').localeCompare(r.checked_at ?? '')).at(-1);
    return latestLog?.result === 'pass';
  });
  return allPassed ? { color: 'success', label: 'Đạt' } : { color: 'error', label: 'Không đạt' };
}

function getPlanStatusTag(group: any) {
  if (group.status === 'pass') {
    return { color: 'success', label: 'Đạt' };
  } else if (group.status === 'fail') {
    return { color: 'error', label: 'Không đạt' };
  }
  return { color: 'warning', label: 'Chưa xong' };
}

function getCycleText(type?: string): string {
  switch (type) {
    case 'daily': return 'Hàng ngày';
    case 'weekly': return 'Hàng tuần';
    case 'monthly': return 'Hàng tháng';
    case 'yearly': return 'Hàng năm';
    default: return type || '—';
  }
}

function getCompletedCount(session: any): number {
  if (!session.details) return 0;
  return session.details.filter((d: any) => {
    const logs = d.logs || [];
    return logs.some((log: any) => log.status === 'completed');
  }).length;
}

function getProgressPercent(session: any): number {
  if (!session.details || session.details.length === 0) return 0;
  return Math.round((getCompletedCount(session) / session.details.length) * 100);
}

function getProgressColor(session: any): string {
  const status = getSessionStatus(session);
  if (status === 'pass') return '#52c41a';
  if (status === 'fail') return '#f5222d';
  return '#1890ff';
}

function getSessionStatus(session: any): 'pass' | 'fail' | 'pending' {
  if (!session.details || session.details.length === 0) return 'pending';
  const completedLogs = session.details.map((d: any) => {
    const logs = d.logs || [];
    return logs.filter((log: any) => log.status === 'completed').sort((l: any, r: any) => (l.checked_at ?? '').localeCompare(r.checked_at ?? '')).at(-1);
  });
  const allCompleted = completedLogs.every((log: any) => log !== undefined);
  if (!allCompleted) return 'pending';
  const allPassed = completedLogs.every((log: any) => log?.result === 'pass');
  return allPassed ? 'pass' : 'fail';
}

function getProgressPercentForPlan(group: any): number {
  if (group.total_items === 0) return 0;
  return Math.round((group.completed_items / group.total_items) * 100);
}

function getProgressColorForPlan(group: any): string {
  if (group.status === 'pass') return '#52c41a';
  if (group.status === 'fail') return '#f5222d';
  return '#1890ff';
}

// Date switcher helpers
function changeDate(days: number) {
  selectedDate.value = selectedDate.value.add(days, 'day');
}

function handleDateChange(val: any) {
  if (val) {
    selectedDate.value = dayjs(val);
  }
}

async function loadData() {
  loading.value = true;
  await Promise.all([fetchChecklists(), fetchMaintenance()]);
  loading.value = false;
}

onMounted(() => {
  loadData();
});

watch(selectedDate, () => {
  loadData();
});
</script>

<template>
  <div class="portal-container min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-28 relative flex flex-col transition-colors duration-300">
    
    <!-- Premium background glowing spots (ambient mesh) -->
    <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-200/10 dark:bg-emerald-950/5 rounded-full blur-[120px] pointer-events-none"></div>

    <div class="relative z-10 w-full flex-1 flex flex-col">
      <!-- ─── TOP AREA: DATE PICKER & TAB SWITCHER ─── -->
      <div class="space-y-3.5 mb-4">
        
        <!-- Date Switcher Pill -->
        <div class="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-3xs">
          <button
            type="button"
            class="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
            @click="changeDate(-1)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          <DatePicker
            :value="selectedDate"
            @change="handleDateChange"
            format="YYYY-MM-DD"
            :allow-clear="false"
            class="flex-1 border-none bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl py-1 px-2 cursor-pointer font-bold text-center"
            style="width: 100%"
          />

          <button
            type="button"
            class="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors border-0 cursor-pointer outline-none"
            @click="changeDate(1)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <!-- Tab Switcher (Checklist vs Maintenance) -->
        <div class="flex p-1 bg-indigo-600 dark:bg-indigo-900 rounded-xl shadow-md">
          <button
            type="button"
            @click="activeTab = 'checklist'"
            :class="[activeTab === 'checklist' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-white/80 font-medium hover:text-white']"
            class="flex-1 py-2 text-xs text-center rounded-lg transition-all border-0 cursor-pointer outline-none"
          >
            Checklist ({{ myChecklistSessions.length }})
          </button>
          <button
            type="button"
            @click="activeTab = 'maintenance'"
            :class="[activeTab === 'maintenance' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-white/80 font-medium hover:text-white']"
            class="flex-1 py-2 text-xs text-center rounded-lg transition-all border-0 cursor-pointer outline-none"
          >
            Kế hoạch bảo trì ({{ myMaintenancePlans.length }})
          </button>
        </div>

      </div>

      <!-- ─── MIDDLE CONTENT AREA: SCROLLABLE LIST ─── -->
      <div class="flex-1 overflow-y-auto pb-4">
        <Spin :spinning="loading">
          
          <!-- Checklist Tab Content -->
          <div v-if="activeTab === 'checklist'">
            <div v-if="myChecklistSessions.length > 0" class="flex flex-col gap-3.5">
              <Card
                v-for="session in myChecklistSessions"
                :key="session.id"
                class="rounded-2xl shadow-3xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden"
                :body-style="{ padding: '16px' }"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate m-0">
                      {{ session.name || session.equipment?.name || 'Phiên kiểm tra' }}
                    </h3>
                    <p class="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold font-mono mt-1 mb-0">
                      {{ session.equipment?.code || '—' }} <span v-if="session.equipment?.name" class="text-slate-400 dark:text-zinc-500 font-normal">— {{ session.equipment.name }}</span>
                    </p>
                  </div>
                  <Tag :color="getSessionStatusTag(session).color" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    {{ getSessionStatusTag(session).label }}
                  </Tag>
                </div>

                <div class="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400 mt-4">
                  <span class="font-semibold text-[11px]">
                    Chu kỳ: {{ getCycleText(session.cycle_type) }}
                    <span v-if="session.cycle_interval && session.cycle_interval > 1">({{ session.cycle_interval }})</span>
                  </span>
                  <span class="font-medium text-[11px]">Hạng mục: {{ getCompletedCount(session) }}/{{ session.details?.length || 0 }}</span>
                </div>

                <div class="mt-2.5">
                  <Progress
                    :percent="getProgressPercent(session)"
                    :show-info="false"
                    size="small"
                    class="m-0"
                    :stroke-color="getProgressColor(session)"
                  />
                </div>

                <div class="flex items-center gap-2 mt-4">
                  <Button
                    type="primary"
                    class="flex-1 bg-indigo-600 hover:bg-indigo-700 border-none text-xs h-8.5 rounded-xl font-bold flex items-center justify-center gap-1.5"
                    @click="router.push('/portal/checklist')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    Bắt đầu kiểm tra
                  </Button>
                </div>
              </Card>
            </div>

            <div v-else class="py-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl text-center px-4">
              <Empty description="Không có phiên kiểm tra nào được giao cho bạn hôm nay." />
            </div>
          </div>

          <!-- Maintenance Tab Content -->
          <div v-if="activeTab === 'maintenance'">
            <div v-if="myMaintenancePlans.length > 0" class="flex flex-col gap-3.5">
              <Card
                v-for="group in myMaintenancePlans"
                :key="group.key"
                class="rounded-2xl shadow-3xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden"
                :body-style="{ padding: '16px' }"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate m-0">
                      {{ group.plan_code }}
                    </h3>
                    <p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold font-mono mt-1 mb-0">
                      {{ group.equipment_code }} <span v-if="group.equipment_name" class="text-slate-400 dark:text-zinc-500 font-normal">— {{ group.equipment_name }}</span>
                    </p>
                  </div>
                  <Tag :color="getPlanStatusTag(group).color" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    {{ getPlanStatusTag(group).label }}
                  </Tag>
                </div>

                <div class="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400 mt-4">
                  <span class="font-semibold text-[11px]">
                    Loại bảo trì: {{ group.maintenance_type || 'Bảo trì định kỳ' }}
                  </span>
                  <span class="font-medium text-[11px]">Hạng mục: {{ group.completed_items }}/{{ group.total_items }}</span>
                </div>

                <div class="mt-2.5">
                  <Progress
                    :percent="getProgressPercentForPlan(group)"
                    :show-info="false"
                    size="small"
                    class="m-0"
                    :stroke-color="getProgressColorForPlan(group)"
                  />
                </div>

                <div class="flex items-center gap-2 mt-4">
                  <Button
                    type="primary"
                    class="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none text-xs h-8.5 rounded-xl font-bold flex items-center justify-center gap-1.5"
                    @click="router.push('/portal/maintain-plan')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    Thực hiện bảo trì
                  </Button>
                </div>
              </Card>
            </div>

            <div v-else class="py-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl text-center px-4">
              <Empty description="Không có kế hoạch bảo trì nào được giao cho bạn hôm nay." />
            </div>
          </div>

        </Spin>
      </div>
    </div>

    <!-- ─── FIXED BOTTOM ACTION BAR ─── -->
    <div class="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-950 border-t border-slate-200/80 dark:border-zinc-800/80 px-4 flex items-center justify-between z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      
      <!-- Báo cáo sự cố (Bottom Left) -->
      <button
        type="button"
        @click="router.push('/portal/incident-report')"
        class="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs border-0 cursor-pointer outline-none transition-colors"
      >
        Báo cáo sự cố
      </button>

      <!-- Center Floating Scan Button Spacer -->
      <div class="w-16 relative flex justify-center">
        <!-- Floating Scan Button (Black circle with V logo) -->
        <button
          type="button"
          @click="router.push('/portal/equipment')"
          class="absolute -top-7 w-12 h-12 bg-black hover:bg-zinc-900 active:scale-95 text-white rounded-full flex items-center justify-center shadow-md border-4 border-white dark:border-zinc-950 cursor-pointer outline-none transition-all duration-200"
        >
          <!-- V logo icon -->
          <span class="text-white font-black text-lg select-none font-sans">V</span>
        </button>
      </div>

      <!-- Dừng khẩn cấp (Bottom Right) -->
      <button
        type="button"
        @click="router.push('/portal/emergency-stop')"
        class="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs border-0 cursor-pointer outline-none transition-colors"
      >
        Dừng khẩn cấp
      </button>

    </div>

  </div>
</template>

<style scoped>
.portal-container {
  padding: 16px;
  position: relative;
}
</style>
