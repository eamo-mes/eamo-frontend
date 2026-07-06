<script lang="ts" setup>
import { ref, computed } from 'vue';
import { $t } from '#/locales';
import { useCompanyStore } from '#/store/company';
import { 
  Button, 
  Table, 
  Input, 
  Modal, 
  Form, 
  FormItem,
  Popconfirm,
  message 
} from 'ant-design-vue';

const companyStore = useCompanyStore();

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

const filteredCompanies = computed(() => {
  return companyStore.companies.filter(item => {
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

function handleDelete(id: any) {
  companyStore.companies = companyStore.companies.filter(c => c.id !== id);
  // Also delete departments associated with this company
  companyStore.departments = companyStore.departments.filter(d => d.company_id !== id);
  message.success('Xóa công ty thành công');
}

async function handleOk() {
  try {
    await formRef.value.validateFields();
    if (isEditing.value && editId.value) {
      const idx = companyStore.companies.findIndex(c => c.id === editId.value);
      if (idx !== -1) {
        companyStore.companies[idx] = {
          id: editId.value,
          name: formState.value.name,
          contact: formState.value.contact
        };
      }
      message.success('Cập nhật thông tin công ty thành công');
    } else {
      const newCompany = {
        id: String(Date.now()),
        name: formState.value.name,
        contact: formState.value.contact
      };
      companyStore.companies.push(newCompany);
      message.success('Thêm công ty thành công');
    }
    showModal.value = false;
  } catch (error) {
    console.error('Validation failed:', error);
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Action Bar -->
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
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
      <Table
        :columns="columns"
        :data-source="filteredCompanies"
        row-key="id"
        :pagination="{ pageSize: 5 }"
        class="w-full"
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
    </div>

    <!-- Add/Edit Modal -->
    <Modal
      v-model:open="showModal"
      :title="isEditing ? $t('page.company.formTitleEditCompany') : $t('page.company.formTitleAddCompany')"
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
