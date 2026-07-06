<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { $t } from '#/locales';
import {
  Button,
  Table,
  Input,
  Select,
  Modal,
  Form,
  FormItem,
  Popconfirm,
  Tag,
  message,
  Spin,
} from 'ant-design-vue';
import {
  listUsersApi,
  storeUserApi,
  updateUserApi,
  destroyUserApi,
  type UserItem,
} from '#/api/core/users';
import axios from 'axios';
import { useAccessStore } from '@vben/stores';

// ─── Companies & Departments for dropdown ─────────────────────────────────────
interface DeptOption { id: string; name: string; company_id?: string }
interface CompanyOption { id: string; name: string }

const departments = ref<DeptOption[]>([]);
const companies = ref<CompanyOption[]>([]);

async function loadCompanies() {
  try {
    const accessStore = useAccessStore();
    const res = await axios.get('http://localhost:8000/api/companies', {
      headers: { Authorization: `Bearer ${accessStore.accessToken}`, Accept: 'application/json' },
    });
    const raw = res.data?.data ?? [];
    companies.value = raw.map((c: any) => ({ id: c.id, name: c.name }));
  } catch {
    // silently fail
  }
}

async function loadDepartments() {
  try {
    const accessStore = useAccessStore();
    const res = await axios.get('http://localhost:8000/api/departments', {
      headers: { Authorization: `Bearer ${accessStore.accessToken}`, Accept: 'application/json' },
    });
    const raw = res.data?.data ?? [];
    departments.value = raw.map((d: any) => ({ id: d.id, name: d.name, company_id: d.company_id }));
  } catch {
    // silently fail, dropdown will be empty
  }
}

function getDeptName(id?: string | null) {
  if (!id) return '—';
  const found = departments.value.find(d => d.id === id);
  return found ? found.name : id;
}

// ─── Role color map ───────────────────────────────────────────────────────────
const roleColorMap: Record<string, string> = {
  admin: 'red',
  manager: 'orange',
  user: 'blue',
  staff: 'cyan',
};

function roleColor(role: string) {
  return roleColorMap[role.toLowerCase()] ?? 'default';
}

// ─── Data & Search ────────────────────────────────────────────────────────────
const loading = ref(false);
const users = ref<UserItem[]>([]);
const searchVal = ref('');
const activeSearch = ref('');

async function loadUsers() {
  loading.value = true;
  try {
    users.value = await listUsersApi();
  } catch {
    message.error($t('page.company.users.loadError'));
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  activeSearch.value = searchVal.value;
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
}

const filteredUsers = computed(() => {
  const q = activeSearch.value.toLowerCase();
  if (!q) return users.value;
  return users.value.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.roles ?? []).some(r => r.toLowerCase().includes(q)),
  );
});

// ─── Table columns ────────────────────────────────────────────────────────────
const columns = computed(() => [
  {
    title: $t('page.company.users.colName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: UserItem, b: UserItem) => a.name.localeCompare(b.name),
  },
  {
    title: $t('page.company.users.colEmail'),
    dataIndex: 'email',
    key: 'email',
  },
  {
    title: $t('page.company.users.colDepartment'),
    dataIndex: 'department_id',
    key: 'department',
  },
  {
    title: $t('page.company.users.colRole'),
    dataIndex: 'roles',
    key: 'roles',
  },
  {
    title: $t('page.company.users.colCreatedAt'),
    dataIndex: 'created_at',
    key: 'created_at',
    sorter: (a: UserItem, b: UserItem) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  },
  {
    title: $t('page.company.colActions'),
    key: 'actions',
    width: 160,
    align: 'right' as const,
  },
]);

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// ─── Modal & Form ─────────────────────────────────────────────────────────────
const showModal = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);
const submitting = ref(false);

const formRef = ref();
const formState = ref({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  company_id: undefined as string | undefined,
  department_id: undefined as string | undefined,
  role: undefined as string | undefined,
});

const roleOptions = [
  { value: 'admin', label: 'ADMIN' },
  { value: 'manager', label: 'MANAGER' },
  { value: 'staff', label: 'STAFF' },
  { value: 'user', label: 'USER' },
];

const filteredDeptOptions = computed(() => {
  if (!formState.value.company_id) {
    return [];
  }
  return departments.value.filter(d => d.company_id === formState.value.company_id);
});

function handleCompanyChange() {
  formState.value.department_id = undefined;
}

const rules = computed(() => ({
  name: [{ required: true, message: $t('page.company.users.nameRequired') }],
  email: [
    { required: true, message: $t('page.company.users.emailRequired') },
    { type: 'email' as const, message: $t('page.company.users.emailInvalid') },
  ],
  password: isEditing.value
    ? []
    : [
        { required: true, message: $t('page.company.users.passwordRequired') },
        { min: 8, message: $t('page.company.users.passwordMin') },
      ],
  password_confirmation: isEditing.value
    ? []
    : [{ required: true, message: $t('page.company.users.passwordConfirmRequired') }],
}));

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    company_id: undefined,
    department_id: undefined,
    role: undefined,
  };
  showModal.value = true;
}

function openEditModal(record: any) {
  isEditing.value = true;
  editId.value = record.id;

  const deptId = record.department_id ?? undefined;
  let compId: string | undefined;
  if (deptId) {
    const found = departments.value.find(d => d.id === deptId);
    if (found) {
      compId = found.company_id || undefined;
    }
  }

  formState.value = {
    name: record.name,
    email: record.email,
    password: '',
    password_confirmation: '',
    company_id: compId,
    department_id: deptId,
    role: record.roles?.[0] ?? undefined,
  };
  showModal.value = true;
}

