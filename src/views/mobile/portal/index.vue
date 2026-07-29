<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Card,
  Button,
  Spin, 
  Empty,
  Progress
} from 'ant-design-vue';
import { useI18n } from '@vben/locales';
import { useUserStore } from '@vben/stores';
import { getChecklistSessionsApi } from '#/api/ops/checklist';
import { listMaintenanceSchedulesApi } from '#/api/ops/maintenance-plans';

defineOptions({ name: 'MobilePortalHome' });

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();

const activeTab = ref<'checklist' | 'maintenance'>('checklist');
const loading = ref(false);

const checklistSessions = ref<any[]>([]);
const maintenanceSchedules = ref<any[]>([]);

const currentUserId = computed(() => userStore.userInfo?.userId || (userStore.userInfo as { id?: string } | null)?.id || '');

// ─── Fetch Checklist Sessions (All of them) ───
async function fetchChecklists() {
  try {
    const raw = await getChecklistSessionsApi({
      include_details: true,
      per_page: 1000,
    });
    const responseData = (raw as any)?.data ?? (raw as any)?.items ?? (Array.isArray(raw) ? raw : []);
    const sessions = Array.isArray(responseData) ? responseData : [];
    
    // Sort by session_date descending (latest first)
    checklistSessions.value = sessions.sort((a: any, b: any) => (b.session_date || '').localeCompare(a.session_date || ''));
  } catch (err) {
    console.error('Failed to fetch checklists:', err);
  }
}

// ─── Fetch Maintenance Schedules (All of them) ───
async function fetchMaintenance() {
  try {
    const rawSchedules = await listMaintenanceSchedulesApi({
      with_logs: true,
      per_page: 1000,
    });
    const scheduleArray = Array.isArray(rawSchedules) ? rawSchedules : [];
    maintenanceSchedules.value = groupSchedulesByPlan(scheduleArray);
  } catch (err) {
    console.error('Failed to fetch maintenance:', err);
  }
}

// Group schedules by plan code & date
function getLatestResult(schedule: any): string | null {
  if (schedule.result) return schedule.result;
  if (schedule.maintenance_logs && schedule.maintenance_logs.length > 0) {
    return schedule.maintenance_logs[0]?.result || null;
  }
  return null;
}

