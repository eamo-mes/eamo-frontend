<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeft, createIconifyIcon } from '@vben/icons';
import { $t } from '#/locales';
import {
  Breadcrumb,
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  Form,
  FormItem,
  message,
  Spin,
  Card,
  Modal,
  Upload,
  Empty,
} from 'ant-design-vue';
import type { UploadFile, UploadProps } from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { useRoleAccess } from '#/utils/useRoleAccess';
import EquipmentUnifiedModal from './components/EquipmentUnifiedModal.vue';
import EquipmentHierarchyFlow from './components/EquipmentHierarchyFlow.vue';

const { isManager } = useRoleAccess();

const UploadOutlined = createIconifyIcon('ant-design:upload-outlined');

interface CategoryOption {
  id: string;
  code: string;
  name: string;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  name: string;
  code: string;
}

interface EquipmentListItem {
  id: string;
  code: string;
  name: string | null;
}

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);

const categories = ref<CategoryOption[]>([]);
const errorsList = ref<ErrorOption[]>([]);
const units = ref<UnitOption[]>([]);
const allEquipments = ref<EquipmentListItem[]>([]);
const initialChildIds = ref<string[]>([]);

const formState = ref({
  code: '',
  name: '',
  equipment_category_id: undefined as string | undefined,
  is_active: true,
  maintenance_interval_hours: undefined as number | undefined,
  equipment_error_ids: [] as string[],
  equipment_parameters: [] as { id?: string; code: string; name: string; unit_id: string | undefined; standard?: number; standard_max?: number; standard_min?: number }[],
  parent_id: undefined as string | undefined,
  child_ids: [] as string[],
});

const qrModalOpen = ref(false);
const showDiagram = ref(false);

const fileList = ref<UploadFile[]>([]);

function getImageUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const baseUrl = API_BASE_URL.replace(/\/api$/, '');
  const imagePath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${imagePath}`;
}

const previewVisible = ref(false);
const previewImage = ref('');
const previewTitle = ref('');

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

const handlePreviewFile = async (file: UploadFile) => {
  if (!file.url && !file.preview && file.originFileObj) {
    file.preview = await getBase64(file.originFileObj as File);
  }
  previewImage.value = file.url || (file.preview as string) || '';
  previewVisible.value = true;
  previewTitle.value = file.name || file.url?.substring(file.url.lastIndexOf('/') + 1) || 'Preview';
};

const handleBeforeUpload: UploadProps['beforeUpload'] = () => {
  return false;
};

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadUnits() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/units`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    units.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadCategories() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-categories`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    categories.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadErrors() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment-errors`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? res.data ?? [];
    errorsList.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadAllEquipments() {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    allEquipments.value = Array.isArray(raw) ? raw : [];
  } catch {
    // silently fail
  }
}

