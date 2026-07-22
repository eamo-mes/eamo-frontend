<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeft } from '@vben/icons';
import { $t } from '#/locales';
import {
  Breadcrumb,
  Button,
  Input,
  Select,
  Form,
  FormItem,
  Popconfirm,
  message,
  Spin,
  Card,
} from 'ant-design-vue';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import { listUsersApi, type UserItem } from '#/api/core/users';

interface MaintenanceItemRow {
  id?: string;
  name: string;
  description: string;
  user_ids: string[];
  _key: string;
}

interface CategoryDetailRecord {
  id: string;
  name: string;
  description: string | null;
  maintenance_items?: {
    id: string;
    name: string;
    description: string | null;
    users?: {
      id: string;
      name: string;
    }[];
  }[];
}

interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);

const formRef = ref();
const formState = ref({
  name: '',
  description: '',
  items: [] as MaintenanceItemRow[],
});

const rules = computed(() => ({
  name: [{ required: true, message: $t('page.ops.validationCategoryName') }],
}));

const users = ref<UserItem[]>([]);

const userOptions = computed(() =>
  users.value.map(u => ({
    label: u.name,
    value: u.id,
  }))
);

function getAuthHeaders(): Record<string, string> {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function generateKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function addItemRow(): void {
  formState.value.items.push({
    name: '',
    description: '',
    user_ids: [],
    _key: generateKey(),
  });
}

function removeItemRow(index: number): void {
  formState.value.items.splice(index, 1);
}

async function loadUsers(): Promise<void> {
  try {
    users.value = await listUsersApi({ per_page: 1000 });
  } catch {
    // silently fail
  }
}

async function loadCategoryDetail(id: string): Promise<void> {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/maintenance-categories`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000, with_trashed: true },
    });
    const raw = res.data?.data ?? res.data ?? [];
    const list = Array.isArray(raw) ? (raw as CategoryDetailRecord[]) : [];
    const record = list.find(c => c.id === id);
    if (record) {
      formState.value = {
        name: record.name || '',
        description: record.description || '',
        items: (record.maintenance_items ?? []).map(item => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          user_ids: (item.users ?? []).map(u => u.id),
          _key: generateKey(),
        })),
      };
    } else {
      message.error($t('page.ops.loadError'));
      goBack();
    }
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    message.error(apiError || $t('page.ops.loadError'));
    goBack();
  } finally {
    loading.value = false;
  }
}

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    const payload = {
      name: formState.value.name,
      description: formState.value.description,
      items: formState.value.items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        user_ids: item.user_ids,
      })),
    };

    if (isEditing.value && editId.value) {
      await axios.put(`${API_BASE_URL}/v1/maintenance-categories/${editId.value}`, payload, {
        headers: getAuthHeaders(),
      });
      message.success($t('page.ops.saveSuccess'));
    } else {
      await axios.post(`${API_BASE_URL}/v1/maintenance-categories`, payload, {
        headers: getAuthHeaders(),
      });
      message.success($t('page.ops.saveSuccess'));
    }
    goBack();
  } catch (err: unknown) {
    const apiError = (err as AxiosErrorResponse)?.response?.data?.message;
    if (apiError || (err as Error).message) {
      message.error(apiError || $t('page.ops.saveError'));
    }
  } finally {
    submitting.value = false;
  }
}

function goBack(): void {
  router.push({ name: 'OpsMaintenanceCategories' });
}

onMounted(() => {
  loadUsers();

  const id = route.query.id as string;
  if (id) {
    isEditing.value = true;
    editId.value = id;
    loadCategoryDetail(id);
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
        { title: $t('page.ops.maintenanceTitle') },
        { title: $t('page.ops.maintenanceCategories'), href: '/maintenance/maintenance-categories' },
        { title: isEditing ? $t('page.ops.btnEditCategory') : $t('page.ops.btnAddCategory') },
      ]"
    />

    <!-- Header -->
    <div class="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
      <div class="flex items-center gap-3">
        <Button class="flex items-center justify-center" @click="goBack">
          <ChevronLeft class="size-5" />
        </Button>
        <h1 class="text-xl font-bold text-gray-800 m-0">
          {{ isEditing ? $t('page.ops.btnEditCategory') : $t('page.ops.btnAddCategory') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <Button type="default" @click="goBack" :disabled="submitting">
          {{ $t('page.ops.btnCancel') }}
        </Button>
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35]"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ $t('page.ops.btnSave') }}
        </Button>
      </div>
    </div>

    <!-- Category Detail Form -->
    <div>
      <Spin :spinning="loading || submitting">
        <Form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
          class="space-y-6"
        >
          <!-- Single Combined Card -->
          <Card class="shadow-sm border-border rounded-xl">
            <!-- Category Base Info -->
            <div class="grid grid-cols-2 gap-x-4">
              <FormItem :label="$t('page.ops.categoryName')" name="name" class="col-span-1">
                <Input v-model:value="formState.name" :placeholder="$t('page.ops.placeholderCategoryName')" />
              </FormItem>

              <FormItem :label="$t('page.ops.categoryDescription')" name="description" class="col-span-1">
                <Input v-model:value="formState.description" :placeholder="$t('page.ops.placeholderCategoryDesc')" />
              </FormItem>
            </div>

            <!-- Nested Maintenance Items Section -->
            <div class="mt-4 pt-4 border-t border-border">
              <div class="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div class="font-semibold text-gray-800 text-base">
                    {{ $t('page.ops.nestedItemsTitle') }}
                  </div>
                </div>
              </div>

              <!-- Items list -->
              <div v-if="formState.items.length === 0" class="py-5 text-center text-sm text-muted-foreground">
                {{ $t('page.ops.noItems') }}
              </div>

              <div v-else class="max-h-[360px] overflow-y-auto divide-y divide-border pr-2 scrollbar-thin">
                <div
                  v-for="(item, idx) in formState.items"
                  :key="item._key"
                  class="flex flex-wrap items-end gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <!-- Tên hạng mục -->
                  <div class="flex-1 min-w-[200px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colItemName') }}</span>
                    <Input
                      v-model:value="item.name"
                      :placeholder="$t('page.ops.placeholderItemName')"
                    />
                  </div>

                  <!-- Mô tả -->
                  <div class="flex-1 min-w-[250px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.colItemDesc') }}</span>
                    <Input
                      v-model:value="item.description"
                      :placeholder="$t('page.ops.placeholderItemDesc')"
                    />
                  </div>

                  <!-- Kỹ thuật viên thực hiện -->
                  <div class="flex-1 min-w-[200px]">
                    <span class="text-xs text-gray-500 block mb-1 font-medium">{{ $t('page.ops.assignedTechnicians') }}</span>
                    <Select
                      v-model:value="item.user_ids"
                      :options="userOptions"
                      :placeholder="$t('page.ops.placeholderAssignedUsers')"
                      mode="multiple"
                      option-filter-prop="label"
                      show-search
                      allow-clear
                      class="w-full"
                    />
                  </div>

                  <!-- Nút Xóa -->
                  <div class="pb-1">
                    <Popconfirm
                      :title="$t('page.company.deleteConfirm')"
                      ok-text="Yes"
                      cancel-text="No"
                      @confirm="removeItemRow(idx)"
                    >
                      <Button
                        type="text"
                        danger
                        class="shrink-0 px-2"
                      >
                        {{ $t('page.company.btnDelete') }}
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>

              <Button type="dashed" block class="mt-3" @click="addItemRow">
                + {{ $t('page.ops.btnAddItem') }}
              </Button>
            </div>
          </Card>
        </Form>
      </Spin>
    </div>
  </div>
</template>

<style scoped>
/* Card gap spacing between cards */
:deep(.ant-card + .ant-card) {
  margin-top: 24px !important;
}
</style>
