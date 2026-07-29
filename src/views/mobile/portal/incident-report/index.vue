<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { Button, Card, Empty } from 'ant-design-vue';

defineOptions({ name: 'MobilePortalIncidentReport' });
const router = useRouter();

function handleBack() {
  router.push('/portal');
}
</script>

<template>
  <div class="p-4 min-h-[85vh] bg-slate-50 dark:bg-zinc-950/40 pb-20">
    <!-- Header -->
    <div class="mb-5 flex items-center gap-2">
      <Button
        type="default"
        size="small"
        class="flex items-center justify-center p-1.5 rounded-lg"
        @click="handleBack"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
      </Button>
      <h1 class="text-base font-bold text-slate-800 dark:text-zinc-200 m-0">
        Báo cáo sự cố
      </h1>
    </div>

    <!-- Empty/Mockup Body -->
    <Card class="rounded-2xl border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-md p-6 text-center shadow-3xs">
      <Empty description="Giao diện báo cáo sự cố (Đang phát triển)" />
    </Card>
  </div>
</template>
