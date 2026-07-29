<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Card, Form, FormItem, Input, Button, Tag, message } from 'ant-design-vue';
import { VbenAvatar } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';
import { $t } from '#/locales';
import { updateUserInfoApi, getUserInfoApi } from '#/api';

defineOptions({ name: 'MobileProfile' });

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
const avatarUrl = ref('/avatar.png');

// Load current user info
onMounted(async () => {
  try {
    const data = await getUserInfoApi();
    formState.value.name = data.realName || '';
    formState.value.email = data.username || '';
    roles.value = data.roles || [];
    if (data.avatar) avatarUrl.value = data.avatar;
  } catch (error) {
    console.error('Failed to load user info:', error);
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

    formState.value.password = '';
    formState.value.confirmPassword = '';
  } catch (error: any) {
    console.error('Update failed:', error);
    if (error?.response?.data?.message) {
      message.error(error.response.data.message);
    } else if (!error?.errorFields) {
      message.error($t('page.profile.updateError'));
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mobile-profile-container p-3 sm:p-4 min-h-[85vh] flex flex-col gap-4">
    
    <!-- Profile Banner Card -->
    <Card class="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 shadow-2xs overflow-hidden">
      <div class="flex items-center gap-3.5 p-1">
        <div class="relative flex-shrink-0">
          <VbenAvatar :alt="formState.name || 'User'" :src="avatarUrl" class="size-14" dot dot-class="bottom-0 right-1 border-2 size-4 bg-emerald-500" />
        </div>
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold text-slate-800 dark:text-zinc-100 truncate">
              {{ formState.name || 'User' }}
            </h2>
          </div>
          <p class="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
            {{ formState.email || 'user@example.com' }}
          </p>
          <div v-if="roles.length > 0" class="flex flex-wrap gap-1 mt-1.5">
            <Tag v-for="role in roles" :key="role" color="processing" class="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded-md border-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-300">
              {{ role }}
            </Tag>
          </div>
        </div>
      </div>
    </Card>

    <!-- Profile Form Card -->
    <Card class="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-2xs">
      <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
        <span>{{ $t('page.auth.profile') }}</span>
      </h3>

      <Form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        @finish="handleUpdate"
        class="space-y-1"
      >
        <FormItem :label="$t('page.profile.name')" name="name">
          <Input 
            v-model:value="formState.name" 
            :placeholder="$t('page.profile.namePlaceholder')" 
            class="rounded-xl text-xs py-2"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:user" class="text-slate-400 mr-1 text-sm" />
            </template>
          </Input>
        </FormItem>

        <FormItem :label="$t('page.profile.email')" name="email">
          <Input 
            v-model:value="formState.email" 
            :placeholder="$t('page.profile.emailPlaceholder')" 
            class="rounded-xl text-xs py-2"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:mail" class="text-slate-400 mr-1 text-sm" />
            </template>
          </Input>
        </FormItem>

        <FormItem :label="$t('page.profile.password')" name="password">
          <InputPassword 
            v-model:value="formState.password" 
            :placeholder="$t('page.profile.passwordPlaceholder')" 
            class="rounded-xl text-xs py-2"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:lock" class="text-slate-400 mr-1 text-sm" />
            </template>
          </InputPassword>
        </FormItem>

        <FormItem :label="$t('page.profile.confirmPassword')" name="confirmPassword">
          <InputPassword 
            v-model:value="formState.confirmPassword" 
            :placeholder="$t('page.profile.confirmPasswordPlaceholder')" 
            class="rounded-xl text-xs py-2"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:shield-check" class="text-slate-400 mr-1 text-sm" />
            </template>
          </InputPassword>
        </FormItem>

        <FormItem class="mb-0 pt-2">
          <Button 
            type="primary" 
            html-type="submit" 
            :loading="submitting" 
            class="w-full bg-indigo-600 hover:bg-indigo-700 border-indigo-600 rounded-xl font-semibold text-white h-10 shadow-2xs flex items-center justify-center gap-2"
          >
            <IconifyIcon icon="lucide:check-circle" class="text-base" />
            <span>{{ $t('page.profile.btnUpdate') }}</span>
          </Button>
        </FormItem>
      </Form>
    </Card>

  </div>
</template>

<style scoped>
.mobile-profile-container :deep(.ant-card-body) {
  padding: 14px 16px !important;
}
</style>
