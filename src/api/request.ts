/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. Redirecting to logout.');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    accessStore.setRefreshToken(null);
    await authStore.logout();
  }

  /**
   * 刷新token逻辑 (PKCE OAuth 2.0 refresh_token)
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const refreshToken = accessStore.refreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const { refreshAccessToken } = await import('./core/pkce');
    const result = await refreshAccessToken(refreshToken);
    const newToken = result.accessToken;
    accessStore.setAccessToken(newToken);
    if (result.refreshToken) {
      accessStore.setRefreshToken(result.refreshToken);
    }
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // 处理返回的响应数据格式
  // Backend returns { status: 'success', data: ... } — no "code" field.
  // We use responseReturn: 'body' to pass the full response body through.
  client.addResponseInterceptor({
    fulfilled: (response) => {
      const { config, data, status } = response;
      if (config.responseReturn === 'raw') {
        return response;
      }
      if (status >= 200 && status < 400) {
        // If caller requested raw body, return as-is
        if (config.responseReturn === 'body') {
          return data;
        }
        // Backend wraps results in { status, data } — unwrap data if present, else return full body
        if (data && typeof data === 'object' && 'data' in data) {
          return data.data;
        }
        return data;
      }
      throw Object.assign({}, response, { response });
    },
  });

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: true,
      formatToken,
    }),
  );

  // Interceptor to translate error code strings in error.response.data BEFORE handlers run
  client.addResponseInterceptor({
    rejected: (error) => {
      if (error?.response?.data) {
        const responseData = error.response.data;
        let rawMessage = responseData.error ?? responseData.message ?? '';

        if (!rawMessage && responseData.errors && typeof responseData.errors === 'object') {
          const firstKey = Object.keys(responseData.errors)[0];
          if (firstKey && Array.isArray(responseData.errors[firstKey])) {
            rawMessage = responseData.errors[firstKey][0] ?? '';
          }
        }

        if (typeof rawMessage === 'string' && rawMessage.trim()) {
          const candidateKeys = [
            `page.error.${rawMessage}`,
            `error.${rawMessage}`,
            `page.${rawMessage}`,
            rawMessage,
          ];
          for (const k of candidateKeys) {
            const translated = $t(k);
            if (translated && translated !== k) {
              responseData.message = translated;
              responseData.error = translated;
              break;
            }
          }
        }
      }
      return Promise.reject(error);
    },
  });

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // Ignore 401 error toasts as authenticateResponseInterceptor handles 401 refresh / re-login
      if (error?.response?.status === 401) {
        return;
      }
      const responseData = error?.response?.data ?? {};
      const rawMessage = responseData?.error ?? responseData?.message ?? '';

      message.error(rawMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
