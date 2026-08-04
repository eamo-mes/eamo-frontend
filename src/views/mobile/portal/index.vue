<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Spin, Empty } from "ant-design-vue";
import dayjs from "dayjs";
import { useI18n } from "@vben/locales";

import { getChecklistSessionsApi } from "#/api/ops/checklist";
import { listMaintenanceSchedulesApi } from "#/api/ops/maintenance-plans";
import type {
  ChecklistSession,
  ChecklistDetailItem,
  ChecklistLog,
  ScheduleRow,
} from "#/views/dashboard/workspace/types";

defineOptions({ name: "MobilePortalHome" });

const router = useRouter();
const { t } = useI18n();
const activeTab = ref<"checklist" | "maintenance">("checklist");
const loading = ref(false);

const checklistSessions = ref<ChecklistSession[]>([]);

interface MaintenancePlanGroup {
  key: string;
  plan_id: string;
  plan_code: string;
  date: string;
  equipment_code: string;
  equipment_name: string | null;
  maintenance_type: string;
  schedules: ScheduleRow[];
  total_items: number;
  completed_items: number;
  status: "pass" | "fail" | "pending";
  users: Array<{ id: string; name?: string }>;
}

const maintenanceSchedules = ref<MaintenancePlanGroup[]>([]);

// ─── Touch Gesture Logic for Swipe Switching ───
const touchStartX = ref(0);
const touchStartY = ref(0);

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches?.[0];
  if (touch) {
    touchStartX.value = touch.clientX;
    touchStartY.value = touch.clientY;
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (!e.changedTouches || e.changedTouches.length === 0) return;
  const endTouch = e.changedTouches[0];
  if (!endTouch) return;
  const deltaX = endTouch.clientX - touchStartX.value;
  const deltaY = endTouch.clientY - touchStartY.value;

  // Swipe left -> Maintenance, Swipe right -> Checklist
  if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
    if (deltaX < 0 && activeTab.value === "checklist") {
      activeTab.value = "maintenance";
    } else if (deltaX > 0 && activeTab.value === "maintenance") {
      activeTab.value = "checklist";
    }
  }
}

// ─── Fetch Checklist Sessions (Loaded identically to /portal/checklist for today) ───
async function fetchChecklists() {
  try {
    const todayStr = dayjs().format("YYYY-MM-DD");
    const raw = await getChecklistSessionsApi({
      include_details: true,
      start_date: todayStr,
      end_date: todayStr,
      per_page: 100,
    });
    const responseData =
      (raw as { data?: ChecklistSession[]; items?: ChecklistSession[] })
        ?.data ??
      (raw as { items?: ChecklistSession[] })?.items ??
      (Array.isArray(raw) ? raw : []);
    const sessions = Array.isArray(responseData)
      ? (responseData as ChecklistSession[])
      : [];

    // Sort by session_date descending (latest first)
    checklistSessions.value = sessions.sort((a, b) =>
      (b.session_date || "").localeCompare(a.session_date || ""),
    );
  } catch (err: unknown) {
    console.error("Failed to fetch checklists:", err);
  }
}

// ─── Fetch Maintenance Schedules (Loaded identically to /portal/maintain-plan for today) ───
async function fetchMaintenance() {
  try {
    const todayStr = dayjs().format("YYYY-MM-DD");
    const rawSchedules = await listMaintenanceSchedulesApi({
      start_date: todayStr,
      end_date: todayStr,
      with_logs: true,
    });
    const scheduleArray = Array.isArray(rawSchedules)
      ? (rawSchedules as ScheduleRow[])
      : [];
    maintenanceSchedules.value = groupSchedulesByPlan(scheduleArray, todayStr);
  } catch (err: unknown) {
    console.error("Failed to fetch maintenance:", err);
  }
}

// Helper: Group maintenance schedules
function getLatestResult(schedule: ScheduleRow): string | null {
  if (schedule.maintenance_logs && schedule.maintenance_logs.length > 0) {
    const logRes = schedule.maintenance_logs[0]?.result;
    if (logRes && logRes !== "Pending" && logRes !== "pending") {
      return logRes;
    }
  }
  if (
    schedule.result &&
    schedule.result !== "Pending" &&
    schedule.result !== "pending"
  ) {
    return schedule.result;
  }
  return null;
}

