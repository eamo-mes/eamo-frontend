<script lang="ts" setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Card, Spin, Dropdown, Menu, message } from 'ant-design-vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import type { EchartsUIType } from '@vben/plugins/echarts';
import {
  getUserTodaySchedulesApi,
  completeChecklistScheduleApi,
  completeMaintenanceScheduleApi
} from '#/api/core/notification';
import { $t } from '#/locales';

const props = withDefaults(
  defineProps<{
    activeTab?: 'maintenance' | 'checklist';
  }>(),
  {
    activeTab: 'maintenance',
  }
);

const emit = defineEmits(['task-completed']);
const router = useRouter();
const loading = ref(false);

const checklistTasks = ref<any[]>([]);
const maintenanceTasks = ref<any[]>([]);

// Passed vs Total calculations for Checklist
const passedChecklists = computed(() => checklistTasks.value.filter(t => t.is_completed && t.result === 'pass').length);
const failedChecklists = computed(() => checklistTasks.value.filter(t => t.is_completed && t.result === 'fail').length);
const pendingChecklists = computed(() => checklistTasks.value.filter(t => !t.is_completed).length);
const totalChecklists = computed(() => checklistTasks.value.length);
const checklistPercentage = computed(() => totalChecklists.value > 0 ? Math.round((passedChecklists.value / totalChecklists.value) * 100) : 0);

// Passed vs Total calculations for Maintenance
const passedMaintenances = computed(() => maintenanceTasks.value.filter(t => t.is_completed && t.result === 'Completed').length);
const pendingMaintenances = computed(() => maintenanceTasks.value.filter(t => !t.is_completed).length);
const totalMaintenances = computed(() => maintenanceTasks.value.length);
const maintenancePercentage = computed(() => totalMaintenances.value > 0 ? Math.round((passedMaintenances.value / totalMaintenances.value) * 100) : 0);

// Active list & stats based on activeTab
const activeTasks = computed(() => props.activeTab === 'checklist' ? checklistTasks.value : maintenanceTasks.value);
const activeTotal = computed(() => props.activeTab === 'checklist' ? totalChecklists.value : totalMaintenances.value);
const activePassed = computed(() => props.activeTab === 'checklist' ? passedChecklists.value : passedMaintenances.value);
const activePercentage = computed(() => props.activeTab === 'checklist' ? checklistPercentage.value : maintenancePercentage.value);

// Single Pie Chart Ref & Hook
const pieChartRef = ref<EchartsUIType>();
const { renderEcharts: renderPieChart } = useEcharts(pieChartRef);

async function loadAllData() {
  loading.value = true;
  try {
    const data = await getUserTodaySchedulesApi();
    checklistTasks.value = data.checklist_schedules || [];
    maintenanceTasks.value = data.maintenance_schedules || [];
    
    await nextTick();
    updatePieChart();
  } catch (error) {
    console.error('Failed to load today schedules:', error);
  } finally {
    loading.value = false;
  }
}

// Render dynamic Echarts Donut Pie Chart
function updatePieChart() {
  if (!pieChartRef.value) return;

  const isChecklist = props.activeTab === 'checklist';

  const chartData = isChecklist
    ? [
        { value: passedChecklists.value, name: $t('page.ops.resultPass'), itemStyle: { color: '#10b981' } },
        { value: failedChecklists.value, name: $t('page.ops.resultFail'), itemStyle: { color: '#f43f5e' } },
        { value: pendingChecklists.value, name: $t('page.dashboard.statusPending'), itemStyle: { color: '#f59e0b' } },
      ]
    : [
        { value: passedMaintenances.value, name: $t('page.dashboard.statusCompleted'), itemStyle: { color: '#10b981' } },
        { value: pendingMaintenances.value, name: $t('page.dashboard.statusPending'), itemStyle: { color: '#f59e0b' } },
      ];

  renderPieChart({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      textStyle: { fontSize: 12 }
    },
    legend: {
      bottom: '0%',
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#64748b' }
    },
    series: [
      {
        name: isChecklist ? 'Checklist Status' : 'Maintenance Status',
        type: 'pie',
        radius: ['48%', '75%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'center',
          formatter: () => `${activePercentage.value}%\nProgress`,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#334155',
          lineHeight: 18
        },
        emphasis: {
          scale: true,
          scaleSize: 5,
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: chartData
      }
    ],
    textStyle: {
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }
  });
}

// Watch activeTab and task stats changes to update chart
watch([() => props.activeTab, checklistPercentage, maintenancePercentage, passedChecklists, failedChecklists, passedMaintenances], () => {
  nextTick(() => {
    updatePieChart();
  });
});

onMounted(() => {
  loadAllData();
});

function handleTaskAction(type: 'maintenance' | 'checklist', item: any) {
  if (type === 'checklist') {
    const sessionId = item.checklist_session_id || item.id;
    router.push({ name: 'OpsCheckListDetail', query: { id: sessionId } });
  } else {
    router.push({ name: 'OpsMaintenancePlans' });
  }
}

