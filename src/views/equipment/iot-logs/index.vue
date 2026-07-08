<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { $t } from '#/locales';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Input,
  Select,
  Tag,
  Badge,
  Button,
  Spin,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';

interface EquipmentOption {
  id: string;
  name: string;
  code: string;
}

interface IoTLog {
  key: string;
  timestamp: string;
  equipmentName: string;
  equipmentCode: string;
  parameter: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

const loading = ref(false);
const equipments = ref<EquipmentOption[]>([]);
const logs = ref<IoTLog[]>([]);
const searchVal = ref('');
const activeSearch = ref('');
const paramFilter = ref<string>('all');
const statusFilter = ref<string>('all');

let intervalId: any = null;

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadEquipments() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    equipments.value = Array.isArray(raw) ? raw : [];
    // Generate initial logs
    generateInitialLogs();
    // Start live log simulation
    startSimulation();
  } catch {
    // Fallback if API fails
    equipments.value = [
      { id: '1', name: 'CNC Milling Machine Haas VF-2', code: 'CNC-HAAS-VF2' },
      { id: '2', name: 'Engel Victory 120', code: 'IMM-ENGEL-V120' },
      { id: '3', name: 'ABB IRB 2600', code: 'ROB-ABB-IRB2600' },
    ];
    generateInitialLogs();
    startSimulation();
  } finally {
    loading.value = false;
  }
}

function generateInitialLogs() {
  const paramTypes = [
    { name: 'Operating Temperature', unit: '°C', min: 25, max: 90, normalMax: 75, warningMax: 85 },
    { name: 'Power Consumption', unit: 'kW', min: 2, max: 25, normalMax: 18, warningMax: 22 },
    { name: 'Working Pressure', unit: 'bar', min: 3, max: 10, normalMax: 7.5, warningMax: 9 },
  ];

  const list: IoTLog[] = [];
  const now = new Date();

  for (let i = 0; i < 15; i++) {
    const eq = equipments.value[Math.floor(Math.random() * equipments.value.length)];
    if (!eq) continue;
    const param = paramTypes[Math.floor(Math.random() * paramTypes.length)];
    if (!param) continue;

    const val = parseFloat((Math.random() * (param.max - param.min) + param.min).toFixed(2));
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    if (val > param.warningMax) {
      status = 'critical';
    } else if (val > param.normalMax) {
      status = 'warning';
    }

    const logTime = new Date(now.getTime() - i * 60000);

    list.push({
      key: `init-${i}`,
      timestamp: logTime.toLocaleTimeString('vi-VN'),
      equipmentName: eq.name,
      equipmentCode: eq.code,
      parameter: param.name,
      value: val,
      unit: param.unit,
      status,
    });
  }
  logs.value = list;
}