function groupSchedulesByPlan(rows: any[]): any[] {
  const planMap = new Map<string, any>();

  for (const s of rows) {
    if (!s.date) continue;
    const dateStr = s.date.slice(0, 10);
    const planKey = `${s.maintenance_plan_id || s.plan_code || s.id || 'unknown'}-${dateStr}`;
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
        key: `plan-${planKey}`,
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
  
  // Sort by date descending
  return Array.from(planMap.values()).sort((a, b) => b.date.localeCompare(a.date));
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
  if (!session.details || session.details.length === 0) return { bgClass: 'bg-[#2f55a4]', label: t('page.portal.statusPending') };
  
  const completedCount = session.details.filter((d: any) => {
    const logs = d.logs || [];
    return logs.some((log: any) => log.status === 'completed');
  }).length;
  
  const allCompleted = completedCount === session.details.length;
  if (!allCompleted) return { bgClass: 'bg-[#2f55a4]', label: t('page.portal.statusPending') };
  
  const allPassed = session.details.every((d: any) => {
    const logs = d.logs || [];
    const latestLog = logs.filter((log: any) => log.status === 'completed').sort((l: any, r: any) => (l.checked_at ?? '').localeCompare(r.checked_at ?? '')).at(-1);
    return latestLog?.result === 'pass';
  });
  return allPassed ? { bgClass: 'bg-emerald-600', label: t('page.portal.statusPass') } : { bgClass: 'bg-rose-600', label: t('page.portal.statusFail') };
}

function getPlanStatusTag(group: any) {
  if (group.status === 'pass') {
    return { bgClass: 'bg-emerald-600', label: t('page.portal.statusPass') };
  } else if (group.status === 'fail') {
    return { bgClass: 'bg-rose-600', label: t('page.portal.statusFail') };
  }
  return { bgClass: 'bg-[#2f55a4]', label: t('page.portal.statusPending') };
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

function getProgressPercentForPlan(group: any): number {
  if (!group.total_items) return 0;
  return Math.round((group.completed_items / group.total_items) * 100);
}

async function loadData() {
  loading.value = true;
  await Promise.all([fetchChecklists(), fetchMaintenance()]);
  loading.value = false;
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="portal-container min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-28 relative flex flex-col transition-colors duration-300">

    <div class="relative z-10 w-full flex-1 flex flex-col">
      <!-- ─── TOP AREA: TAB SWITCHER (Blue Banner Mockup style) ─── -->
      <div class="mb-5">
        <div class="flex bg-[#3b65b9] p-1 rounded-none shadow-md">
          <button
            type="button"
            @click="activeTab = 'checklist'"
            :class="[activeTab === 'checklist' ? 'bg-[#214389] text-white font-bold' : 'text-slate-100/90 font-medium hover:text-white']"
            class="flex-1 py-3 text-xs text-center border-0 cursor-pointer outline-none transition-all"
          >
            {{ t('page.portal.checklistTitle') }} ({{ myChecklistSessions.length }})
          </button>
          <button
            type="button"
            @click="activeTab = 'maintenance'"
            :class="[activeTab === 'maintenance' ? 'bg-[#214389] text-white font-bold' : 'text-slate-100/90 font-medium hover:text-white']"
            class="flex-1 py-3 text-xs text-center border-0 cursor-pointer outline-none transition-all"
          >
            {{ t('page.portal.maintenanceTitle') }} ({{ myMaintenancePlans.length }})
          </button>
        </div>
      </div>

      <!-- ─── MIDDLE CONTENT AREA: SCROLLABLE LIST (Mockup Blue Boxes style) ─── -->
      <div class="flex-1 overflow-y-auto pb-4">
        <Spin :spinning="loading">
          
          <!-- Checklist Tab Content -->
          <div v-if="activeTab === 'checklist'">
            <div v-if="myChecklistSessions.length > 0" class="flex flex-col gap-4">
              <Card
                v-for="session in myChecklistSessions"
                :key="session.id"
                class="rounded-none shadow-sm border-none bg-[#3b65b9] overflow-hidden"
                :body-style="{ padding: '18px' }"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-bold text-white truncate m-0 leading-snug">
                      {{ session.name || session.equipment?.name || t('page.portal.cellButtonLabel') }}
                    </h3>
                    <p class="text-[11px] text-white font-bold font-mono mt-2 mb-0">
                      {{ t('page.portal.codeLabel') }}: {{ session.equipment?.code || '—' }} <span v-if="session.equipment?.name" class="text-white/90 font-normal">— {{ session.equipment.name }}</span>
                    </p>
                    <p class="text-[10px] text-white mt-1.5 mb-0 font-medium">
                      {{ t('page.portal.dateLabel') }}: {{ session.session_date || '—' }}
                    </p>
                  </div>
                  
                  <!-- Custom CSS Span instead of Tag to bypass light-theme color override -->
                  <span :class="[getSessionStatusTag(session).bgClass]" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-none shrink-0 border border-solid border-white text-white">
                    {{ getSessionStatusTag(session).label }}
                  </span>
                </div>

                <div class="flex justify-between items-center text-xs text-white mt-4">
                  <span class="font-bold text-[11px]">
                    {{ t('page.portal.cycleLabel') }}: {{ getCycleText(session.cycle_type) }}
                    <span v-if="session.cycle_interval && session.cycle_interval > 1">(interval: {{ session.cycle_interval }})</span>
                  </span>
                  <span class="font-bold text-[11px]">{{ t('page.portal.itemsLabel') }}: {{ getCompletedCount(session) }}/{{ session.details?.length || 0 }}</span>
                </div>

                <div class="mt-2.5">
                  <Progress
                    :percent="getProgressPercent(session)"
                    :show-info="false"
                    size="small"
                    class="m-0"
                    stroke-color="#ffffff"
                    trail-color="rgba(255, 255, 255, 0.4)"
                  />
                </div>

                <div class="flex items-center gap-2 mt-4.5">
                  <Button
                    type="primary"
                    class="flex-1 bg-[#214389] hover:bg-[#152e60] border-none text-xs h-9 rounded-none font-bold flex items-center justify-center gap-1.5 text-white"
                    @click="router.push('/portal/checklist')"
                  >
                    {{ t('page.portal.btnStart') }}
                  </Button>
                </div>
              </Card>
            </div>

            <div v-else class="py-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-none text-center px-4">
              <Empty :description="t('page.portal.noChecklistsAssigned')" />
            </div>
          </div>

          <!-- Maintenance Tab Content -->
          <div v-if="activeTab === 'maintenance'">
            <div v-if="myMaintenancePlans.length > 0" class="flex flex-col gap-4">
              <Card
                v-for="group in myMaintenancePlans"
                :key="group.key"
                class="rounded-none shadow-sm border-none bg-[#3b65b9] overflow-hidden"
                :body-style="{ padding: '18px' }"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-bold text-white truncate m-0 leading-snug">
                      {{ group.plan_code }}
                    </h3>
                    <p class="text-[11px] text-white font-bold font-mono mt-2 mb-0">
                      {{ t('page.portal.equipmentLabel') }}: {{ group.equipment_code }} <span v-if="group.equipment_name" class="text-white/90 font-normal">— {{ group.equipment_name }}</span>
                    </p>
                    <p class="text-[10px] text-white mt-1.5 mb-0 font-medium">
                      {{ t('page.portal.dateLabel') }}: {{ group.date }}
                    </p>
                  </div>
                  
                  <!-- Custom CSS Span instead of Tag to bypass light-theme color override -->
                  <span :class="[getPlanStatusTag(group).bgClass]" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-none shrink-0 border border-solid border-white text-white">
                    {{ getPlanStatusTag(group).label }}
                  </span>
                </div>

                <div class="flex justify-between items-center text-xs text-white mt-4">
                  <span class="font-bold text-[11px]">
                    {{ t('page.portal.typeLabel') }}: {{ group.maintenance_type || t('page.dashboard.normal') }}
                  </span>
                  <span class="font-bold text-[11px]">{{ t('page.portal.itemsLabel') }}: {{ group.completed_items }}/{{ group.total_items }}</span>
                </div>

                <div class="mt-2.5">
                  <Progress
                    :percent="getProgressPercentForPlan(group)"
                    :show-info="false"
                    size="small"
                    class="m-0"
                    stroke-color="#ffffff"
                    trail-color="rgba(255, 255, 255, 0.4)"
                  />
                </div>

                <div class="flex items-center gap-2 mt-4.5">
                  <Button
                    type="primary"
                    class="flex-1 bg-[#214389] hover:bg-[#152e60] border-none text-xs h-9 rounded-none font-bold flex items-center justify-center gap-1.5 text-white"
                    @click="router.push('/portal/maintain-plan')"
                  >
                    {{ t('page.portal.btnExecute') }}
                  </Button>
                </div>
              </Card>
            </div>

            <div v-else class="py-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-none text-center px-4">
              <Empty :description="t('page.portal.noMaintenanceAssigned')" />
            </div>
          </div>

        </Spin>
      </div>
    </div>

    <!-- ─── FIXED BOTTOM ACTION BAR ─── -->
    <div class="fixed bottom-0 left-0 right-0 h-20 bg-slate-50 dark:bg-zinc-950 px-4 flex items-center z-30 border-t border-slate-200/80 dark:border-zinc-800/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div class="grid grid-cols-3 gap-3 w-full items-center">
        
        <!-- Báo cáo sự cố -->
        <button
          type="button"
          @click="router.push('/portal/incident-report')"
          class="h-14 w-full bg-[#3b65b9] hover:bg-[#214389] text-white font-bold text-xs border-0 rounded-none outline-none transition-colors select-none flex items-center justify-center"
        >
          {{ t('page.portal.reportIncident') }}
        </button>

        <!-- Center Scan Button -->
        <div class="flex justify-center items-center">
          <button
            type="button"
            @click="router.push('/portal/equipment')"
            class="w-14 h-14 bg-black hover:bg-zinc-900 active:scale-95 text-white rounded-full flex items-center justify-center border-0 cursor-pointer outline-none transition-all duration-200"
            style="margin-bottom: -20px;"
          >
            <!-- V logo icon -->
            <span class="text-white font-black text-xl select-none font-sans">V</span>
          </button>
        </div>

        <!-- Dừng khẩn cấp -->
        <button
          type="button"
          @click="router.push('/portal/emergency-stop')"
          class="h-14 w-full bg-[#3b65b9] hover:bg-[#214389] text-white font-bold text-xs border-0 rounded-none outline-none transition-colors select-none flex items-center justify-center"
        >
          {{ t('page.portal.emergencyStop') }}
        </button>

      </div>
    </div>

  </div>
</template>

<style scoped>
.portal-container {
  padding: 16px;
  position: relative;
}
</style>
