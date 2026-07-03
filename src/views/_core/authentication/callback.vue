<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { handleCallback } from '#/api/core/pkce';
import { useAccessStore, useUserStore } from '@vben/stores';
import { useAuthStore } from '#/store/auth';
import { getAccessCodesApi } from '#/api/core/auth';
import { preferences } from '@vben/preferences';
import { notification } from 'ant-design-vue';

defineOptions({ name: 'AuthCallback' });

const route = useRoute();
const router = useRouter();
const accessStore = useAccessStore();
const userStore = useUserStore();
const authStore = useAuthStore();

const statusText = ref('Đang xử lý đăng nhập...');
const errorText = ref<string | null>(null);

onMounted(async () => {
  const code = route.query.code as string;
  if (!code) {
    errorText.value = 'Không tìm thấy tham số code trong URL callback.';
    return;
  }

  try {
    statusText.value = 'Đang xác thực thông tin tài khoản...';
    const token = await handleCallback(code);

    statusText.value = 'Đang chuẩn bị phiên làm việc...';
    accessStore.setAccessToken(token);

    // Lấy thông tin user và phân quyền song song
    const [userInfo, accessCodes] = await Promise.all([
      authStore.fetchUserInfo(),
      getAccessCodesApi(),
    ]);

    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);

    notification.success({
      message: 'Đăng nhập thành công',
      description: `Chào mừng quay trở lại, ${userInfo.realName || userInfo.username}!`,
      duration: 3,
    });

    // Lấy redirect path từ state param (được set bởi redirectToLogin), hoặc mặc định về homepage
    const stateParam = route.query.state as string | undefined;
    const redirectPath = stateParam
      ? decodeURIComponent(stateParam)
      : (userInfo.homePath || preferences.app.defaultHomePath);

    await router.replace(redirectPath);
  } catch (err: any) {
    console.error('[AuthCallback] Error:', err);

    // Hiển thị thông báo lỗi chi tiết để debug
    const status = err.response?.status;
    const responseMsg = err.response?.data?.message || err.response?.data?.error;

    if (status === 401 || status === 400) {
      errorText.value = `Xác thực thất bại: ${responseMsg || 'Mã code không hợp lệ hoặc đã hết hạn.'}`;
    } else if (status === 422) {
      errorText.value = `Dữ liệu không hợp lệ: ${responseMsg || JSON.stringify(err.response?.data?.errors)}`;
    } else {
      errorText.value = responseMsg || err.message || 'Xác thực thất bại. Vui lòng thử lại.';
    }
  }
});
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#070709]">
    <div class="text-center space-y-4 max-w-sm px-6">
      <template v-if="errorText">
        <div class="text-rose-500 font-semibold text-lg">Xảy ra lỗi đăng nhập</div>
        <p class="text-slate-500 text-sm bg-rose-50 dark:bg-rose-950/20 rounded-lg p-3 border border-rose-200 dark:border-rose-900/50">{{ errorText }}</p>
        <router-link
          to="/auth/login"
          class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow hover:bg-blue-700 transition"
        >
          Quay lại Đăng nhập
        </router-link>
      </template>
      <template v-else>
        <div class="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-slate-500 text-sm font-medium">{{ statusText }}</p>
      </template>
    </div>
  </div>
</template>