function startSimulation() {
  const paramTypes = [
    { name: 'Operating Temperature', unit: '°C', min: 25, max: 92, normalMax: 75, warningMax: 85 },
    { name: 'Power Consumption', unit: 'kW', min: 2, max: 25, normalMax: 18, warningMax: 22 },
    { name: 'Working Pressure', unit: 'bar', min: 3, max: 10, normalMax: 7.5, warningMax: 9 },
  ];

  intervalId = setInterval(() => {
    if (equipments.value.length === 0) return;
    const eq = equipments.value[Math.floor(Math.random() * equipments.value.length)];
    if (!eq) return;
    const param = paramTypes[Math.floor(Math.random() * paramTypes.length)];
    if (!param) return;

    const val = parseFloat((Math.random() * (param.max - param.min) + param.min).toFixed(2));
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    if (val > param.warningMax) {
      status = 'critical';
    } else if (val > param.normalMax) {
      status = 'warning';
    }

    const newLog: IoTLog = {
      key: `sim-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      equipmentName: eq.name,
      equipmentCode: eq.code,
      parameter: param.name,
      value: val,
      unit: param.unit,
      status,
    };

    logs.value = [newLog, ...logs.value.slice(0, 49)]; // Limit to last 50 logs
  }, 3000);
}

function handleSearch() {
  activeSearch.value = searchVal.value;
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  paramFilter.value = 'all';
  statusFilter.value = 'all';
}

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    const matchSearch = !activeSearch.value || 
      log.equipmentName.toLowerCase().includes(activeSearch.value.toLowerCase()) ||
      log.equipmentCode.toLowerCase().includes(activeSearch.value.toLowerCase());

    const matchParam = paramFilter.value === 'all' || log.parameter === paramFilter.value;
    const matchStatus = statusFilter.value === 'all' || log.status === statusFilter.value;

    return matchSearch && matchParam && matchStatus;
  });
});

const activeEquipmentCount = computed(() => {
  return equipments.value.length;
});

const criticalLogCount = computed(() => {
  return logs.value.filter(l => l.status === 'critical').length;
});

const warningLogCount = computed(() => {
  return logs.value.filter(l => l.status === 'warning').length;
});

const columns = [
  { title: 'Thời gian', dataIndex: 'timestamp', key: 'timestamp', width: 120 },
  { title: 'Mã thiết bị', dataIndex: 'equipmentCode', key: 'equipmentCode', width: 150 },
  { title: 'Tên thiết bị', dataIndex: 'equipmentName', key: 'equipmentName' },
  { title: 'Thông số giám sát', dataIndex: 'parameter', key: 'parameter' },
  { title: 'Giá trị', key: 'value', width: 140 },
  { title: 'Trạng thái', key: 'status', width: 130 },
];

onMounted(() => {
  loadEquipments();
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Statistic Dashboard Cards -->
    <Row :gutter="16">
      <Col :span="6">
        <Card border-card class="shadow-sm rounded-xl">
          <Statistic title="Tổng thiết bị IoT kết nối" :value="activeEquipmentCount" />
        </Card>
      </Col>
      <Col :span="6">
        <Card border-card class="shadow-sm rounded-xl">
          <Statistic title="Trạng thái hệ thống" value="ONLINE" value-style="color: #3f8600" />
        </Card>
      </Col>
      <Col :span="6">
        <Card border-card class="shadow-sm rounded-xl">
          <Statistic title="Cảnh báo (Warning)" :value="warningLogCount" value-style="color: #cf1322" />
        </Card>
      </Col>
      <Col :span="6">
        <Card border-card class="shadow-sm rounded-xl">
          <Statistic title="Lỗi khẩn cấp (Critical)" :value="criticalLogCount" value-style="color: #a8071a" />
        </Card>
      </Col>
    </Row>

    <!-- Filters -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
      <Input
        v-model:value="searchVal"
        placeholder="Tìm theo tên/mã thiết bị"
        class="max-w-[240px]"
        allow-clear
        @press-enter="handleSearch"
      />
      <Select v-model:value="paramFilter" class="w-[200px]" placeholder="Lọc theo thông số">
        <Select.Option value="all">Tất cả thông số</Select.Option>
        <Select.Option value="Operating Temperature">Nhiệt độ (Temperature)</Select.Option>
        <Select.Option value="Power Consumption">Công suất (Power)</Select.Option>
        <Select.Option value="Working Pressure">Áp suất (Pressure)</Select.Option>
      </Select>
      <Select v-model:value="statusFilter" class="w-[160px]" placeholder="Lọc trạng thái">
        <Select.Option value="all">Tất cả trạng thái</Select.Option>
        <Select.Option value="normal">Bình thường</Select.Option>
        <Select.Option value="warning">Cảnh báo</Select.Option>
        <Select.Option value="critical">Khẩn cấp</Select.Option>
      </Select>
      <Button type="default" @click="handleSearch">
        {{ $t('page.company.btnFilter') }}
      </Button>
      <Button type="default" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>
      <div class="ml-auto flex items-center gap-2">
        <Badge status="processing" text="Simulating Live Telemetry" />
      </div>
    </div>

    <!-- Live Telemetry Stream Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredLogs"
          row-key="key"
          :pagination="{ pageSize: 10 }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'value'">
              <span class="font-semibold">{{ record.value }} {{ record.unit }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="record.status === 'critical' ? 'red' : record.status === 'warning' ? 'orange' : 'green'">
                {{ record.status === 'critical' ? 'Critical' : record.status === 'warning' ? 'Warning' : 'Normal' }}
              </Tag>
            </template>
          </template>
        </Table>
      </Spin>
    </div>
  </div>
</template>
