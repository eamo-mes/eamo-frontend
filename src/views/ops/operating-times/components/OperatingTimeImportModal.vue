<script lang="ts" setup>
import { ref, computed } from 'vue';
import {
  Modal,
  Button,
  Upload,
  Alert,
  Table,
  Tag,
  Spin,
  message
} from 'ant-design-vue';
import axios from 'axios';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import type { OperatingTimeItem, EquipmentOption } from '../types';
import { parseFileContent, exportToExcelBlob } from '../import-helper';

const UploadDragger = Upload.Dragger;

const props = defineProps<{
  open: boolean;
  getAuthHeaders: () => Record<string, string>;
  getEquipmentName: (id: string) => string;
  equipments: EquipmentOption[];
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'success'): void;
}>();

const showModal = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
});

const importing = ref(false);
const importFileList = ref<any[]>([]);
const previewData = ref<OperatingTimeItem[]>([]);
const importErrors = ref<string[]>([]);

function handleBeforeUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowed = ['xlsx', 'xls', 'csv', 'txt'];
  if (!ext || !allowed.includes(ext)) {
    message.error($t('page.ops.importHint'));
    return false;
  }

  if (file.size > 10 * 1024 * 1024) {
    message.error($t('page.ops.importHint'));
    return false;
  }

  importFileList.value = [file];
  
  const reader = new FileReader();
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

  reader.onload = async (e) => {
    try {
      const data = e.target?.result;
      if (!data) throw new Error('File is empty');
      
      const parsed = await parseFileContent(data, isExcel, props.equipments);
      previewData.value = parsed.parsedItems;
      if (parsed.errors.length > 0) {
        importErrors.value = parsed.errors;
      }
    } catch (err: any) {
      importErrors.value = [err.message || 'Failed to parse file'];
    }
  };

  if (isExcel) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }

  return false;
}

function resetImport() {
  importFileList.value = [];
  previewData.value = [];
  importErrors.value = [];
}

