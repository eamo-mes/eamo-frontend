<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { $t } from '#/locales';
import { useCompanyStore } from '#/store/company';
import { useAccessStore } from '@vben/stores';
import { API_BASE_URL } from '#/api/config';
import axios from 'axios';
import { 
  Button, 
  Table, 
  Input, 
  Select, 
  Modal, 
  Form, 
  FormItem,
  Popconfirm,
  message,
  Spin
} from 'ant-design-vue';

const companyStore = useCompanyStore();
const loading = ref(false);
const submitting = ref(false);

const BASE_URL = API_BASE_URL;

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadCompanies() {
  try {
    const res = await axios.get(`${BASE_URL}/companies`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? [];
    companyStore.companies = raw;
  } catch {
    // silently fail
  }
}

async function loadDepartments() {
  loading.value = true;
  try {
    const res = await axios.get(`${BASE_URL}/departments`, {
      headers: getAuthHeaders(),
    });
    const raw = res.data?.data ?? [];
    companyStore.departments = raw;
  } catch {
    message.error('Không thể tải danh sách phòng ban');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadDepartments();
  loadCompanies();
});

// Search State
const searchVal = ref('');
const activeSearch = ref('');

function handleSearch() {
  activeSearch.value = searchVal.value;
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
}

const filteredDepartments = computed(() => {
  return companyStore.departments.filter(item => {
    return !activeSearch.value || 
      item.name.toLowerCase().includes(activeSearch.value.toLowerCase()) ||
      (item.contact && item.contact.toLowerCase().includes(activeSearch.value.toLowerCase()));
  });
});

// Modal & Form State
const showModal = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);

const formRef = ref();
const formState = ref({
  name: '',
  company_id: '',
  contact: ''
});

const rules = {
  name: [{ required: true, message: 'Vui lòng nhập tên phòng ban' }],
  company_id: [{ required: true, message: 'Vui lòng chọn công ty' }]
};

const columns = computed(() => [
  {
    title: $t('page.company.colDeptName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: any, b: any) => a.name.localeCompare(b.name)
  },
  {
    title: $t('page.company.colCompany'),
    dataIndex: 'company_name',
    key: 'company_id'
  },
  {
    title: $t('page.company.colContact'),
    dataIndex: 'contact',
    key: 'contact'
  },
  {
    title: $t('page.company.colActions'),
    key: 'actions',
    width: 150,
    align: 'right' as const
  }
]);

function getCompanyName(companyId: string | number) {
  const comp = companyStore.companies.find(c => String(c.id) === String(companyId));
  return comp ? comp.name : companyId;
}

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    name: '',
    company_id: '',
    contact: ''
  };
  showModal.value = true;
}

function openEditModal(record: any) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    name: record.name,
    company_id: record.company_id,
    contact: record.contact || ''
  };
  showModal.value = true;
}

async function handleDelete(id: any) {
  try {
    await axios.delete(`${BASE_URL}/departments/${id}`, {
      headers: getAuthHeaders(),
    });
    companyStore.departments = companyStore.departments.filter(d => d.id !== id);
    message.success('Xóa phòng ban thành công');
  } catch {
    message.error('Không thể xóa phòng ban');
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;
    
    if (isEditing.value && editId.value) {
      const res = await axios.put(`${BASE_URL}/departments/${editId.value}`, {
        name: formState.value.name,
        company_id: formState.value.company_id,
        contact: formState.value.contact,
      }, {
        headers: getAuthHeaders(),
      });
      const updated = res.data?.data ?? res.data;
      const idx = companyStore.departments.findIndex(d => d.id === editId.value);
      if (idx !== -1) {
        companyStore.departments[idx] = updated;
      }
      message.success('Cập nhật thông tin phòng ban thành công');
    } else {
      const res = await axios.post(`${BASE_URL}/departments`, {
        name: formState.value.name,
        company_id: formState.value.company_id,
        contact: formState.value.contact,
      }, {
        headers: getAuthHeaders(),
      });
      const created = res.data?.data ?? res.data;
      companyStore.departments.push(created);
      message.success('Thêm phòng ban thành công');
    }
    showModal.value = false;
  } catch (error: any) {
    if (error?.errorFields) {
      // form validation failed
    } else {
      const msg = error?.response?.data?.message ?? 'Không thể lưu phòng ban';
      message.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.company.searchPlaceholderDept')"
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
        <Button type="primary" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white h-full" @click="openAddModal">
          {{ $t('page.company.btnAddDept') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredDepartments"
          row-key="id"
          :pagination="{ pageSize: 5 }"
          class="w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'company_id'">
              <span>{{ record.company_name || getCompanyName(record.company_id) }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="space-x-2">
                <Button size="small" class="rounded hover:border-primary hover:text-primary" @click="openEditModal(record)">
                  {{ $t('page.company.btnEdit') }}
                </Button>
                <Popconfirm
                  :title="$t('page.company.deleteConfirm')"
                  ok-text="Yes"
                  cancel-text="No"
                  @confirm="handleDelete(record.id)"
                >
                  <Button size="small" danger class="rounded bg-red-50/50 hover:bg-red-500 hover:text-white border-red-200">
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
      :title="isEditing ? $t('page.company.formTitleEditDept') : $t('page.company.formTitleAddDept')"
      :confirm-loading="submitting"
      @ok="handleOk"
      @cancel="showModal = false"
      ok-text="Xác nhận"
      cancel-text="Hủy"
      width="550px"
    >
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <FormItem :label="$t('page.company.colDeptName')" name="name">
          <Input v-model:value="formState.name" placeholder="Ví dụ: Phòng Nghiên cứu phát triển..." />
        </FormItem>
        <FormItem :label="$t('page.company.colCompany')" name="company_id">
          <Select v-model:value="formState.company_id" :placeholder="$t('page.company.pleaseSelectCompany')">
            <Select.Option v-for="c in companyStore.companies" :key="c.id" :value="c.id">
              {{ c.name }}
            </Select.Option>
          </Select>
        </FormItem>
        <FormItem :label="$t('page.company.colContact')" name="contact">
          <Input v-model:value="formState.contact" placeholder="Tên liên hệ, số điện thoại, email..." />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>
