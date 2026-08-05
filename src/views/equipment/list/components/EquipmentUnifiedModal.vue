<script lang="ts" setup>
import { ref, watch } from 'vue';
import {
  Modal,
  Tabs,
  Form,
  FormItem,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  QRCode,
  Spin,
  message,
} from 'ant-design-vue';
import axios from 'axios';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import { useAccessStore } from '@vben/stores';
import EquipmentHierarchyFlow from './EquipmentHierarchyFlow.vue';

const TabPane = Tabs.TabPane;

interface CategoryOption {
  id: string;
  code: string;
  name: string;
}

interface ErrorOption {
  id: string;
  name: string;
}

interface EquipmentData {
  id: string;
  code: string;
  name: string | null;
  equipment_category_id?: string | null;
  equipment_category?: CategoryOption | null;
  is_active?: boolean;
  maintenance_interval_hours?: number | null;
  parent_id?: string | null;
  equipment_errors?: Array<{ id: string; name?: string }> | null;
}

const props = withDefaults(
  defineProps<{
    open: boolean;
    equipmentId: string | null;
    initialTabKey?: string;
  }>(),
  {
    initialTabKey: 'info',
  }
);

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'saved'): void;
}>();

const activeTabKey = ref('info');
const loading = ref(false);
const saving = ref(false);

const categories = ref<CategoryOption[]>([]);
const errorsList = ref<ErrorOption[]>([]);

const equipmentData = ref<EquipmentData | null>(null);

const formState = ref({
  code: '',
  name: '',
  equipment_category_id: undefined as string | undefined,
  is_active: true,
  maintenance_interval_hours: undefined as number | undefined,
  parent_id: undefined as string | undefined,
  equipment_error_ids: [] as string[],
});

const qrContainerRef = ref<HTMLDivElement | null>(null);

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadOptions() {
  try {
    const [catRes, errRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/v1/equipment-categories`, { headers: getAuthHeaders(), params: { per_page: 1000 } }),
      axios.get(`${API_BASE_URL}/v1/equipment-errors`, { headers: getAuthHeaders(), params: { per_page: 1000 } }),
    ]);
    const rawCats = catRes.data?.data ?? catRes.data ?? [];
    categories.value = Array.isArray(rawCats) ? rawCats : [];

    const rawErrs = errRes.data?.data ?? errRes.data ?? [];
    errorsList.value = Array.isArray(rawErrs) ? rawErrs : [];
  } catch {
    // Silently handle option load failure
  }
}

async function loadEquipmentDetail() {
  if (!props.equipmentId) {
    equipmentData.value = null;
    formState.value = {
      code: '',
      name: '',
      equipment_category_id: undefined,
      is_active: true,
      maintenance_interval_hours: undefined,
      parent_id: undefined,
      equipment_error_ids: [],
    };
    return;
  }

  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/${props.equipmentId}`, {
      headers: getAuthHeaders(),
    });
    const data = res.data?.data ?? res.data;
    equipmentData.value = data;
    formState.value = {
      code: data.code || '',
      name: data.name || '',
      equipment_category_id: data.equipment_category_id || undefined,
      is_active: data.is_active !== undefined ? !!data.is_active : true,
      maintenance_interval_hours: data.maintenance_interval_hours ?? undefined,
      parent_id: data.parent_id || undefined,
      equipment_error_ids: data.equipment_errors?.map((err: { id: string }) => err.id) || [],
    };
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    message.error(error?.response?.data?.message || $t('page.equipment.msgLoadDetailError'));
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!formState.value.code.trim()) {
    message.warning($t('page.equipment.msgCodeRequired'));
    return;
  }

  saving.value = true;
  try {
    const payload = {
      code: formState.value.code.trim(),
      name: formState.value.name ? formState.value.name.trim() : null,
      equipment_category_id: formState.value.equipment_category_id || null,
      is_active: formState.value.is_active,
      maintenance_interval_hours: formState.value.maintenance_interval_hours ?? null,
      parent_id: formState.value.parent_id || null,
      equipment_error_ids: formState.value.equipment_error_ids || [],
    };

    if (props.equipmentId) {
      await axios.patch(`${API_BASE_URL}/v1/equipment/${props.equipmentId}`, payload, {
        headers: getAuthHeaders(),
      });
      message.success($t('page.equipment.msgUpdateEquipmentSuccess'));
    } else {
      await axios.post(`${API_BASE_URL}/v1/equipment`, payload, {
        headers: getAuthHeaders(),
      });
      message.success($t('page.equipment.msgCreateEquipmentSuccess'));
    }

    emit('saved');
    emit('update:open', false);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    message.error(error?.response?.data?.message || $t('page.equipment.msgSaveEquipmentError'));
  } finally {
    saving.value = false;
  }
}

