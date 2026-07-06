export type Locale = 'en-US' | 'zh-CN';

export const messages: Record<Locale, Record<string, string>> = {
  'en-US': {
    cancel: 'Cancel',
    collapse: 'Collapse',
    confirm: 'Confirm',
    expand: 'Expand',
    prompt: 'Prompt',
    reset: 'Reset',
    submit: 'Submit',
    confirmTitle: 'Please Confirm',
  },
  'zh-CN': {
    cancel: 'Hủy',
    collapse: 'Thu gọn',
    confirm: 'Xác nhận',
    expand: 'Mở rộng',
    prompt: 'Gợi ý',
    reset: 'Đặt lại',
    submit: 'Gửi',
    confirmTitle: 'Vui lòng xác nhận',
  },
};

export const getMessages = (locale: Locale) => messages[locale];
