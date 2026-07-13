<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeft } from '@vben/icons';
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
  Popconfirm,
  message,
  Spin,
  Card,
  Modal,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL, BACKEND_BASE_URL } from '#/api/config';

interface CategoryOption {
  id: string;
  code: string;
  name: string;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface EquipmentImageOption {
  id: string;
  image_id: string;
  path?: string | null;
}

interface UnitOption {
  id: string;
  name: string;
  code: string;
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

const formState = ref({
  code: '',
  name: '',
  equipment_category_id: undefined as string | undefined,
  is_active: true,
  maintenance_interval_hours: undefined as number | undefined,
  equipment_error_ids: [] as string[],
  equipment_parameters: [] as { id?: string; code: string; name: string; unit_id: string | undefined; standard?: number; standard_max?: number; standard_min?: number }[],
});

const existingImages = ref<EquipmentImageOption[]>([]);
const selectedFiles = ref<{ file: File; previewUrl: string }[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

function getImageUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const baseUrl = BACKEND_BASE_URL.endsWith('/') ? BACKEND_BASE_URL.slice(0, -1) : BACKEND_BASE_URL;
  const imagePath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${imagePath}`;
}

const previewVisible = ref(false);
const previewImage = ref('');
const previewTitle = ref('');

function handlePreview(url: string, title: string = 'Preview') {
  previewImage.value = url;
  previewVisible.value = true;
  previewTitle.value = title;
}

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

async function loadEquipmentDetail(id: string) {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/${id}`, {
      headers: getAuthHeaders(),
    });
    const record = res.data?.data ?? res.data;
    if (record) {
      formState.value = {
        code: record.code,
        name: record.name || '',
        equipment_category_id: record.equipment_category_id || undefined,
        is_active: !!record.is_active,
        maintenance_interval_hours: record.maintenance_interval_hours ?? undefined,
        equipment_error_ids: record.equipment_errors?.map((err: any) => err.id) || [],
        equipment_parameters: record.equipment_parameters?.map((param: any) => ({
          id: param.id,
          code: param.code,
          name: param.name,
          unit_id: param.unit_id || undefined,
          standard: param.standard ?? undefined,
          standard_max: param.standard_max ?? undefined,
          standard_min: param.standard_min ?? undefined,
        })) || [],
      };
      existingImages.value = record.equipment_images ? [...record.equipment_images] : [];
    }
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Không thể tải chi tiết thiết bị');
    goBack();
  } finally {
    loading.value = false;
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const newFiles = Array.from(target.files).map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    selectedFiles.value.push(...newFiles);
  }
  target.value = '';
}

function removeSelectedFile(index: number) {
  const item = selectedFiles.value[index];
  if (item) {
    URL.revokeObjectURL(item.previewUrl);
    selectedFiles.value.splice(index, 1);
  }
}

