<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { Button, message } from 'ant-design-vue';
import { useI18n } from '@vben/locales';

defineOptions({ name: 'MobilePortalEmergencyStop' });
const router = useRouter();
const { t } = useI18n();

function handleBack() {
  router.push('/portal');
}

function handleEmergencyTrigger() {
  message.error(t('page.portal.systemAlertEmergency'));
}
</script>

<template>
  <div class="p-4 min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-20 flex flex-col">
    <!-- Header -->
    <div class="mb-5 flex items-center gap-2">
      <Button
        type="default"
        size="small"
        class="flex items-center justify-center p-1.5 rounded-lg shrink-0"
        @click="handleBack"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
      </Button>
      <h1 class="text-base font-bold text-slate-800 dark:text-zinc-200 m-0">
        {{ t('page.portal.emergencyStopTitle') }}
      </h1>
    </div>

    <!-- Centered Circular Button Area -->
    <div class="flex-1 flex flex-col items-center justify-center py-10">
      <div class="text-center mb-6">
        <p class="text-xs text-red-500 font-bold uppercase tracking-widest">{{ t('page.portal.emergencySystem') }}</p>
        <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 max-w-[240px]">{{ t('page.portal.emergencyInstruction') }}</p>
      </div>

      <!-- Large Circular Button -->
      <button
        type="button"
        @click="handleEmergencyTrigger"
        class="emergency-btn w-40 h-40 rounded-full bg-red-600 active:scale-95 text-white font-extrabold uppercase text-sm tracking-wider flex items-center justify-center flex-col gap-1 shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] transition-all duration-300 border-[10px] border-amber-500/80 cursor-pointer outline-none relative"
      >
        <!-- Warning Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-octagon-alert mb-1 animate-pulse"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        <span>{{ t('page.portal.emergencyBtnLabel') }}</span>
        <span>{{ t('page.portal.emergencyBtnSub') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.emergency-btn::before {
  content: '';
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  border: 2px dashed rgba(239, 68, 68, 0.4);
  animation: rotate-dashed 20s linear infinite;
}

@keyframes rotate-dashed {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
