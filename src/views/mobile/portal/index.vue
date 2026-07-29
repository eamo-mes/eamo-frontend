<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Card,
  Tag,
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
  if (!session.details || session.details.length === 0) return { color: 'warning', label: t('page.portal.statusPending') || 'Chưa xong' };
  
  const completedCount = session.details.filter((d: any) => {
    const logs = d.logs || [];
    return logs.some((log: any) => log.status === 'completed');
  }).length;
  
  const allCompleted = completedCount === session.details.length;
  if (!allCompleted) return { color: 'warning', label: t('page.portal.statusPending') || 'Chưa xong' };
  
  const allPassed = session.details.every((d: any) => {
    const logs = d.logs || [];
    const latestLog = logs.filter((log: any) => log.status === 'completed').sort((l: any, r: any) => (l.checked_at ?? '').localeCompare(r.checked_at ?? '')).at(-1);
    return latestLog?.result === 'pass';
  });
  return allPassed ? { color: 'success', label: t('page.portal.statusPass') || 'Đạt' } : { color: 'error', label: t('page.portal.statusFail') || 'Không đạt' };
}

function getPlanStatusTag(group: any) {
  if (group.status === 'pass') {
    return { color: 'success', label: t('page.portal.statusPass') || 'Đạt' };
  } else if (group.status === 'fail') {
    return { color: 'error', label: t('page.portal.statusFail') || 'Không đạt' };
  }
  return { color: 'warning', label: t('page.portal.statusPending') || 'Chưa xong' };
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
  <div class="portal-container min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-24 relative flex flex-col transition-colors duration-300">

    <div class="relative z-10 w-full flex-1 flex flex-col">
      <!-- ─── TOP AREA: FILTER TABS ─── -->
      <div class="mb-4 flex items-center gap-1.5 p-1 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl shadow-3xs">
        <button
          type="button"
          @click="activeTab = 'checklist'"
          :class="[
            'flex-1 py-2 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer outline-none',
            activeTab === 'checklist'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          ]"
        >
          {{ t('page.portal.checklistTitle') }} ({{ myChecklistSessions.length }})
        </button>
        <button
          type="button"
          @click="activeTab = 'maintenance'"
          :class="[
            'flex-1 py-2 text-xs font-bold rounded-lg transition-colors border-0 cursor-pointer outline-none',
            activeTab === 'maintenance'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-transparent text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          ]"
        >
          {{ t('page.portal.maintenanceTitle') }} ({{ myMaintenancePlans.length }})
        </button>
      </div>

      <!-- ─── MIDDLE CONTENT AREA: CLICKABLE CARDS ─── -->
      <div class="flex-1 overflow-y-auto pb-4">
        <Spin :spinning="loading">
          
          <!-- Checklist Tab Content -->
          <div v-if="activeTab === 'checklist'">
            <div v-if="myChecklistSessions.length > 0" class="flex flex-col gap-3.5">
              <Card
                v-for="session in myChecklistSessions"
                :key="session.id"
                class="rounded-2xl shadow-3xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                :body-style="{ padding: '16px' }"
                @click="router.push('/portal/checklist')"
              >
                <div class="flex items-start justify-between gap-3 mb-1">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-xs font-bold text-slate-800 dark:text-zinc-200 m-0 leading-snug">
                      {{ session.name || session.equipment?.name || t('page.portal.cellButtonLabel') }}
                    </h3>
                    <p class="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1 mb-0 font-medium">
                      {{ t('page.portal.codeLabel') }}: <span class="font-bold text-slate-700 dark:text-zinc-300">{{ session.equipment?.code || '—' }}</span>
                      <span v-if="session.equipment?.name" class="text-slate-400"> — {{ session.equipment.name }}</span>
                    </p>
                  </div>

                  <Tag :color="getSessionStatusTag(session).color" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    {{ getSessionStatusTag(session).label }}
                  </Tag>
                </div>

                <div class="flex justify-between items-center text-[11px] text-slate-500 dark:text-zinc-400 mt-2.5">
                  <span>
                    {{ t('page.portal.cycleLabel') }}: <strong class="text-slate-700 dark:text-zinc-300">{{ getCycleText(session.cycle_type) }}</strong>
                  </span>
                  <span>
                    {{ t('page.portal.itemsLabel') }}: <strong class="text-slate-700 dark:text-zinc-300">{{ getCompletedCount(session) }}/{{ session.details?.length || 0 }}</strong>
                  </span>
                </div>

                <div class="mt-2">
                  <Progress
                    :percent="getProgressPercent(session)"
                    :show-info="false"
                    size="small"
                    class="m-0"
                    stroke-color="#4f46e5"
                    trail-color="#f1f5f9"
                  />
                </div>

                <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                  <span>{{ t('page.portal.dateLabel') }}: {{ session.session_date || '—' }}</span>
                </div>
              </Card>
            </div>

            <div v-else class="py-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
              <Empty :description="t('page.portal.noChecklistsAssigned')" />
            </div>
          </div>

          <!-- Maintenance Tab Content -->
          <div v-if="activeTab === 'maintenance'">
            <div v-if="myMaintenancePlans.length > 0" class="flex flex-col gap-3.5">
              <Card
                v-for="group in myMaintenancePlans"
                :key="group.key"
                class="rounded-2xl shadow-3xs border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                :body-style="{ padding: '16px' }"
                @click="router.push('/portal/maintain-plan')"
              >
                <div class="flex items-start justify-between gap-3 mb-1">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-xs font-bold text-slate-800 dark:text-zinc-200 m-0 leading-snug">
                      {{ group.plan_code }}
                    </h3>
                    <p class="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1 mb-0 font-medium">
                      {{ t('page.portal.equipmentLabel') }}: <span class="font-bold text-slate-700 dark:text-zinc-300">{{ group.equipment_code }}</span>
                      <span v-if="group.equipment_name" class="text-slate-400"> — {{ group.equipment_name }}</span>
                    </p>
                  </div>

                  <Tag :color="getPlanStatusTag(group).color" class="m-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    {{ getPlanStatusTag(group).label }}
                  </Tag>
                </div>

                <div class="flex justify-between items-center text-[11px] text-slate-500 dark:text-zinc-400 mt-2.5">
                  <span>
                    {{ t('page.portal.typeLabel') }}: <strong class="text-slate-700 dark:text-zinc-300">{{ group.maintenance_type || t('page.dashboard.normal') }}</strong>
                  </span>
                  <span>
                    {{ t('page.portal.itemsLabel') }}: <strong class="text-slate-700 dark:text-zinc-300">{{ group.completed_items }}/{{ group.total_items }}</strong>
                  </span>
                </div>

                <div class="mt-2">
                  <Progress
                    :percent="getProgressPercentForPlan(group)"
                    :show-info="false"
                    size="small"
                    class="m-0"
                    stroke-color="#4f46e5"
                    trail-color="#f1f5f9"
                  />
                </div>

                <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                  <span>{{ t('page.portal.dateLabel') }}: {{ group.date }}</span>
                </div>
              </Card>
            </div>

            <div v-else class="py-12 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
              <Empty :description="t('page.portal.noMaintenanceAssigned')" />
            </div>
          </div>

        </Spin>
      </div>
    </div>

    <!-- ─── FIXED BOTTOM ACTION BAR (50% / 50% split) ─── -->
    <div class="fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-zinc-900/95 px-4 flex items-center z-30 border-t border-slate-200/80 dark:border-zinc-800/80 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] backdrop-blur-md">
      <div class="grid grid-cols-2 gap-3 w-full items-center">
        
        <!-- Báo cáo sự cố (50% width) -->
        <button
          type="button"
          @click="router.push('/portal/incident-report')"
          class="h-12 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs border-0 rounded-xl outline-none transition-colors select-none flex items-center justify-center shadow-xs cursor-pointer"
        >
          {{ t('page.portal.reportIncident') }}
        </button>

        <!-- Dừng khẩn cấp (50% width) -->
        <button
          type="button"
          @click="router.push('/portal/emergency-stop')"
          class="h-12 w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs border-0 rounded-xl outline-none transition-colors select-none flex items-center justify-center shadow-xs cursor-pointer"
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
:deep(.ant-card) {
  margin-bottom: 0 !important;
}
</style>
