<script lang="ts" setup>
import { ref, computed } from 'vue';
import {
  Modal,
  Upload,
  Alert,
  Spin,
  Button,
  message
} from 'ant-design-vue';
import type { UploadFile } from 'ant-design-vue';
import axios from 'axios';
import { useI18n } from '@vben/locales';
import { $t } from '#/locales';
import { importParameterLogApi } from '../api';
import { generateParameterTemplateBlob } from '../parameter-template-helper';

const UploadDragger = Upload.Dragger;
const { locale } = useI18n();

const props = defineProps<{
  open: boolean;
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
const importFileList = ref<UploadFile[]>([]);
const selectedFile = ref<File | null>(null);
const importErrors = ref<string[]>([]);

function handleDownloadTemplate() {
  const currentLocale = locale.value || 'en-US';
  const blob = generateParameterTemplateBlob(currentLocale);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentLocale === 'zh-CN'
    ? 'mau-nhap-nhat-ky-thong-so.xlsx'
    : 'parameter-log-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

function handleBeforeUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowed = ['xlsx', 'xls', 'csv', 'txt'];
  if (!ext || !allowed.includes(ext)) {
    message.error($t('page.ops.paramImportHint'));
    return false;
  }

  if (file.size > 10 * 1024 * 1024) {
    message.error($t('page.ops.paramImportHint'));
    return false;
  }

  selectedFile.value = file;
  importFileList.value = [file as unknown as UploadFile];
  importErrors.value = [];
  return false;
}

function resetImport() {
  importFileList.value = [];
  selectedFile.value = null;
  importErrors.value = [];
}

async function handleImportUpload() {
  if (!selectedFile.value) {
    message.error($t('page.ops.paramImportFileRequired'));
    return;
  }

  importing.value = true;
  importErrors.value = [];

  try {
    const res = await importParameterLogApi(selectedFile.value);
    const successMsg = res.message || $t('page.ops.paramImportSuccess');
    message.success(successMsg);

    showModal.value = false;
    resetImport();
    emit('success');
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 422) {
      const errorData = error.response.data as { errors?: { file?: string[] }; message?: string };
      const fileErrors = errorData.errors?.file ?? [];
      importErrors.value = fileErrors.length > 0 ? fileErrors : [errorData.message ?? 'Validation failed.'];
    } else if (axios.isAxiosError(error)) {
      importErrors.value = [error.response?.data?.message || error.message || 'Upload failed.'];
    } else {
      importErrors.value = ['Upload failed.'];
    }
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <Modal
    v-model:open="showModal"
    :title="$t('page.ops.paramImportTitle')"
    width="800px"
    @cancel="resetImport"
  >
    <Spin :spinning="importing">
      <div class="space-y-4 py-2">
        <UploadDragger
          v-model:fileList="importFileList"
          :multiple="false"
          :before-upload="handleBeforeUpload"
          accept=".xlsx,.xls,.csv,.txt"
        >
          <p class="ant-upload-drag-icon flex justify-center mt-4">
            <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </p>
          <p class="ant-upload-text text-sm font-medium text-gray-700 mt-2">
            {{ $t('page.ops.paramImportDragDropText') }}
          </p>
          <p class="ant-upload-hint text-xs text-gray-400 mb-4">
            {{ $t('page.ops.paramImportHint') }}
          </p>
        </UploadDragger>

        <div v-if="importFileList.length > 0 && importErrors.length === 0" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          {{ importFileList[0]?.name }}
        </div>

        <Alert
          v-if="importErrors.length > 0"
          :message="$t('page.ops.paramImportErrorsTitle')"
          type="error"
          show-icon
        >
          <template #description>
            <div class="max-h-[150px] overflow-y-auto mt-1 space-y-0.5">
              <div v-for="(err, idx) in importErrors" :key="idx" class="text-xs">
                • {{ err }}
              </div>
            </div>
          </template>
        </Alert>
      </div>
    </Spin>

    <template #footer>
      <div class="flex items-center justify-between">
        <Button type="link" size="small" class="p-0 flex items-center gap-1 text-blue-600 dark:text-blue-400" @click="handleDownloadTemplate">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {{ $t('page.ops.paramImportDownloadTemplate') }}
        </Button>
        <div class="space-x-2">
          <Button @click="resetImport(); showModal = false">{{ $t('page.ops.btnCancel') }}</Button>
          <Button
            type="primary"
            :loading="importing"
            :disabled="importFileList.length === 0"
            @click="handleImportUpload"
          >
            {{ $t('page.ops.paramImportConfirm') }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>