function groupSchedulesByPlan(
  rows: ScheduleRow[],
  dateStr: string,
): MaintenancePlanGroup[] {
  const planMap = new Map<string, MaintenancePlanGroup>();
  const planItemSeenMap = new Map<string, Set<string>>();
  const dayRows = rows.filter((s) => s.date && s.date.startsWith(dateStr));

  for (const s of dayRows) {
    const planKey = s.maintenance_plan_id || s.plan_code || s.id || "unknown";
    const itemKey =
      s.maintenance_item_id ||
      s.item_name ||
      s.maintenance_item?.name ||
      s.id ||
      "";

    if (!planItemSeenMap.has(planKey)) {
      planItemSeenMap.set(planKey, new Set());
    }
    const itemSeenSet = planItemSeenMap.get(planKey)!;
    if (itemSeenSet.has(itemKey)) {
      continue;
    }
    itemSeenSet.add(itemKey);

    const latestRes = getLatestResult(s);
    const isPassed =
      latestRes === "Completed" ||
      latestRes === "completed" ||
      latestRes === "pass" ||
      latestRes === "normal";
    const isFailed =
      latestRes === "Failed" ||
      latestRes === "failed" ||
      latestRes === "fail" ||
      latestRes === "abnormal";
    const isCompleted = isPassed || isFailed;

    const eqCode =
      s.equipment_code || s.maintenance_plan?.equipment?.code || "—";
    const eqName =
      s.equipment_name || s.maintenance_plan?.equipment?.name || null;
    const planCode =
      s.plan_code || s.maintenance_plan?.plan_code || "KẾ HOẠCH BẢO TRÌ";
    const mType =
      s.maintenance_type || s.maintenance_plan?.maintenance_type || "—";
    const users = (s.users || s.maintenance_plan?.users || []) as Array<{
      id: string;
      name?: string;
    }>;

    if (!planMap.has(planKey)) {
      planMap.set(planKey, {
        key: `plan-${planKey}-${dateStr}`,
        plan_id: s.maintenance_plan_id || "",
        plan_code: planCode,
        date: dateStr,
        equipment_code: eqCode,
        equipment_name: eqName,
        maintenance_type: mType,
        schedules: [s],
        total_items: 1,
        completed_items: isPassed ? 1 : 0,
        status: isFailed ? "fail" : isPassed ? "pass" : "pending",
        users,
      });
    } else {
      const node = planMap.get(planKey)!;
      node.schedules.push(s);
      node.total_items += 1;
      if (isPassed) {
        node.completed_items += 1;
      }

      if (isFailed || node.status === "fail") {
        node.status = "fail";
      } else if (
        node.completed_items === node.total_items &&
        node.total_items > 0
      ) {
        node.status = "pass";
      } else {
        node.status = "pending";
      }
    }
  }

  return Array.from(planMap.values());
}

// ─── Checklist Status & Progress Logic (Identical to /portal/checklist) ───
function getLatestCompletedLog(
  detail: ChecklistDetailItem & {
    schedules?: Array<{ logs?: ChecklistLog[] }>;
  },
): ChecklistLog | undefined {
  let logs: ChecklistLog[] = detail.logs || [];
  if (logs.length === 0 && detail.schedules && detail.schedules.length > 0) {
    logs = detail.schedules.flatMap((s) => s.logs || []);
  }
  return logs
    .filter((log) => log.status === "completed")
    .sort((left, right) =>
      (left.checked_at ?? "").localeCompare(right.checked_at ?? ""),
    )
    .at(-1);
}

function getSessionStatus(
  session: ChecklistSession,
): "pass" | "fail" | "pending" {
  if (!session.details || session.details.length === 0) return "pending";
  const hasFail = session.details.some(
    (d) => getLatestCompletedLog(d)?.result === "fail",
  );
  if (hasFail) return "fail";
  const allPassed = session.details.every(
    (d) => getLatestCompletedLog(d)?.result === "pass",
  );
  return allPassed ? "pass" : "pending";
}