function handlePrint() {
  if (!equipmentData.value && !formState.value.code) return;

  const eqCode = formState.value.code || equipmentData.value?.code || '—';
  const eqName = formState.value.name || equipmentData.value?.name || '—';
  const category = categories.value.find((c) => c.id === formState.value.equipment_category_id);
  const categoryName = category?.name || equipmentData.value?.equipment_category?.name || '';

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    message.error($t('page.equipment.msgPrintPopupBlocked'));
    return;
  }

  let qrDataUrl = '';
  if (qrContainerRef.value) {
    const canvas = qrContainerRef.value.querySelector('canvas');
    if (canvas) {
      qrDataUrl = canvas.toDataURL('image/png');
    } else {
      const img = qrContainerRef.value.querySelector('img');
      if (img) {
        qrDataUrl = img.src;
      }
    }
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${$t('page.equipment.btnPrintQr')} - ${eqCode}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 90vh;
            margin: 0;
            background: #ffffff;
            color: #111827;
          }
          .qr-card {
            border: 2px solid #111827;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            width: 300px;
          }
          .qr-image {
            width: 200px;
            height: 200px;
            margin: 0 auto 16px auto;
            display: block;
          }
          .eq-title { font-size: 16px; font-weight: 700; margin: 0 0 6px 0; word-break: break-word; }
          .eq-code {
            font-size: 13px; font-family: ui-monospace, SFMono-Regular, monospace;
            font-weight: 600; color: #374151; background: #f3f4f6;
            padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 6px;
          }
          .eq-category { font-size: 11px; color: #6b7280; margin: 0; }
        </style>
      </head>
      <body>
        <div class="qr-card">
          ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-image" alt="QR Code" />` : ''}
          <div class="eq-title">${eqName}</div>
          <div class="eq-code">${$t('page.equipment.colCode')}: ${eqCode}</div>
          ${categoryName ? `<p class="eq-category">${$t('page.equipment.colCategory')}: ${categoryName}</p>` : ''}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 250);
          };
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function handleClose() {
  emit('update:open', false);
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      activeTabKey.value = props.initialTabKey || 'info';
      loadOptions();
      loadEquipmentDetail();
    }
  },
  { immediate: true }
);
</script>

