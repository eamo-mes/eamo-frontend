<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import {
  Modal,
  Select,
  Table,
  Tag,
  Tabs,
  Card,
  Statistic,
  Spin,
  Empty,
  message
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { $t } from '#/locales';
import { fetchEquipmentOverviewApi } from '../api';
import type { EquipmentOption, ParameterLogItem, UnitOption } from '../types';
import WeeklyParameterChart from './WeeklyParameterChart.vue';

const TabPane = Tabs.TabPane;

const props = defineProps<{
  open: boolean;
  equipments: EquipmentOption[];
  units: UnitOption[];
  initialEquipmentId?: string;
  initialTab?: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const loading = ref(false);
const selectedEquipmentId = ref<string | undefined>(undefined);
const overviewLogs = ref<ParameterLogItem[]>([]);
const activeTab = ref('chart');

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      if (props.initialTab) {
        activeTab.value = props.initialTab;
      }
      if (props.initialEquipmentId) {
        selectedEquipmentId.value = props.initialEquipmentId;
      } else if (props.equipments.length > 0 && props.equipments[0] && !selectedEquipmentId.value) {
        selectedEquipmentId.value = props.equipments[0].id;
      }
      if (selectedEquipmentId.value) {
        loadOverview(selectedEquipmentId.value);
      }
    } else {
      overviewLogs.value = [];
    }
  }
);

watch(selectedEquipmentId, (newId) => {
  if (newId && props.open) {
    loadOverview(newId);
  }
});

async function loadOverview(equipmentId: string) {
  loading.value = true;
  try {
    const logs = await fetchEquipmentOverviewApi(equipmentId);
    overviewLogs.value = logs;
  } catch (error) {
    message.error($t('page.ops.loadOverviewError'));
    console.error('Failed to load equipment overview logs', error);
  } finally {
    loading.value = false;
  }
}

function getUnitName(unitId: string | null | undefined): string {
  if (!unitId) return '';
  const u = props.units.find((unit) => unit.id === unitId);
  return u ? ` ${u.name}` : '';
}

function getParamDisplayName(item: ParameterLogItem): { name: string; code: string } {
  const paramObj = item.parameter || item.equipment_parameter;
  const equip = props.equipments.find((e) => e.id === item.equipment_id);
  const metaParam = equip?.equipment_parameters?.find((p) => p.id === item.equipment_parameter_id);

  const name = paramObj?.name || metaParam?.name || item.equipment_parameter_id;
  const code = paramObj?.code || metaParam?.code || '';
  return { name, code };
}

// Compute parameter summary metrics
const parameterMetrics = computed(() => {
  const map = new Map<string, { paramName: string; code: string; count: number; latestValue: string; latestDate: string }>();

  overviewLogs.value.forEach((item) => {
    const key = item.equipment_parameter_id;
    const { name, code } = getParamDisplayName(item);
    const paramName = code ? `${name} (${code})` : name;
    const val = `${item.value}${getUnitName(item.unit_id)}`;
    const dateStr = item.recorded_at ? dayjs(item.recorded_at).format('YYYY-MM-DD HH:mm') : (item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm') : '-');

    if (!map.has(key)) {
      map.set(key, {
        paramName,
        code,
        count: 1,
        latestValue: val,
        latestDate: dateStr,
      });
    } else {
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      }
    }
  });

  return Array.from(map.values());
});

const columns = computed(() => [
  {
    title: $t('page.ops.parameter'),
    dataIndex: 'equipment_parameter_id',
    key: 'parameter',
  },
  {
    title: $t('page.ops.value'),
    dataIndex: 'value',
    key: 'value',
  },
  {
    title: $t('page.ops.recordedAt'),
    dataIndex: 'recorded_at',
    key: 'recorded_at',
  },
]);

function handleClose() {
  emit('update:open', false);
}
</script>

<template>
  <Modal
    :open="props.open"
    :title="$t('page.ops.overviewTitle')"
    width="1060px"
    :footer="null"
    @cancel="handleClose"
  >
    <div class="space-y-4 my-2">
      <!-- Equipment Selector -->
      <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
        <span class="font-medium whitespace-nowrap text-sm">{{ $t('page.ops.colEquipment') }}:</span>
        <Select
          v-model:value="selectedEquipmentId"
          :options="props.equipments"
          :field-names="{ label: 'name', value: 'id' }"
          :placeholder="$t('page.ops.selectEquipment')"
          class="w-72"
          show-search
          option-filter-prop="name"
        />
        <span class="text-xs text-gray-500 ml-auto">
          {{ $t('page.equipment.totalRecords', { total: overviewLogs.length }) }}
        </span>
      </div>

      <Spin :spinning="loading">
        <Tabs v-model:activeKey="activeTab">
          <!-- Weekly Multi-Line Parameter Chart Tab -->
          <TabPane key="chart" :tab="$t('page.ops.weeklyChartTab')">
            <WeeklyParameterChart
              :equipment-id="selectedEquipmentId"
              :equipments="props.equipments"
              :units="props.units"
              :external-logs="overviewLogs"
            />
          </TabPane>

          <!-- Summary Metrics Tab -->
          <TabPane key="summary" tab="Summary & Metrics">
            <div v-if="parameterMetrics.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                v-for="(metric, idx) in parameterMetrics"
                :key="idx"
                size="small"
                class="shadow-xs hover:shadow-md transition-shadow border-t-2 border-t-primary"
              >
                <Statistic
                  :title="metric.paramName"
                  :value="metric.latestValue"
                />
                <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 flex justify-between">
                  <span>Count: {{ metric.count }}</span>
                  <span>{{ metric.latestDate }}</span>
                </div>
              </Card>
            </div>
            <Empty v-else description="No parameter metric logs recorded" class="my-8" />
          </TabPane>

          <!-- History Logs List Tab -->
          <TabPane key="list" tab="History Logs">
            <Table
              :columns="columns"
              :data-source="overviewLogs"
              row-key="id"
              size="small"
              :pagination="{ pageSize: 5, showSizeChanger: true }"
              bordered
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'parameter'">
                  <span class="font-medium">
                    {{ getParamDisplayName(record as ParameterLogItem).name }}
                  </span>
                  <Tag v-if="getParamDisplayName(record as ParameterLogItem).code" color="cyan" class="ml-2">
                    {{ getParamDisplayName(record as ParameterLogItem).code }}
                  </Tag>
                </template>

                <template v-else-if="column.key === 'value'">
                  <span class="font-semibold text-emerald-600 dark:text-emerald-400">
                    {{ record.value }}{{ getUnitName(record.unit_id) }}
                  </span>
                </template>

                <template v-else-if="column.key === 'recorded_at'">
                  <span>
                    {{ record.recorded_at ? dayjs(record.recorded_at).format('YYYY-MM-DD HH:mm:ss') : (record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-') }}
                  </span>
                </template>
              </template>
            </Table>
          </TabPane>
        </Tabs>
      </Spin>
    </div>
  </Modal>
</template>