async function handleQuickComplete(type: 'maintenance' | 'checklist', id: string) {
  loading.value = true;
  try {
    if (type === 'checklist') {
      await completeChecklistScheduleApi(id);
    } else {
      await completeMaintenanceScheduleApi(id);
    }
    message.success($t('page.ops.drawerSaveSuccess'));
    await loadAllData();
    emit('task-completed');
  } catch (error: any) {
    console.error('Failed to quick complete task:', error);
    const apiError = error?.response?.data?.message;
    message.error(apiError || 'Không thể đánh dấu hoàn thành');
  } finally {
    loading.value = false;
  }
}

defineExpose({
  loadAllData
});
</script>

<template>
  <Spin :spinning="loading" size="small">
    <Card :bordered="false" class="workspace-panel shadow-sm rounded-xl border border-slate-100 dark:border-slate-800 w-full overflow-hidden">
      <template #title>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-slate-800 dark:text-slate-100 text-sm tracking-tight">
              {{ activeTab === 'checklist' ? $t('page.dashboard.chkPending') : $t('page.dashboard.mPlans') }}
            </span>
          </div>
          <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            {{ activePassed }} / {{ activeTotal }}
          </span>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center min-h-[220px]">
        <!-- Left Column: Pie Chart -->
        <div class="md:col-span-5 lg:col-span-4 h-[210px] relative flex flex-col justify-center items-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800/60 pb-4 md:pb-0 md:pr-4">
          <div class="w-full h-full">
            <EchartsUI ref="pieChartRef" height="200px" />
          </div>
        </div>

        <!-- Right Column: Task List -->
        <div class="md:col-span-7 lg:col-span-8 flex flex-col h-[210px] min-h-0">
          <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2.5 flex-shrink-0">
            {{ activeTab === 'checklist' ? $t('page.dashboard.todayChecklistList') : $t('page.dashboard.todayMaintenanceList') }}
          </span>

          <!-- Empty State -->
          <div v-if="activeTasks.length === 0" class="flex-1 flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-600">
            <p class="text-xs m-0">
              {{ activeTab === 'checklist' ? $t('page.dashboard.noChecklistsToday') : $t('page.dashboard.noMaintenanceToday') }}
            </p>
          </div>

          <!-- Task List -->
          <div v-else class="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
            <div 
              v-for="task in activeTasks" 
              :key="task.id"
              class="task-row flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer"
              @click="handleTaskAction(activeTab, task)"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="status-indicator"
                  :class="!task.is_completed ? 'status-indicator--pending' : (task.result === 'fail' ? 'status-indicator--failed' : 'status-indicator--completed')"
                />
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate mb-0.5">
                    {{ activeTab === 'checklist' ? (task.session_name || task.equipment?.name || 'Thiết bị kiểm tra') : (task.equipment?.name || 'Thiết bị bảo trì') }}
                  </p>
                  <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate m-0">
                    {{ activeTab === 'checklist' 
                      ? (task.equipment?.name ? (task.equipment.name + (task.detail?.description ? ' - ' + task.detail.description : '')) : (task.detail?.description || 'Chi tiết checklist'))
                      : (task.item?.name || 'Chi tiết bảo trì') }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center gap-2 flex-shrink-0" @click.stop>
                <span 
                  class="text-[10px] px-2 py-0.5 rounded font-bold"
                  :class="!task.is_completed 
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' 
                    : (task.result === 'fail' 
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' 
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400')"
                >
                  {{ !task.is_completed 
                    ? $t('page.dashboard.statusPending') 
                    : (task.result === 'fail' 
                      ? $t('page.ops.resultFail') 
                      : (task.result === 'pass' ? $t('page.ops.resultPass') : $t('page.dashboard.statusCompleted'))) }}
                </span>

                <!-- 3 Vertical dots dropdown (only if not completed) -->
                <Dropdown v-if="!task.is_completed" :trigger="['click']">
                  <button class="text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800/40 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  <template #overlay>
                    <Menu>
                      <Menu.Item key="complete" @click="handleQuickComplete(activeTab, task.id)">
                        <span class="text-xs font-semibold text-slate-700">{{ $t('page.dashboard.markAsCompleted') }}</span>
                      </Menu.Item>
                    </Menu>
                  </template>
                </Dropdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </Spin>
</template>

<style scoped>
/* ── Scrollbar customization ── */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

:global(.dark) ::-webkit-scrollbar-thumb {
  background: #475569;
}

/* ── Status dot indicator ── */
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator--completed {
  background-color: #10b981; /* emerald-500 */
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.status-indicator--failed {
  background-color: #f43f5e; /* rose-500 */
  box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.2);
}

.status-indicator--pending {
  background-color: #f59e0b; /* amber-500 */
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

/* Ant Design Card override integration */
:deep(.ant-card-head) {
  border-bottom: 1px solid #f1f5f9;
  min-height: 48px;
  padding: 0 16px;
}

:global(.dark) :deep(.ant-card-head) {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

:deep(.ant-card-body) {
  padding: 16px;
}

.workspace-panel {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.workspace-panel:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
}

:global(.dark) .workspace-panel:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.3) !important;
}
</style>
