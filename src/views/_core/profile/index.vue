<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Card, Form, FormItem, Input, Button, Tag, message } from 'ant-design-vue';
import { useUserStore } from '@vben/stores';
import { $t } from '#/locales';
import { updateUserInfoApi, getUserInfoApi } from '#/api';

defineOptions({ name: 'Profile' });

const InputPassword = Input.Password;
const userStore = useUserStore();
const submitting = ref(false);
const formRef = ref();

const formState = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const roles = ref<string[]>([]);

// Load current user info
onMounted(async () => {
  try {
    const data = await getUserInfoApi();
    formState.value.name = data.realName || '';
    formState.value.email = data.username || '';
    roles.value = data.roles || [];
  } catch (error) {
    console.error('Failed to load user info:', error);
    // Fallback to store
    formState.value.name = userStore.userInfo?.realName || '';
    formState.value.email = userStore.userInfo?.username || '';
    roles.value = userStore.userInfo?.roles || [];
  }
});

const rules = computed<Record<string, any>>(() => ({
  name: [
    { required: true, message: $t('page.profile.nameRequired'), trigger: 'blur' }
  ],
  email: [
    { required: true, message: $t('page.profile.emailRequired'), trigger: 'blur' },
    { type: 'email', message: $t('page.profile.emailInvalid'), trigger: 'blur' }
  ],
  password: [
    { min: 6, message: $t('page.profile.passwordMin'), trigger: 'blur' }
  ],
  confirmPassword: [
    {
      validator: async (_rule: any, value: string) => {
        if (formState.value.password && !value) {
          return Promise.reject($t('page.profile.confirmPasswordRequired'));
        }
        if (value && value !== formState.value.password) {
          return Promise.reject($t('page.profile.passwordMismatch'));
        }
        return Promise.resolve();
      },
      trigger: 'change'
    }
  ]
}));

async function handleUpdate() {
  try {
    submitting.value = true;
    await formRef.value.validateFields();

    const payload: any = {
      name: formState.value.name,
      email: formState.value.email,
    };

    if (formState.value.password) {
      payload.password = formState.value.password;
      payload.confirmPassword = formState.value.confirmPassword;
    }

    const updatedUser = await updateUserInfoApi(payload);

    // Update store
    if (userStore.userInfo) {
      userStore.setUserInfo({
        ...userStore.userInfo,
        realName: updatedUser.realName,
        username: updatedUser.username,
      });
    }

    message.success($t('page.profile.updateSuccess'));

    // Clear password fields
    formState.value.password = '';
    formState.value.confirmPassword = '';
  } catch (error: any) {
    console.error('Update failed:', error);
    if (error?.response?.data?.message) {
      message.error(error.response.data.message);
    } else if (error?.errorFields) {
      // Form validation error, do not show message toast as it shows red hints
    } else {
      message.error($t('page.profile.updateError'));
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="p-6 flex justify-center items-center min-h-[80vh]">
    <Card class="w-full max-w-[600px] shadow-md border-border rounded-xl bg-card">
      <template #title>
        <div class="flex items-center gap-3">
          <span>{{ $t('page.auth.profile') }}</span>
          <Tag v-for="role in roles" :key="role" color="processing" class="uppercase">
            {{ role }}
          </Tag>
        </div>
      </template>
      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        @finish="handleUpdate"
      >
        <FormItem :label="$t('page.profile.name')" name="name">
          <Input v-model:value="formState.name" :placeholder="$t('page.profile.namePlaceholder')" />
        </FormItem>

        <FormItem :label="$t('page.profile.email')" name="email">
          <Input v-model:value="formState.email" :placeholder="$t('page.profile.emailPlaceholder')" />
        </FormItem>

        <FormItem :label="$t('page.profile.password')" name="password">
          <InputPassword v-model:value="formState.password" :placeholder="$t('page.profile.passwordPlaceholder')" />
        </FormItem>

        <FormItem :label="$t('page.profile.confirmPassword')" name="confirmPassword">
          <InputPassword v-model:value="formState.confirmPassword" :placeholder="$t('page.profile.confirmPasswordPlaceholder')" />
        </FormItem>

        <FormItem class="mb-0 text-right mt-6">
          <Button type="primary" html-type="submit" :loading="submitting" class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] rounded-md font-medium text-white px-6">
            {{ $t('page.profile.btnUpdate') }}
          </Button>
        </FormItem>
      </Form>
    </Card>
  </div>
</template>

<style scoped>
/* Sleek styling matches modern aesthetics */
:deep(.ant-card-head) {
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
}
:deep(.ant-card-head-title) {
  font-weight: 600;
  font-size: 1.125rem;
}
</style>