<template>
  <Modal
    :open="open"
    width="1200px"
    :title="equipmentData?.name ? $t('page.equipment.unifiedModalTitle', { name: equipmentData.name }) : $t('page.equipment.btnAddEquipment')"
    :destroy-on-close="true"
    @update:open="(val: boolean) => emit('update:open', val)"
  >
    <Spin :spinning="loading">
      <Tabs v-model:activeKey="activeTabKey" class="min-h-[380px]">
        <!-- ── Tab 1: Form Thông tin ── -->
        <TabPane key="info" :tab="$t('page.equipment.tabInfo')">
          <div class="py-3 px-1">
            <Form layout="vertical">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormItem :label="$t('page.equipment.colCode')" required>
                  <Input
                    v-model:value="formState.code"
                    :placeholder="$t('page.equipment.colCode')"
                  />
                </FormItem>

                <FormItem :label="$t('page.equipment.colName')" required>
                  <Input
                    v-model:value="formState.name"
                    :placeholder="$t('page.equipment.colName')"
                  />
                </FormItem>

                <FormItem :label="$t('page.equipment.colCategory')">
                  <Select
                    v-model:value="formState.equipment_category_id"
                    :placeholder="$t('page.equipment.filterCategoryPlaceholder')"
                    allow-clear
                  >
                    <Select.Option v-for="c in categories" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </Select.Option>
                  </Select>
                </FormItem>

                <FormItem :label="$t('page.equipment.colMaintenanceIntervalHours')">
                  <InputNumber
                    v-model:value="formState.maintenance_interval_hours"
                    :min="0"
                    style="width: 100%"
                    class="w-full"
                    :placeholder="$t('page.equipment.placeholderHours')"
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

                <FormItem :label="$t('page.equipment.colActive')">
                  <div class="pt-1">
                    <Switch v-model:checked="formState.is_active" />
                    <span class="ml-2 text-xs text-muted-foreground">
                      {{ formState.is_active ? $t('page.equipment.statusActive') : $t('page.equipment.statusInactive') }}
                    </span>
                  </div>
                </FormItem>
              </div>
            </Form>
          </div>
        </TabPane>

        <!-- ── Tab 2: Mã QR ── -->
        <TabPane key="qr" :tab="$t('page.equipment.tabQrCode')">
          <div class="flex flex-col items-center justify-center p-8 space-y-5 text-center min-h-[320px]">
            <div
              ref="qrContainerRef"
              class="p-5 bg-white border border-border rounded-2xl shadow-xs flex items-center justify-center"
            >
              <QRCode
                :value="props.equipmentId || formState.code || ''"
                :size="220"
                bordered
                color="#111827"
                bg-color="#ffffff"
              />
            </div>

            <div class="space-y-1.5 max-w-[440px]">
              <h3 class="text-lg font-bold text-foreground m-0 leading-snug">
                {{ formState.name || equipmentData?.name || '—' }}
              </h3>
              <div class="flex items-center justify-center gap-2">
                <span class="text-xs font-mono font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                  {{ $t('page.equipment.colCode') }}: {{ formState.code || equipmentData?.code || '—' }}
                </span>
              </div>
            </div>
          </div>
        </TabPane>
        <!-- ── Tab 3: Sơ đồ phân cấp (Xem) ── -->
        <TabPane key="hierarchy" :tab="$t('page.equipment.tabHierarchy')">
          <div class="py-2">
            <EquipmentHierarchyFlow
              v-if="props.equipmentId"
              :current-equipment-id="props.equipmentId"
              height="450px"
              :read-only="true"
            />
          </div>
        </TabPane>
      </Tabs>
    </Spin>

    <!-- Modal Footer with border-top -->
    <template #footer>
      <div class="border-t border-border pt-3 mt-2 flex items-center justify-end gap-2">
        <!-- Tab 1: Save / Cancel -->
        <template v-if="activeTabKey === 'info'">
          <Button @click="handleClose">
            {{ $t('page.equipment.modalCancel') }}
          </Button>
          <Button
            type="primary"
            class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] text-white font-medium"
            :loading="saving"
            @click="handleSave"
          >
            {{ $t('page.equipment.modalSave') }}
          </Button>
        </template>

        <!-- Tab 2: Print QR / Cancel -->
        <template v-else-if="activeTabKey === 'qr'">
          <Button @click="handleClose">
            {{ $t('page.equipment.modalCancel') }}
          </Button>
          <Button
            type="primary"
            class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] text-white flex items-center gap-1.5 font-medium"
            @click="handlePrint"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect width="12" height="8" x="6" y="14" rx="1"/></svg>
            {{ $t('page.equipment.btnPrintQr') }}
          </Button>
        </template>

        <!-- Tab 3 (Hierarchy): Close -->
        <template v-else>
          <Button @click="handleClose">
            {{ $t('page.equipment.modalCancel') }}
          </Button>
        </template>
      </div>
    </template>
  </Modal>
</template>