async function handleImportUpload() {
  if (previewData.value.length === 0) {
    message.error($t('page.ops.importFileRequired'));
    return;
  }

  if (importErrors.value.length > 0) {
    message.error('Please fix validation errors before importing.');
    return;
  }

  importing.value = true;

  try {
    const fileBlob = exportToExcelBlob(previewData.value);
    const filename = importFileList.value[0]?.name || 'import.xlsx';

    const formData = new FormData();
    formData.append('file', fileBlob, filename);

    const response = await axios.post(
      `${API_BASE_URL}/v1/equipment/error-monitoring/operating-times/import`,
      formData,
      {
        headers: {
          ...props.getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      }
    );

    const successMsg = response.data?.message || $t('page.ops.importSuccess');
    message.success(successMsg);

    showModal.value = false;
    resetImport();
    emit('success');
  } catch (error: any) {
    if (error.response && error.response.status === 422) {
      const errorData = error.response.data;
      const fileErrors = errorData.errors?.file || [];
      if (fileErrors.length > 0) {
        importErrors.value = fileErrors;
      } else {
        importErrors.value = [errorData.message || 'Validation failed.'];
      }
    } else {
      const errMsg = error.response?.data?.message || error.message || 'Upload failed.';
      importErrors.value = [errMsg];
    }
  } finally {
    importing.value = false;
  }
}

const previewColumns = computed(() => [
  {
    title: $t('page.ops.colEquipment'),
    dataIndex: 'equipment_name',
    key: 'equipment_name',
  },
  {
    title: $t('page.ops.workingTime'),
    dataIndex: 'working_time',
    key: 'working_time',
    align: 'right' as const,
  },
  {
    title: $t('page.ops.plannedStopTime'),
    dataIndex: 'planned_stop_time',
    key: 'planned_stop_time',
    align: 'right' as const,
  },
  {
    title: $t('page.ops.unplannedStopTime'),
    dataIndex: 'unplanned_stop_time',
    key: 'unplanned_stop_time',
    align: 'right' as const,
  },
  {
    title: $t('page.ops.startTime'),
    dataIndex: 'start_time',
    key: 'start_time',
  },
  {
    title: $t('page.ops.endTime'),
    dataIndex: 'end_time',
    key: 'end_time',
  },
  {
    title: $t('page.ops.availabilityFactor'),
    dataIndex: 'availability_factor',
    key: 'availability_factor',
    align: 'center' as const,
  }
]);

function formatCellHours(val: string | number | undefined | null) {
  const num = Number(val);
  return isNaN(num) ? val : `${Number(num.toFixed(3))} hrs`;
}
</script>

<template>
  <Modal
    v-model:open="showModal"
    :title="$t('page.ops.importTitle')"
    :confirm-loading="importing"
    :ok-text="$t('page.ops.importConfirm')"
    :cancel-text="$t('page.ops.btnCancel')"
    :ok-button-props="{ disabled: importErrors.length > 0 || previewData.length === 0 }"
    width="1100px"
    @ok="handleImportUpload"
    @cancel="resetImport"
  >
    <Spin :spinning="importing">
      <div class="space-y-4">
        <!-- Upload Area (when no preview data exists) -->
        <div v-if="previewData.length === 0">
          <UploadDragger
            v-model:fileList="importFileList"
            :multiple="false"
            :before-upload="handleBeforeUpload"
            accept=".xlsx,.xls,.csv,.txt"
          >
            <p class="ant-upload-drag-icon flex justify-center mt-4">
              <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
            </p>
            <p class="ant-upload-text text-base font-medium text-gray-700 mt-2">
              {{ $t('page.ops.importDragDropText') }}
            </p>
            <p class="ant-upload-hint text-sm text-gray-400 mb-4">
              {{ $t('page.ops.importHint') }}
            </p>
          </UploadDragger>

          <!-- Column Guidelines Reference -->
          <div class="mt-6 border border-gray-100 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/50">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {{ $t('page.ops.importHeadersTitle') }}
            </h4>
            <p class="text-xs text-gray-400 mb-3">
              {{ $t('page.ops.importHeadersDesc') }}
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <div class="font-semibold text-gray-700 dark:text-gray-200 flex justify-between">
                  <span>code / mã thiết bị <span class="text-red-500">*</span></span>
                  <span class="text-red-500 font-normal text-[10px]">{{ $t('page.ops.importRequired') }}</span>
                </div>
                <div class="text-gray-400 mt-1 leading-normal">{{ $t('page.ops.importEquipIdDesc') }}</div>
              </div>
              <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <div class="font-semibold text-gray-700 dark:text-gray-200 flex justify-between">
                  <span>planned_stop_time <span class="text-red-500">*</span></span>
                  <span class="text-red-500 font-normal text-[10px]">{{ $t('page.ops.importRequired') }}</span>
                </div>
                <div class="text-gray-400 mt-1">Synonyms: planned_stop_time, planned stop, thời gian dừng kế hoạch</div>
              </div>
              <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <div class="font-semibold text-gray-700 dark:text-gray-200 flex justify-between">
                  <span>start_time <span class="text-red-500">*</span></span>
                  <span class="text-red-500 font-normal text-[10px]">{{ $t('page.ops.importRequired') }}</span>
                </div>
                <div class="text-gray-400 mt-1">Synonyms: start_time, start time, bắt đầu, thời gian bắt đầu</div>
              </div>
              <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <div class="font-semibold text-gray-700 dark:text-gray-200 flex justify-between">
                  <span>end_time <span class="text-red-500">*</span></span>
                  <span class="text-red-500 font-normal text-[10px]">{{ $t('page.ops.importRequired') }}</span>
                </div>
                <div class="text-gray-400 mt-1">Synonyms: end_time, end time, kết thúc, thời gian kết thúc</div>
              </div>
              <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <div class="font-semibold text-gray-700 dark:text-gray-200 flex justify-between">
                  <span>unplanned_stop_time</span>
                  <span class="text-gray-400 font-normal text-[10px]">{{ $t('page.ops.importOptional') }}</span>
                </div>
                <div class="text-gray-400 mt-1">Synonyms: unplanned_stop_time, thời gian dừng không kế hoạch</div>
              </div>
              <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <div class="font-semibold text-gray-700 dark:text-gray-200 flex justify-between">
                  <span>equipment_name</span>
                  <span class="text-gray-400 font-normal text-[10px]">{{ $t('page.ops.importOptional') }}</span>
                </div>
                <div class="text-gray-400 mt-1">Synonyms: equipment_name, tên thiết bị</div>
              </div>
            </div>

            <!-- Date Time Format Note -->
            <div class="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
              <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 block mb-1">
                {{ $t('page.ops.importDateNoteTitle') }}
              </span>
              <p class="text-[11px] text-gray-400 leading-normal">
                {{ $t('page.ops.importDateNoteDesc') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Preview Table (when preview data exists) -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
            <div class="text-sm">
              <span class="font-semibold text-blue-700 dark:text-blue-400">
                {{ $t('page.ops.importPreviewTitle') }}
              </span>
              <span class="text-gray-500 dark:text-gray-400 ml-2">
                ({{ previewData.length }} records loaded from {{ importFileList[0]?.name }})
              </span>
            </div>
            <Button size="small" type="default" danger @click="resetImport">
              {{ $t('page.ops.importChangeFile') }}
            </Button>
          </div>

          <Table
            :columns="previewColumns"
            :data-source="previewData"
            row-key="id"
            size="small"
            :pagination="{ pageSize: 5, showSizeChanger: false }"
            class="w-full"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'equipment_name'">
                <div class="flex flex-col">
                  <span class="font-medium text-gray-700 dark:text-gray-200">{{ record.equipment_name }}</span>
                  <span class="text-[10px] text-gray-400">ID: {{ record.equipment_id }}</span>
                </div>
              </template>
              <template v-else-if="column.key === 'availability_factor'">
                <Tag :color="record.availability_factor >= 90 ? '#2ec7c9' : record.availability_factor >= 75 ? '#5ab1ef' : '#b6a2de'">
                  {{ record.availability_factor }}%
                </Tag>
              </template>
              <template v-else-if="['working_time', 'planned_stop_time', 'unplanned_stop_time'].includes(column.key as string)">
                <span>{{ formatCellHours(record[column.key as keyof typeof record]) }}</span>
              </template>
            </template>
          </Table>
        </div>

        <!-- Server/Parsing Errors -->
        <Alert
          v-if="importErrors.length > 0"
          :message="$t('page.ops.importErrorsTitle')"
          type="error"
          show-icon
          class="mt-4"
        >
          <template #description>
            <div class="max-h-[150px] overflow-y-auto mt-2 space-y-1">
              <div v-for="(err, idx) in importErrors" :key="idx" class="text-xs">
                • {{ err }}
              </div>
            </div>
          </template>
        </Alert>
      </div>
    </Spin>
  </Modal>
</template>