async function loadEquipmentDetail(id: string) {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/${id}`, {
      headers: getAuthHeaders(),
      params: { include_children: true },
    });
    const record = res.data?.data ?? res.data;
    if (record) {
      formState.value = {
        code: record.code,
        name: record.name || '',
        equipment_category_id: record.equipment_category_id || undefined,
        is_active: !!record.is_active,
        maintenance_interval_hours: record.maintenance_interval_hours ?? undefined,
        equipment_error_ids: record.equipment_errors?.map((err: { id: string }) => err.id) || [],
        equipment_parameters: record.equipment_parameters?.map((param: { id?: string; code: string; name: string; unit_id?: string; standard?: number; standard_max?: number; standard_min?: number }) => ({
          id: param.id,
          code: param.code,
          name: param.name,
          unit_id: param.unit_id || undefined,
          standard: param.standard ?? undefined,
          standard_max: param.standard_max ?? undefined,
          standard_min: param.standard_min ?? undefined,
        })) || [],
        parent_id: record.parent_id || undefined,
        child_ids: record.children?.map((child: { id: string }) => child.id) || [],
      };
      initialChildIds.value = record.children?.map((child: { id: string }) => child.id) || [];
      if (record.equipment_images) {
        fileList.value = record.equipment_images.map((img: { id: string; image_id: string; path?: string | null }) => ({
          uid: img.id,
          name: img.image_id || 'image.png',
          status: 'done',
          url: getImageUrl(img.path),
          thumbUrl: getImageUrl(img.path),
        }));
      } else {
        fileList.value = [];
      }
    }
  } catch (err: any) {
    message.error(err?.response?.data?.message || $t('page.equipment.msgLoadDetailError'));
    goBack();
  } finally {
    loading.value = false;
  }
}

const handleRemoveFile = async (file: UploadFile) => {
  if (editId.value && !file.originFileObj && file.uid) {
    try {
      submitting.value = true;
      const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      };

      const stepFormData = buildBaseFormData();
      const remainingImageIds = fileList.value
        .filter(item => item.uid !== file.uid && !item.originFileObj)
        .map(item => item.uid);

      remainingImageIds.forEach(id => {
        stepFormData.append('existing_image_ids[]', id);
      });
      stepFormData.append('_method', 'PUT');

      const res = await axios.post(`${API_BASE_URL}/v1/equipment/${editId.value}`, stepFormData, {
        headers,
      });

      const updatedRecord = res.data?.data ?? res.data;
      if (updatedRecord && updatedRecord.equipment_images) {
        const newFileList: UploadFile[] = updatedRecord.equipment_images.map((img: { id: string; image_id: string; path?: string | null }) => ({
          uid: img.id,
          name: img.image_id || 'image.png',
          status: 'done',
          url: getImageUrl(img.path),
          thumbUrl: getImageUrl(img.path),
        }));
        const localFiles = fileList.value.filter(item => !!item.originFileObj);
        fileList.value = [...newFileList, ...localFiles];
      }
      message.success($t('page.equipment.msgDeleteImageSuccess'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || $t('page.equipment.msgDeleteImageError');
      message.error(msg);
      return false;
    } finally {
      submitting.value = false;
    }
  }
  return true;
};

const formRef = ref();

const rules = computed(() => ({
  code: [{ required: true, message: $t('page.equipment.validationCode') }],
  name: [{ required: true, message: $t('page.equipment.validationName') }],
}));

function addParameterRow() {
  formState.value.equipment_parameters.push({
    code: '',
    name: '',
    unit_id: undefined,
    standard: undefined,
    standard_max: undefined,
    standard_min: undefined,
  });
}

function removeParameterRow(index: number) {
  formState.value.equipment_parameters.splice(index, 1);
}

function buildBaseFormData() {
  const fd = new FormData();
  fd.append('code', formState.value.code);
  fd.append('name', formState.value.name || '');
  if (formState.value.equipment_category_id) {
    fd.append('equipment_category_id', formState.value.equipment_category_id);
  }
  fd.append('is_active', formState.value.is_active ? '1' : '0');
  if (formState.value.maintenance_interval_hours !== undefined && formState.value.maintenance_interval_hours !== null) {
    fd.append('maintenance_interval_hours', String(formState.value.maintenance_interval_hours));
  }
  if (formState.value.parent_id !== undefined && formState.value.parent_id !== null) {
    fd.append('parent_id', formState.value.parent_id);
  } else {
    fd.append('parent_id', '');
  }

  formState.value.equipment_error_ids.forEach(errId => {
    fd.append('equipment_error_ids[]', errId);
  });

  formState.value.equipment_parameters.forEach((param, index) => {
    if (param.id) fd.append(`equipment_parameters[${index}][id]`, param.id);
    fd.append(`equipment_parameters[${index}][code]`, param.code);
    fd.append(`equipment_parameters[${index}][name]`, param.name || param.code);
    if (param.unit_id) fd.append(`equipment_parameters[${index}][unit_id]`, param.unit_id);
    if (param.standard !== undefined && param.standard !== null) fd.append(`equipment_parameters[${index}][standard]`, String(param.standard));
    if (param.standard_max !== undefined && param.standard_max !== null) fd.append(`equipment_parameters[${index}][standard_max]`, String(param.standard_max));
    if (param.standard_min !== undefined && param.standard_min !== null) fd.append(`equipment_parameters[${index}][standard_min]`, String(param.standard_min));
  });
  return fd;
}

async function handleSubmit() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    let currentEquipmentId = editId.value;

    const existingImageIds = fileList.value
      .filter(item => !item.originFileObj)
      .map(item => item.uid);

    let currentExistingImageIds = [...existingImageIds];

    const newFiles = fileList.value
      .filter(item => !!item.originFileObj && item.originFileObj instanceof File)
      .map(item => item.originFileObj as File);

    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'multipart/form-data',
    };

    if (isEditing.value && currentEquipmentId) {
      // 1. Send base update request
      const baseFormData = buildBaseFormData();
      currentExistingImageIds.forEach(id => {
        baseFormData.append('existing_image_ids[]', id);
      });
      baseFormData.append('_method', 'PUT');

      const res = await axios.post(`${API_BASE_URL}/v1/equipment/${currentEquipmentId}`, baseFormData, {
        headers,
      });
      const updatedRecord = res.data?.data ?? res.data;
      if (updatedRecord && updatedRecord.equipment_images) {
        currentExistingImageIds = updatedRecord.equipment_images.map((img: { id: string }) => img.id);
      }
      message.success($t('page.equipment.msgUpdateEquipmentSuccess'));
    } else {
      // 1. Send base create request
      const baseFormData = buildBaseFormData();
      const res = await axios.post(`${API_BASE_URL}/v1/equipment`, baseFormData, {
        headers,
      });
      const createdRecord = res.data?.data ?? res.data;
      if (createdRecord) {
        currentEquipmentId = createdRecord.id;
        if (createdRecord.equipment_images) {
          currentExistingImageIds = createdRecord.equipment_images.map((img: { id: string }) => img.id);
        }
      }
      message.success($t('page.equipment.msgCreateEquipmentSuccess'));
    }

    // 2. Upload queue sequentially for new images
    if (currentEquipmentId && newFiles.length > 0) {
      for (let i = 0; i < newFiles.length; i++) {
        const itemFile = newFiles[i];
        if (!itemFile) continue;

        try {
          const stepFormData = buildBaseFormData();
          currentExistingImageIds.forEach(id => {
            stepFormData.append('existing_image_ids[]', id);
          });
          stepFormData.append('uploaded_images[]', itemFile);
          stepFormData.append('_method', 'PUT');

          const res = await axios.post(`${API_BASE_URL}/v1/equipment/${currentEquipmentId}`, stepFormData, {
            headers,
          });

          const updatedRecord = res.data?.data ?? res.data;
          if (updatedRecord && updatedRecord.equipment_images) {
            currentExistingImageIds = updatedRecord.equipment_images.map((img: { id: string }) => img.id);
          }
        } catch (uploadErr) {
          const error = uploadErr as { response?: { data?: { message?: string } } };
          const msg = error?.response?.data?.message || $t('page.equipment.msgUploadFailedImage', { current: i + 1, total: newFiles.length });
          message.error(msg);
          throw uploadErr;
        }
      }
    }

    // 3. Update child relationships if currentEquipmentId is set
    if (currentEquipmentId) {
      const addedChildren = formState.value.child_ids.filter(id => !initialChildIds.value.includes(id));
      const removedChildren = initialChildIds.value.filter(id => !formState.value.child_ids.includes(id));

      const childUpdatePromises: Promise<unknown>[] = [];

      addedChildren.forEach(childId => {
        childUpdatePromises.push(
          axios.patch(
            `${API_BASE_URL}/v1/equipment/${childId}/parent`,
            { parent_id: currentEquipmentId },
            { headers: getAuthHeaders() }
          )
        );
      });

      removedChildren.forEach(childId => {
        childUpdatePromises.push(
          axios.patch(
            `${API_BASE_URL}/v1/equipment/${childId}/parent`,
            { parent_id: null },
            { headers: getAuthHeaders() }
          )
        );
      });

      if (childUpdatePromises.length > 0) {
        await Promise.all(childUpdatePromises);
      }
    }

    if (!isEditing.value && currentEquipmentId) {
      router.replace({ name: 'EquipmentDetail', query: { id: currentEquipmentId } });
    }
  } catch (err: unknown) {
    const error = err as { errorFields?: unknown; response?: { data?: { message?: string } } };
    if (error?.errorFields) {
      // Form validation failed
    } else {
      const msg = error?.response?.data?.message || $t('page.equipment.msgSaveEquipmentError');
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  router.push({ name: 'EquipmentList' });
}

function handleParentUpdated() {
  if (editId.value) {
    loadEquipmentDetail(editId.value);
  }
}

onMounted(() => {
  loadCategories();
  loadErrors();
  loadUnits();
  loadAllEquipments();

  const id = route.query.id as string;
  if (id) {
    isEditing.value = true;
    editId.value = id;
    loadEquipmentDetail(id);
  } else {
    isEditing.value = false;
    editId.value = null;
  }
});
</script>

<template>
  <div class="p-6 space-y-6 w-full">
    <!-- Breadcrumb -->
    <Breadcrumb
      :items="[
        { title: $t('page.equipment.title') },
        { title: $t('page.equipment.list'), href: '/equipment/list' },
        { title: isEditing ? $t('page.equipment.btnEditEquipment') : $t('page.equipment.btnAddEquipment') },
      ]"
    />

    <!-- Header -->
    <div class="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
      <div class="flex items-center gap-3">
        <Button class="flex items-center justify-center mr-3" @click="goBack">
          <ChevronLeft class="size-5" />
        </Button>
        <h1 class="text-xl font-bold text-gray-800 m-0 dark:text-gray-100">
          {{ isEditing ? $t('page.equipment.btnEditEquipment') : $t('page.equipment.btnAddEquipment') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <Button
          v-if="isEditing"
          type="default"
          :disabled="submitting"
          @click="showDiagram = !showDiagram"
        >
          {{ showDiagram ? $t('page.equipment.btnFormView') : $t('page.equipment.btnHierarchyChart') }}
        </Button>
        <Button
          v-if="isEditing"
          type="default"
          class="flex items-center gap-1.5 font-medium"
          @click="qrModalOpen = true"
        >
          {{ $t('page.equipment.btnQrCode') }}
        </Button>
        <Button type="default" @click="goBack" :disabled="submitting">
          {{ $t('page.equipment.btnCancel') }}
        </Button>
        <Button v-if="isManager" type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" :loading="submitting" @click="handleSubmit">
          {{ $t('page.equipment.btnSave') }}
        </Button>
      </div>
    </div>

    <!-- Equipment Form and Hierarchy Diagram Body -->
    <div>
      <!-- List View: Main Information + Parameters + Embedded Hierarchy Flow -->
      <div v-show="!showDiagram">
        <Spin :spinning="loading || submitting">
          <Form
            ref="formRef"
            :model="formState"
            :rules="rules"
            :disabled="!isManager"
            layout="vertical"
            class="space-y-6"
          >
            <!-- Main Information Card -->
            <Card class="shadow-sm border-border rounded-xl">
              <div class="grid grid-cols-2 gap-x-4">
                <FormItem :label="$t('page.equipment.colCode')" name="code" class="col-span-1">
                  <Input v-model:value="formState.code" :placeholder="$t('page.equipment.placeholderCode')" :disabled="isEditing" />
                </FormItem>
                <FormItem :label="$t('page.equipment.colName')" name="name" class="col-span-1">
                  <Input v-model:value="formState.name" :placeholder="$t('page.equipment.placeholderName')" />
                </FormItem>
                <FormItem :label="$t('page.equipment.colCategory')" name="equipment_category_id" class="col-span-1">
                  <Select
                    v-model:value="formState.equipment_category_id"
                    :placeholder="$t('page.equipment.placeholderCategory')"
                    allow-clear
                  >
                    <Select.Option v-for="c in categories" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </Select.Option>
                  </Select>
                </FormItem>
                <FormItem :label="$t('page.equipment.colMaintenanceIntervalHours')" name="maintenance_interval_hours" class="col-span-1">
                  <InputNumber
                    v-model:value="formState.maintenance_interval_hours"
                    :placeholder="$t('page.equipment.placeholderMaintenanceIntervalHours')"
                    :min="0"
                    style="width: 100%"
                  />
                </FormItem>
                <FormItem :label="$t('page.equipment.colErrors')" name="equipment_error_ids" class="col-span-1">
                  <Select
                    v-model:value="formState.equipment_error_ids"
                    mode="multiple"
                    option-filter-prop="label"
                    :placeholder="$t('page.equipment.placeholderErrors')"
                    allow-clear
                  >
                    <Select.Option v-for="err in errorsList" :key="err.id" :value="err.id" :label="err.name">
                      {{ err.name }}
                    </Select.Option>
                  </Select>
                </FormItem>

                <FormItem :label="$t('page.equipment.colActive')" name="is_active" class="col-span-1">
                  <Switch v-model:checked="formState.is_active" />
                </FormItem>

                <!-- Images Dynamic List -->
                <div class="col-span-2 border-t border-gray-150 pt-4 mt-2">
                  <FormItem :label="$t('page.equipment.imagesTitle')">
                    <Upload
                      v-model:file-list="fileList"
                      list-type="picture"
                      class="upload-list-inline"
                      :before-upload="handleBeforeUpload"
                      @preview="handlePreviewFile"
                      @remove="handleRemoveFile"
                    >
                      <Button>
                        <UploadOutlined />
                        {{ $t('page.equipment.btnChooseImages') }}
                      </Button>
                    </Upload>
                  </FormItem>
                </div>
              </div>
            </Card>

            <!-- Independent Equipment Parameters Card -->
            <Card class="shadow-sm border-border rounded-xl mt-6">
              <div class="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div class="font-semibold text-gray-800 text-base">
                    {{ $t('page.equipment.parametersTitle') }}
                  </div>
                </div>
              </div>
              <div v-if="formState.equipment_parameters.length === 0" class="py-6 flex justify-center">
                <Empty :description="$t('page.equipment.noParameters')" />
              </div>
              <div v-else class="max-h-[320px] divide-y divide-border overflow-y-auto">
                <div v-for="(param, index) in formState.equipment_parameters" :key="index" class="flex flex-wrap items-end gap-2 py-3 first:pt-0 last:pb-0">
                  <div class="flex-1 min-w-[150px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.equipment.colName') }}</span>
                    <Input v-model:value="param.name" :placeholder="$t('page.equipment.colName')" />
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.equipment.parameterCode') }}</span>
                    <Input v-model:value="param.code" :placeholder="$t('page.equipment.parameterCode')" />
                  </div>
                  <div class="w-[100px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.equipment.parameterStandard') }}</span>
                    <InputNumber v-model:value="param.standard" :placeholder="$t('page.equipment.parameterStandard')" class="w-full" />
                  </div>
                  <div class="w-[100px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.equipment.parameterMin') }}</span>
                    <InputNumber v-model:value="param.standard_min" :placeholder="$t('page.equipment.parameterMin')" class="w-full" />
                  </div>
                  <div class="w-[100px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.equipment.parameterMax') }}</span>
                    <InputNumber v-model:value="param.standard_max" :placeholder="$t('page.equipment.parameterMax')" class="w-full" />
                  </div>
                  <div class="w-[150px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.equipment.parameterUnit') }}</span>
                    <Select v-model:value="param.unit_id" :placeholder="$t('page.equipment.parameterUnit')" class="w-full" allow-clear>
                      <Select.Option v-for="u in units" :key="u.id" :value="u.id">
                        {{ u.name }} ({{ u.code }})
                      </Select.Option>
                    </Select>
                  </div>
                  <div class="pb-1">
                    <Button type="text" danger class="shrink-0 px-2" @click="removeParameterRow(index)">
                      {{ $t('page.equipment.btnDeleteParameter') }}
                    </Button>
                  </div>
                </div>
              </div>

              <Button type="dashed" block class="mt-3" @click="addParameterRow">
                {{ $t('page.equipment.btnAddParameter') }}
              </Button>
            </Card>
          </Form>
        </Spin>
      </div>

      <!-- Diagram View: Dedicated Full-Page Node Hierarchy Diagram -->
      <div v-if="showDiagram && isEditing && editId">
        <EquipmentHierarchyFlow
          :current-equipment-id="editId"
          height="calc(100vh - 220px)"
          @parent-updated="handleParentUpdated"
        />
      </div>
    </div>

    <!-- Image Preview Modal -->
    <Modal :open="previewVisible" :title="previewTitle" :footer="null" width="600px" @cancel="previewVisible = false">
      <img alt="preview" style="width: 100%" :src="previewImage" />
    </Modal>

    <!-- Equipment Unified Modal (QR Tab) -->
    <EquipmentUnifiedModal
      v-model:open="qrModalOpen"
      :equipment-id="editId"
      initial-tab-key="qr"
    />
  </div>
</template>

<style scoped>
/* Card gap spacing */
:deep(.ant-card + .ant-card) {
  margin-top: 24px !important;
}

/* Force upload wrapper to align flush left */
.upload-list-inline {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  width: 100% !important;
  margin-left: 0 !important;
  padding-left: 0 !important;
}

.upload-list-inline :deep(.ant-upload-select) {
  display: inline-block !important;
  margin-bottom: 14px !important;
  margin-left: 0 !important;
  margin-inline-start: 0 !important;
  padding-left: 0 !important;
}

.upload-list-inline :deep(.ant-upload-list) {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 16px !important;
  width: 100% !important;
  margin-left: 0 !important;
  margin-inline-start: 0 !important;
  padding-left: 0 !important;
  padding-inline-start: 0 !important;
}

.upload-list-inline :deep(.ant-upload-list)::before,
.upload-list-inline :deep(.ant-upload-list)::after {
  display: none !important;
}

.upload-list-inline :deep(.ant-upload-list-item-container) {
  width: 250px !important;
  height: 68px !important;
  margin-left: 0 !important;
  margin-inline-start: 0 !important;
  margin-right: 16px !important;
  margin-bottom: 12px !important;
}

.upload-list-inline :deep(.ant-upload-list-item) {
  height: 100% !important;
  margin-left: 0 !important;
  margin-inline-start: 0 !important;
  margin-top: 0 !important;
  border-radius: 8px;
  padding: 6px 12px;
}
</style>
