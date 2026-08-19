import axios from 'axios';
import { $t } from '#/locales';

/**
 * Configure global Axios interceptors to automatically translate API error messages
 * across the entire application (including 403 Forbidden, 401 Unauthorized, 422 Validation, etc.).
 */
export function setupGlobalAxios(): void {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.data) {
        const responseData = error.response.data;
        let rawMessage = responseData.error ?? responseData.message ?? '';

        // Handle validation error objects (e.g. 422 from Laravel)
        if (!rawMessage && responseData.errors && typeof responseData.errors === 'object') {
          const firstKey = Object.keys(responseData.errors)[0];
          if (firstKey && Array.isArray(responseData.errors[firstKey])) {
            rawMessage = responseData.errors[firstKey][0] ?? '';
          }
        }

        // Try to find a localized translation in i18n
        if (typeof rawMessage === 'string' && rawMessage.trim()) {
          const candidateKeys = [
            `page.error.${rawMessage}`,
            `error.${rawMessage}`,
            `page.${rawMessage}`,
            rawMessage,
          ];
          for (const key of candidateKeys) {
            const translated = $t(key);
            if (translated && translated !== key) {
              responseData.message = translated;
              responseData.error = translated;
              error.message = translated;
              break;
            }
          }
        }

        // Fallback for HTTP 403 Forbidden if not translated
        if (error.response?.status === 403) {
          const isStillRaw = !responseData.message || responseData.message === rawMessage;
          if (isStillRaw) {
            const defaultForbidden = $t('page.error.forbidden');
            const fallbackText =
              defaultForbidden && defaultForbidden !== 'page.error.forbidden'
                ? defaultForbidden
                : 'Truy cập bị từ chối. Bạn không có quyền thực hiện hành động này.';
            responseData.message = fallbackText;
            responseData.error = fallbackText;
            error.message = fallbackText;
          }
        }
      }
      return Promise.reject(error);
    },
  );
}
