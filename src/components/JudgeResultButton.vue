<script setup lang="ts">
import { ref, computed } from 'vue';
import { Button } from 'ant-design-vue';
import { useI18n } from '@vben/locales';

const props = withDefaults(
  defineProps<{
    value: string;
    passValue?: string;
    failValue?: string;
    passLabel?: string;
    failLabel?: string;
    disabled?: boolean;
    size?: 'large' | 'middle' | 'small';
    onJudge?: (nextValue: string) => Promise<void>;
  }>(),
  {
    passValue: 'pass',
    failValue: 'fail',
    disabled: false,
    size: 'small',
  },
);

const emit = defineEmits<{
  (e: 'update:value', val: string): void;
  (e: 'change', val: string): void;
}>();

const { t } = useI18n();
const loading = ref(false);

const isPass = computed(() => {
  const v = (props.value || '').toLowerCase();
  return v === 'pass' || v === 'completed';
});

const displayPassLabel = computed(() => {
  if (props.passLabel) return props.passLabel;
  return t('page.ops.resultPass') || 'Đạt';
});

const displayFailLabel = computed(() => {
  if (props.failLabel) return props.failLabel;
  return t('page.ops.resultFail') || 'Chưa đạt';
});

async function handleClick() {
  if (props.disabled || loading.value) return;

  const nextVal = isPass.value ? props.failValue : props.passValue;

  if (props.onJudge) {
    loading.value = true;
    try {
      await props.onJudge(nextVal);
      emit('update:value', nextVal);
      emit('change', nextVal);
    } catch (err) {
      console.error('Judge execution failed:', err);
    } finally {
      loading.value = false;
    }
  } else {
    emit('update:value', nextVal);
    emit('change', nextVal);
  }
}
</script>

<template>
  <Button
    type="default"
    :size="size"
    :loading="loading"
    :disabled="disabled"
    :class="[
      'flex items-center gap-1 font-bold transition-all rounded-lg shrink-0 border text-xs cursor-pointer',
      isPass
        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600'
        : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-600',
    ]"
    :title="isPass ? displayPassLabel : displayFailLabel"
    @click="handleClick"
  >
    <template #icon>
      <svg
        v-if="!loading && isPass"
        class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <svg
        v-else-if="!loading && !isPass"
        class="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </template>
    <span class="uppercase tracking-wider">
      {{ isPass ? displayPassLabel : displayFailLabel }}
    </span>
  </Button>
</template>