function getPassCount(session: ChecklistSession): number {
  if (!session.details) return 0;
  return session.details.filter(
    (d) => getLatestCompletedLog(d)?.result === "pass",
  ).length;
}

function getProgressPercent(session: ChecklistSession): number {
  if (!session.details || session.details.length === 0) return 0;
  return Math.round((getPassCount(session) / session.details.length) * 100);
}

function getProgressColor(session: ChecklistSession): string {
  const status = getSessionStatus(session);
  if (status === "fail") return "#f5222d";
  const percent = getProgressPercent(session);
  if (percent >= 100) return "#52c41a";
  return "#1890ff";
}

function getProgressPercentForPlan(group: MaintenancePlanGroup): number {
  if (!group.total_items) return 0;
  return Math.round((group.completed_items / group.total_items) * 100);
}

function getProgressColorForPlan(group: MaintenancePlanGroup): string {
  if (group.status === "fail") return "#f5222d";
  const percent = getProgressPercentForPlan(group);
  if (percent >= 100) return "#52c41a";
  return "#1890ff";
}

function goToChecklistDetail(session: ChecklistSession) {
  if (session.id) {
    router.push(`/portal/checklist/${session.id}`);
  }
}

function goToMaintainPlanDetail(group: MaintenancePlanGroup) {
  const targetId = group.plan_id || group.plan_code;
  router.push(`/portal/maintain-plan/${targetId}?date=${group.date}`);
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
  <div
    class="min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 flex flex-col pb-28 select-none"
  >
    <!-- ─── HEADER: date chip + underline tabs ─── -->
    <div
      class="bg-white dark:bg-zinc-900 border-b border-slate-200/70 dark:border-zinc-800 px-4 pt-4 pb-0"
    >
      <!-- Underline tab bar -->
      <div class="flex">
        <button
          type="button"
          @click="activeTab = 'checklist'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 pb-3 text-xs font-bold border-0 bg-transparent cursor-pointer outline-none transition-all duration-200',
            activeTab === 'checklist'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 -mb-px'
              : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300',
          ]"
        >
          {{ t("page.portal.checklistTitle") || "Kiểm tra" }}
          <span
            :class="[
              'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums',
              activeTab === 'checklist'
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500',
            ]"
            >{{ checklistSessions.length }}</span
          >
        </button>

        <button
          type="button"
          @click="activeTab = 'maintenance'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 pb-3 text-xs font-bold border-0 bg-transparent cursor-pointer outline-none transition-all duration-200',
            activeTab === 'maintenance'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 -mb-px'
              : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300',
          ]"
        >
          {{ t("page.portal.maintenanceTitle") || "Bảo trì" }}
          <span
            :class="[
              'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums',
              activeTab === 'maintenance'
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500',
            ]"
            >{{ maintenanceSchedules.length }}</span
          >
        </button>
      </div>
    </div>

    <!-- ─── CONTENT WITH SWIPE & SLIDE TRANSITION ─── -->
    <div
      class="flex-1 overflow-hidden pt-4"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <Spin :spinning="loading">
        <div
          class="flex w-[200%] transition-transform duration-300 ease-out"
          :style="{
            transform:
              activeTab === 'checklist' ? 'translateX(0%)' : 'translateX(-50%)',
          }"
        >
          <!-- Checklist Slide -->
          <div class="w-1/2 px-4 shrink-0">
            <div v-if="checklistSessions.length > 0" class="space-y-3">
              <div
                v-for="session in checklistSessions"
                :key="session.id"
                class="group flex items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl px-3.5 py-3.5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800/60 hover:shadow-sm active:scale-[0.99] transition-all duration-150"
                @click="goToChecklistDetail(session)"
              >
                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight"
                  >
                    {{ session.name || session.equipment?.name || "—" }}
                  </p>
                  <p
                    class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 mb-0 truncate"
                  >
                    {{ session.equipment?.code || "—" }}
                  </p>
                </div>

                <!-- Progress ring -->
                <div
                  class="shrink-0 w-10 h-10 relative flex items-center justify-center"
                >
                  <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke-width="2.5"
                      class="stroke-slate-100 dark:stroke-zinc-800"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke-width="2.5"
                      :stroke="getProgressColor(session)"
                      :stroke-dasharray="`${getProgressPercent(session) * 0.974} 97.4`"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span
                    class="absolute text-[9px] font-bold text-slate-600 dark:text-zinc-400"
                  >
                    {{ getProgressPercent(session) }}%
                  </span>
                </div>

                <!-- Chevron -->
                <svg
                  class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 shrink-0 group-hover:text-indigo-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m9 18 6-6-6-6"
                  />
                </svg>
              </div>
            </div>

            <div
              v-else
              class="py-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl"
            >
              <Empty
                :description="
                  t('page.portal.noChecklistsAssigned') ||
                  'Không có phiên kiểm tra nào hôm nay'
                "
              />
            </div>
          </div>

          <!-- Maintenance Slide -->
          <div class="w-1/2 px-4 shrink-0">
            <div v-if="maintenanceSchedules.length > 0" class="space-y-3">
              <div
                v-for="group in maintenanceSchedules"
                :key="group.key"
                class="group flex items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl px-3.5 py-3.5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800/60 hover:shadow-sm active:scale-[0.99] transition-all duration-150"
                @click="goToMaintainPlanDetail(group)"
              >
                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate m-0 leading-tight"
                  >
                    {{ group.plan_code }}
                  </p>
                  <p
                    class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 mb-0 truncate"
                  >
                    {{ group.equipment_code }}
                    <span class="text-slate-300 dark:text-zinc-600 mx-1"
                      >·</span
                    >
                    {{ group.maintenance_type }}
                  </p>
                </div>

                <!-- Progress ring -->
                <div
                  class="shrink-0 w-10 h-10 relative flex items-center justify-center"
                >
                  <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke-width="2.5"
                      class="stroke-slate-100 dark:stroke-zinc-800"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke-width="2.5"
                      :stroke="getProgressColorForPlan(group)"
                      :stroke-dasharray="`${getProgressPercentForPlan(group) * 0.974} 97.4`"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span
                    class="absolute text-[9px] font-bold text-slate-600 dark:text-zinc-400"
                  >
                    {{ getProgressPercentForPlan(group) }}%
                  </span>
                </div>

                <!-- Chevron -->
                <svg
                  class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 shrink-0 group-hover:text-indigo-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m9 18 6-6-6-6"
                  />
                </svg>
              </div>
            </div>

            <div
              v-else
              class="py-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl"
            >
              <Empty
                :description="
                  t('page.portal.noMaintenanceAssigned') ||
                  'Không có kế hoạch bảo trì hôm nay'
                "
              />
            </div>
          </div>
        </div>
      </Spin>
    </div>

    <!-- ─── BOTTOM BAR ─── -->
    <div
      class="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-zinc-800/60"
    >
      <div class="px-4 pt-2.5 pb-4 grid grid-cols-2 gap-2">
        <!-- Báo cáo sự cố -->
        <button
          type="button"
          @click="router.push('/portal/incident-report')"
          class="h-11 flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 cursor-pointer outline-none transition-all hover:bg-indigo-100 dark:hover:bg-indigo-900/60 active:scale-95 select-none"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <span class="text-[11px] font-bold tracking-wide">{{
            t("page.portal.reportIncident") || "Báo cáo sự cố"
          }}</span>
        </button>

        <!-- Dừng khẩn cấp -->
        <button
          type="button"
          @click="router.push('/portal/emergency-stop')"
          class="h-11 flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/70 dark:border-red-800/50 text-red-600 dark:text-red-400 cursor-pointer outline-none transition-all hover:bg-red-100 dark:hover:bg-red-900/60 active:scale-95 select-none"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
            />
          </svg>
          <span class="text-[11px] font-bold tracking-wide">{{
            t("page.portal.emergencyStop") || "Dừng khẩn cấp"
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-spin-container) {
  padding-bottom: 8px;
}
</style>