async function removeExistingImage(index: number) {
  const image = existingImages.value[index];
  if (!image) return;

  if (editId.value) {
    try {
      submitting.value = true;
      const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      };
      
      const stepFormData = buildBaseFormData();
      const remainingImageIds = existingImages.value
        .filter((_, idx) => idx !== index)
        .map(img => img.id);

      remainingImageIds.forEach(id => {
        stepFormData.append('existing_image_ids[]', id);
      });
      stepFormData.append('_method', 'PUT');

      const res = await axios.post(`${API_BASE_URL}/v1/equipment/${editId.value}`, stepFormData, {
        headers,
      });

      const updatedRecord = res.data?.data ?? res.data;
      if (updatedRecord && updatedRecord.equipment_images) {
        existingImages.value = [...updatedRecord.equipment_images];
      } else {
        existingImages.value.splice(index, 1);
      }
      message.success('Xóa ảnh khỏi máy chủ thành công');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể xóa ảnh khỏi máy chủ';
      message.error(msg);
    } finally {
      submitting.value = false;
    }
  } else {
    existingImages.value.splice(index, 1);
  }
}

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
    let currentExistingImageIds = existingImages.value.map(img => img.id);

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
        currentExistingImageIds = updatedRecord.equipment_images.map((img: any) => img.id);
      }
      message.success('Cập nhật thông tin thiết bị thành công');
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
          currentExistingImageIds = createdRecord.equipment_images.map((img: any) => img.id);
        }
      }
      message.success('Thêm thiết bị thành công');
    }

    // 2. Upload queue sequentially for new images
    if (currentEquipmentId && selectedFiles.value.length > 0) {
      for (let i = 0; i < selectedFiles.value.length; i++) {
        const item = selectedFiles.value[i];
        if (!item) continue;
        const msgKey = `upload_img_${i}`;
        
        message.loading({
          content: `Đang tải lên ảnh ${i + 1}/${selectedFiles.value.length}...`,
          key: msgKey,
          duration: 0,
        });

        try {
          const stepFormData = buildBaseFormData();
          // Retain all existing images including previously uploaded ones in the loop
          currentExistingImageIds.forEach(id => {
            stepFormData.append('existing_image_ids[]', id);
          });
          // Upload just one file in the current step
          stepFormData.append('uploaded_images[]', item.file);
          stepFormData.append('_method', 'PUT');

          const res = await axios.post(`${API_BASE_URL}/v1/equipment/${currentEquipmentId}`, stepFormData, {
            headers,
          });

          const updatedRecord = res.data?.data ?? res.data;
          if (updatedRecord && updatedRecord.equipment_images) {
            currentExistingImageIds = updatedRecord.equipment_images.map((img: any) => img.id);
          }

          message.success({
            content: `Đã tải xong ảnh ${i + 1}/${selectedFiles.value.length}`,
            key: msgKey,
          });
        } catch (uploadErr) {
          message.error({
            content: `Tải lên thất bại ảnh ${i + 1}/${selectedFiles.value.length}`,
            key: msgKey,
          });
          throw uploadErr;
        }
      }
    }
    if (!isEditing.value && currentEquipmentId) {
      router.replace({ name: 'EquipmentDetail', query: { id: currentEquipmentId } });
    }
  } catch (err: any) {
    if (err?.errorFields) {
      // Form validation failed
    } else {
      const msg = err?.response?.data?.message || 'Không thể lưu thiết bị';
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  router.push({ name: 'EquipmentList' });
}

onMounted(() => {
  loadCategories();
  loadErrors();
  loadUnits();

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
        <Button class="flex items-center justify-center" @click="goBack">
          <ChevronLeft class="size-5" />
        </Button>
        <h1 class="text-xl font-bold text-gray-800 m-0">
          {{ isEditing ? $t('page.equipment.btnEditEquipment') : $t('page.equipment.btnAddEquipment') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <Button type="default" @click="goBack" :disabled="submitting">
          {{ $t('page.equipment.btnCancel') }}
        </Button>
        <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]" :loading="submitting" @click="handleSubmit">
          {{ $t('page.equipment.btnSave') }}
        </Button>
      </div>
    </div>

    <!-- Content Card -->
    <Card class="shadow-sm border-border rounded-xl">
      <Spin :spinning="loading || submitting">
        <Form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
        >
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
            <FormItem :label="$t('page.equipment.colActive')" name="is_active" class="col-span-2">
              <Switch v-model:checked="formState.is_active" />
            </FormItem>

            <!-- Images Dynamic List -->
            <div class="col-span-2 border-t border-gray-150 pt-4 mt-2">
              <div class="mb-3">
                <span class="font-semibold text-gray-700 block mb-3">{{ $t('page.equipment.imagesTitle') }}</span>
                
                <!-- Existing images -->
                <div v-if="existingImages.length > 0" class="mb-4">
                  <span class="text-xs text-gray-400 block mb-2 font-medium">{{ $t('page.equipment.existingImagesTitle') }}:</span>
                  <div class="flex flex-row overflow-x-auto gap-3 pb-3 w-full scrollbar-thin">
                    <div v-for="(img, idx) in existingImages" :key="img.id" class="relative group h-40 shrink-0 rounded border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shadow-sm">
                      <img v-if="img.path" :src="getImageUrl(img.path)" class="h-full w-auto object-contain" />
                      <span v-else class="text-[10px] text-gray-400 text-center px-1 truncate">{{ img.image_id }}</span>
                      <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <Button type="text" size="small" class="text-white hover:text-blue-300 p-0 font-medium" @click="handlePreview(getImageUrl(img.path), img.image_id)">
                          {{ $t('page.equipment.btnViewImage') }}
                        </Button>
                        <Popconfirm
                          :title="$t('page.equipment.deleteImageConfirm')"
                          ok-text="Yes"
                          cancel-text="No"
                          @confirm="removeExistingImage(idx)"
                        >
                          <Button type="text" danger size="small" class="text-white hover:text-red-400 p-0 font-medium">
                            {{ $t('page.equipment.btnDeleteImage') }}
                          </Button>
                        </Popconfirm>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Upload field -->
                <div class="flex items-center gap-3">
                  <input type="file" multiple accept="image/*" class="hidden" ref="fileInputRef" @change="handleFileChange" />
                  <Button type="dashed" @click="triggerFileInput">
                    {{ $t('page.equipment.btnChooseImages') }}
                  </Button>
                  <span v-if="selectedFiles.length > 0" class="text-xs text-gray-500 font-medium">
                    {{ $t('page.equipment.selectedImages', { count: selectedFiles.length }) }}
                  </span>
                </div>

                <!-- File preview -->
                <div v-if="selectedFiles.length > 0" class="mt-4">
                  <span class="text-xs text-gray-400 block mb-2 font-medium">{{ $t('page.equipment.newImagesTitle') }}:</span>
                  <div class="flex flex-row overflow-x-auto gap-3 pb-3 w-full scrollbar-thin">
                    <div v-for="(item, idx) in selectedFiles" :key="idx" class="relative group h-40 shrink-0 rounded border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shadow-sm">
                      <img :src="item.previewUrl" class="h-full w-auto object-contain" />
                      <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <Button type="text" size="small" class="text-white hover:text-blue-300 p-0 font-medium" @click="handlePreview(item.previewUrl, item.file.name)">
                          {{ $t('page.equipment.btnViewImage') }}
                        </Button>
                        <Button type="text" danger size="small" class="text-white hover:text-red-400 p-0 font-medium" @click="removeSelectedFile(idx)">
                          {{ $t('page.equipment.btnDeleteImage') }}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <FormItem :label="$t('page.equipment.colErrors')" name="equipment_error_ids" class="col-span-2">
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

            <!-- Parameters Dynamic List -->
            <div class="col-span-2 border-t border-gray-150 pt-4 mt-2">
              <div class="flex items-center justify-between mb-3">
                <span class="font-semibold text-gray-700">{{ $t('page.equipment.parametersTitle') }}</span>
                <Button type="dashed" size="small" @click="addParameterRow">
                  {{ $t('page.equipment.btnAddParameter') }}
                </Button>
              </div>
              <div v-if="formState.equipment_parameters.length === 0" class="text-center py-4 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                {{ $t('page.equipment.noParameters') }}
              </div>
              <div v-else class="space-y-3">
                <div v-for="(param, index) in formState.equipment_parameters" :key="index" class="flex flex-wrap md:flex-nowrap gap-2 items-end bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                  <div class="flex-1 min-w-[150px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">Mã thông số</span>
                    <Input v-model:value="param.code" placeholder="Mã thông số" />
                  </div>
                  <div class="w-[120px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">Tiêu chuẩn</span>
                    <InputNumber v-model:value="param.standard" placeholder="Tiêu chuẩn" class="w-full" />
                  </div>
                  <div class="w-[120px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">Tối thiểu</span>
                    <InputNumber v-model:value="param.standard_min" placeholder="Tối thiểu" class="w-full" />
                  </div>
                  <div class="w-[120px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">Tối đa</span>
                    <InputNumber v-model:value="param.standard_max" placeholder="Tối đa" class="w-full" />
                  </div>
                  <div class="w-[180px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">Đơn vị</span>
                    <Select v-model:value="param.unit_id" placeholder="Đơn vị" class="w-full" allow-clear>
                      <Select.Option v-for="u in units" :key="u.id" :value="u.id">
                        {{ u.name }} ({{ u.code }})
                      </Select.Option>
                    </Select>
                  </div>
                  <div>
                    <Button type="text" danger @click="removeParameterRow(index)">
                      Xóa
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Form>
      </Spin>
    </Card>

    <!-- Image Preview Modal -->
    <Modal :open="previewVisible" :title="previewTitle" :footer="null" @cancel="previewVisible = false">
      <img alt="preview" style="width: 100%" :src="previewImage" />
    </Modal>
  </div>
</template>
