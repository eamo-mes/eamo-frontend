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

// Pagination State
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

async function loadCompanies(page = currentPage.value, size = pageSize.value) {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page,
      per_page: size,
    };
    if (activeSearch.value) {
      params.search = activeSearch.value;
    }
    const res = await axios.get(`${BASE_URL}/companies`, {
      headers: getAuthHeaders(),
      params,
    });
    const raw = res.data?.data ?? [];
    companyStore.companies = raw;
    total.value = res.data?.meta?.total ?? raw.length;
    currentPage.value = res.data?.meta?.current_page ?? page;
  } catch {
    message.error('Không thể tải danh sách công ty');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadCompanies();
});

// Search State
const searchVal = ref('');
const activeSearch = ref('');

function handleSearch() {
  activeSearch.value = searchVal.value;
  currentPage.value = 1;
  loadCompanies(1);
}

function handleReset() {
  searchVal.value = '';
  activeSearch.value = '';
  currentPage.value = 1;
  loadCompanies(1);
}

function handleTableChange(pagination: any) {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  loadCompanies(pagination.current, pagination.pageSize);
}

const filteredCompanies = computed(() => companyStore.companies);

// Modal & Form State
const showModal = ref(false);
const isEditing = ref(false);
const editId = ref<string | null>(null);

const formRef = ref();
const formState = ref({
  name: '',
  contact: ''
});

const rules = {
  name: [{ required: true, message: 'Vui lòng nhập tên công ty' }]
};

const columns = computed(() => [
  {
    title: $t('page.company.colName'),
    dataIndex: 'name',
    key: 'name',
    sorter: (a: any, b: any) => a.name.localeCompare(b.name)
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

function openAddModal() {
  isEditing.value = false;
  editId.value = null;
  formState.value = {
    name: '',
    contact: ''
  };
  showModal.value = true;
}

function openEditModal(record: any) {
  isEditing.value = true;
  editId.value = record.id;
  formState.value = {
    name: record.name,
    contact: record.contact || ''
  };
  showModal.value = true;
}

async function handleDelete(id: any) {
  try {
    await axios.delete(`${BASE_URL}/companies/${id}`, {
      headers: getAuthHeaders(),
    });
    companyStore.companies = companyStore.companies.filter(c => c.id !== id);
    // Also delete departments associated with this company
    companyStore.departments = companyStore.departments.filter(d => d.company_id !== id);
    message.success('Xóa công ty thành công');
  } catch {
    message.error('Không thể xóa công ty');
  }
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    submitting.value = true;
    
    if (isEditing.value && editId.value) {
      const res = await axios.put(`${BASE_URL}/companies/${editId.value}`, {
        name: formState.value.name,
        contact: formState.value.contact,
      }, {
        headers: getAuthHeaders(),
      });
      const updated = res.data?.data ?? res.data;
      const idx = companyStore.companies.findIndex(c => c.id === editId.value);
      if (idx !== -1) {
        companyStore.companies[idx] = updated;
      }
      message.success('Cập nhật thông tin công ty thành công');
    } else {
      const res = await axios.post(`${BASE_URL}/companies`, {
        name: formState.value.name,
        contact: formState.value.contact,
      }, {
        headers: getAuthHeaders(),
      });
      const created = res.data?.data ?? res.data;
      companyStore.companies.push(created);
      message.success('Thêm công ty thành công');
    }
    showModal.value = false;
  } catch (error: any) {
    if (error?.errorFields) {
      // form validation failed
    } else {
      const msg = error?.response?.data?.message ?? 'Không thể lưu công ty';
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
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto w-full">
      <Input
        v-model:value="searchVal"
        :placeholder="$t('page.company.searchPlaceholderInfo')"
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
          {{ $t('page.company.btnAddCompany') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <Spin :spinning="loading">
        <Table
          :columns="columns"
          :data-source="filteredCompanies"
          row-key="id"
          :scroll="{ x: 'max-content' }"
          :pagination="{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (tot: number) => $t('page.totalRecords', { total: tot }),
          }"
          class="w-full"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actions'">
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
      :title="isEditing ? $t('page.company.formTitleEditCompany') : $t('page.company.formTitleAddCompany')"
      :confirm-loading="submitting"
      @ok="handleOk"
      @cancel="showModal = false"
      ok-text="Xác nhận"
      cancel-text="Hủy"
      width="500px"
    >
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <FormItem :label="$t('page.company.colName')" name="name">
          <Input v-model:value="formState.name" />
        </FormItem>
        <FormItem :label="$t('page.company.colContact')" name="contact">
          <Input v-model:value="formState.contact" placeholder="Tên liên hệ, số điện thoại, email..." />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>