async function handleDelete(id: string) {
  try {
    await destroyUserApi(id);
    users.value = users.value.filter(u => u.id !== id);
    message.success($t('page.company.users.deleteSuccess'));
  } catch {
    message.error($t('page.company.users.deleteError'));
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;

    if (isEditing.value && editId.value) {
      const payload: any = {
        name: formState.value.name,
        email: formState.value.email,
        department_id: formState.value.department_id || null,
        role: formState.value.role || null,
      };
      if (formState.value.password) {
        payload.password = formState.value.password;
        payload.password_confirmation = formState.value.password_confirmation;
      }
      const updated = await updateUserApi(editId.value, payload);
      const idx = users.value.findIndex(u => u.id === editId.value);
      if (idx !== -1) users.value[idx] = updated;
      message.success($t('page.company.users.updateSuccess'));
    } else {
      const created = await storeUserApi({
        name: formState.value.name,
        email: formState.value.email,
        password: formState.value.password,
        password_confirmation: formState.value.password_confirmation,
        department_id: formState.value.department_id || null,
        role: formState.value.role || null,
      });
      users.value.push(created);
      message.success($t('page.company.users.createSuccess'));
    }
    showModal.value = false;
  } catch (err: any) {
    if (err?.errorFields) {
      // form validation errors, do nothing
    } else {
      const msg = err?.response?.data?.message ?? $t('page.company.users.saveError');
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  loadUsers();
  loadCompanies();
  loadDepartments();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.company.users.searchPlaceholder')"
        class="max-w-[280px]"
        allow-clear
        @press-enter="handleSearch"
      />
      <Button type="default" @click="handleSearch">
        {{ $t('page.company.btnFilter') }}
      </Button>
      <Button type="default" @click="handleReset">
        {{ $t('page.company.btnReset') }}
      </Button>
      <div class="ml-auto">
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full"
          @click="openAddModal"
        >
          {{ $t('page.company.users.btnAdd') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredUsers"
          row-key="id"
          :pagination="{ pageSize: 10 }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'department'">
              <span>{{ getDeptName(record.department_id) }}</span>
            </template>
            <template v-else-if="column.key === 'roles'">
              <Tag
                v-for="role in record.roles"
                :key="role"
                :color="roleColor(role)"
                class="uppercase font-semibold"
              >
                {{ role }}
              </Tag>
              <span v-if="!record.roles || record.roles.length === 0" class="text-gray-400">—</span>
            </template>
            <template v-else-if="column.key === 'created_at'">
              <span class="text-sm text-gray-500">{{ formatDate(record.created_at) }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button
                  size="small"
                  class="rounded hover:border-primary hover:text-primary"
                  @click="openEditModal(record as any)"
                >
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  ok-text="Yes"
                  cancel-text="No"
                  @confirm="handleDelete(record.id)"
                >
                  <Button
                    size="small"
                    danger
                    class="rounded bg-red-50/50 hover:bg-red-500 hover:text-white border-red-200"
                  >
                    {{ $t('page.company.btnDelete') }}
                  </Button>
                </Popconfirm>
              </div>
            </template>
          </template>
        </Table>
      </Spin>
    </div>

    <!-- Add/Edit Modal -->
    <Modal
      v-model:open="showModal"
      :title="isEditing ? $t('page.company.users.formTitleEdit') : $t('page.company.users.formTitleAdd')"
      :confirm-loading="submitting"
      ok-text="Xác nhận"
      cancel-text="Hủy"
      width="580px"
      @ok="handleOk"
      @cancel="showModal = false"
    >
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem :label="$t('page.company.users.colName')" name="name" class="col-span-2">
            <Input v-model:value="formState.name" :placeholder="$t('page.company.users.namePlaceholder')" />
          </FormItem>
          <FormItem :label="$t('page.company.users.colEmail')" name="email" class="col-span-2">
            <Input v-model:value="formState.email" :placeholder="$t('page.company.users.emailPlaceholder')" />
          </FormItem>
          <FormItem :label="$t('page.company.users.colCompany')" name="company_id" class="col-span-1">
            <Select
              v-model:value="formState.company_id"
              :placeholder="$t('page.company.users.selectCompanyPlaceholder')"
              allow-clear
              @change="handleCompanyChange"
            >
              <Select.Option v-for="c in companies" :key="c.id" :value="c.id">
                {{ c.name }}
              </Select.Option>
            </Select>
          </FormItem>
          <FormItem :label="$t('page.company.users.colDepartment')" name="department_id" class="col-span-1">
            <Select
              v-model:value="formState.department_id"
              :placeholder="$t('page.company.users.selectDeptPlaceholder')"
              :disabled="!formState.company_id"
              allow-clear
            >
              <Select.Option v-for="d in filteredDeptOptions" :key="d.id" :value="d.id">
                {{ d.name }}
              </Select.Option>
            </Select>
          </FormItem>
          <FormItem :label="$t('page.company.users.colRole')" name="role" class="col-span-2">
            <Select
              v-model:value="formState.role"
              :placeholder="$t('page.company.users.selectRolePlaceholder')"
              allow-clear
            >
              <Select.Option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </Select.Option>
            </Select>
          </FormItem>
          <FormItem
            :label="isEditing ? $t('page.company.users.passwordOptional') : $t('page.company.users.password')"
            name="password"
            class="col-span-1"
          >
            <Input.Password
              v-model:value="formState.password"
              :placeholder="isEditing ? $t('page.company.users.passwordOptionalPlaceholder') : $t('page.company.users.passwordPlaceholder')"
            />
          </FormItem>
          <FormItem :label="$t('page.company.users.passwordConfirm')" name="password_confirmation" class="col-span-1">
            <Input.Password
              v-model:value="formState.password_confirmation"
              :placeholder="$t('page.company.users.passwordConfirmPlaceholder')"
            />
          </FormItem>
        </div>
      </Form>
    </Modal>
  </div>
</template>
