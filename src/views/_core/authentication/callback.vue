<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Result, Spin, notification } from 'ant-design-vue';
import { handleCallback } from '#/api/core/pkce';
import { useAccessStore, useUserStore } from '@vben/stores';
import { useAuthStore } from '#/store/auth';
import { getAccessCodesApi } from '#/api/core/auth';
import { preferences } from '@vben/preferences';
import { $t } from '#/locales';

defineOptions({ name: 'AuthCallback' });

interface ApiErrorResponse {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      errors?: Record<string, unknown>;
    };
  };
}

const route = useRoute();
const router = useRouter();
const accessStore = useAccessStore();
const userStore = useUserStore();
const authStore = useAuthStore();

const statusText = ref($t('page.auth.callback.processing'));
const errorText = ref<string | null>(null);

onMounted(async () => {
  const code = route.query.code as string;
  if (!code) {
    errorText.value = $t('page.auth.callback.codeParamNotFound');
    return;
  }

  try {
    statusText.value = $t('page.auth.callback.verifying');
    const { accessToken, refreshToken } = await handleCallback(code);

    statusText.value = $t('page.auth.callback.preparing');

    accessStore.setAccessToken(accessToken);
    if (refreshToken) {
      accessStore.setRefreshToken(refreshToken);
    }

    // Lấy thông tin user và phân quyền song song
    const [userInfo, accessCodes] = await Promise.all([
      authStore.fetchUserInfo(),
      getAccessCodesApi(),
    ]);

    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);

    const userName = userInfo.realName || userInfo.username;
    notification.success({
      message: $t('page.auth.callback.loginSuccess'),
      description: $t('page.auth.callback.welcomeBack', { name: userName }),
      duration: 3,
    });

    // Lấy redirect path từ state param (được set bởi redirectToLogin), hoặc mặc định về homepage
    const stateParam = route.query.state as string | undefined;
    const redirectPath = stateParam
      ? decodeURIComponent(stateParam)
      : (userInfo.homePath || preferences.app.defaultHomePath);

    await router.replace(redirectPath);
  } catch (err: unknown) {
    console.error('[AuthCallback] Error:', err);

    const errorObj = err as ApiErrorResponse;
    const status = errorObj.response?.status;
    const responseMsg = errorObj.response?.data?.message || errorObj.response?.data?.error;

    if (status === 401 || status === 400) {
      errorText.value = `${$t('page.auth.callback.authFailed')}: ${responseMsg || $t('page.auth.callback.invalidOrExpiredCode')}`;
    } else if (status === 422) {
      errorText.value = `${$t('page.auth.callback.invalidData')}: ${responseMsg || JSON.stringify(errorObj.response?.data?.errors)}`;
    } else {
      errorText.value = responseMsg || errorObj.message || $t('page.auth.callback.authFailedTryAgain');
    }
  }
});
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#070709]">
    <div class="text-center space-y-4 max-w-md px-6">
      <template v-if="errorText">
        <Result
          status="error"
          :title="$t('page.auth.callback.loginErrorTitle')"
          :sub-title="errorText"
        >
          <template #extra>
            <Button type="primary" @click="router.push('/auth/login')">
              {{ $t('page.auth.callback.backToLogin') }}
            </Button>
          </template>
        </Result>
      </template>
      <template v-else>
        <Spin size="large" :tip="statusText" />
      </template>
    </div>
  </div>
</template>

