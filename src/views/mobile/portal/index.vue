<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Card, Row, Col, message } from 'ant-design-vue';
import { useI18n, loadLocaleMessages } from '@vben/locales';
import { updatePreferences } from '@vben/preferences';

const router = useRouter();
const { locale, t } = useI18n();
const currentTime = ref('');
let timerId: any = null;

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString(locale.value === 'zh-CN' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function changeLang(lang: 'zh-CN' | 'en-US') {
  if (locale.value === lang) return;
  const hide = message.loading({ content: lang === 'zh-CN' ? 'Đang chuyển ngôn ngữ...' : 'Switching language...', key: 'lang', duration: 0 });
  try {
    updatePreferences({
      app: {
        locale: lang,
      },
    });
    await loadLocaleMessages(lang);
    updateTime();
  } catch (error) {
    console.error('Failed to change language:', error);
  } finally {
    hide();
  }
}

onMounted(() => {
  updateTime();
  timerId = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (timerId) clearInterval(timerId);
});

const menuItems = computed(() => [
  {
    title: t('page.portal.equipment'),
    subtitle: t('page.portal.equipmentSub'),
    path: '/portal/equipment',
    iconClass: 'bg-amber-50/80 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    hoverClass: 'hover:border-amber-400/80 dark:hover:border-amber-500/40 hover:shadow-[0_12px_30px_rgba(245,158,11,0.08)]',
    activeGlow: 'bg-amber-500',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
  },
  {
    title: t('page.portal.notifications') || 'Thông báo',
    subtitle: t('page.portal.notificationsSub') || 'Thông tin & cảnh báo',
    path: '/portal/dashboard',
    iconClass: 'bg-purple-50/80 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    hoverClass: 'hover:border-purple-400/80 dark:hover:border-purple-500/40 hover:shadow-[0_12px_30px_rgba(168,85,247,0.08)]',
    activeGlow: 'bg-purple-500',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`
  },
  {
    title: t('page.portal.checklist'),
    subtitle: t('page.portal.checklistSub'),
    path: '/portal/checklist',
    iconClass: 'bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    hoverClass: 'hover:border-blue-400/80 dark:hover:border-blue-500/40 hover:shadow-[0_12px_30px_rgba(59,130,246,0.08)]',
    activeGlow: 'bg-blue-500',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-check"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>`
  },
  {
    title: t('page.portal.mPlans'),
    subtitle: t('page.portal.mPlansSub'),
    path: '/portal/maintain-plan',
    iconClass: 'bg-emerald-50/80 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    hoverClass: 'hover:border-emerald-400/80 dark:hover:border-emerald-500/40 hover:shadow-[0_12px_30px_rgba(16,185,129,0.08)]',
    activeGlow: 'bg-emerald-500',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-clock"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M12 14v4h4"/><circle cx="18" cy="18" r="4"/></svg>`
  }
]);

function handleNavigate(path: string) {
  message.loading({ content: t('page.portal.loading'), key: 'nav', duration: 0.5 });
  setTimeout(() => {
    router.push(path);
  }, 300);
}
</script>

<template>
  <div class="portal-container min-h-[85vh] bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/20 flex flex-col justify-center transition-colors duration-300 relative overflow-hidden">
    
    <!-- Language Switcher Pill (Floating Top-Right) -->
    <div class="absolute top-4 right-4 z-20 flex items-center gap-1 p-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-full border border-slate-100/85 dark:border-zinc-800/85 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <button 
        @click="changeLang('zh-CN')" 
        :class="[locale === 'zh-CN' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 font-semibold']"
        class="px-3 py-1 rounded-full text-[10px] tracking-wide transition-all duration-200 cursor-pointer border-0 outline-none"
      >
        VI
      </button>
      <button 
        @click="changeLang('en-US')" 
        :class="[locale === 'en-US' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 font-semibold']"
        class="px-3 py-1 rounded-full text-[10px] tracking-wide transition-all duration-200 cursor-pointer border-0 outline-none"
      >
        EN
      </button>
    </div>

    <!-- Premium background glowing spots (ambient mesh) -->
    <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-200/10 dark:bg-emerald-950/5 rounded-full blur-[120px] pointer-events-none"></div>

    <div class="max-w-4xl mx-auto w-full flex flex-col gap-6 sm:gap-8 relative z-10">
    
      <!-- 4 Grid Buttons Portal Section (Using Ant Design Row/Col Grid) -->
      <div class="w-full">
        <Row :gutter="[16, 16]">
          <Col v-for="item in menuItems" :key="item.title" :span="12">
            <Card 
              hoverable 
              @click="handleNavigate(item.path)"
              :class="[item.hoverClass]"
              class="portal-card h-full group relative overflow-hidden bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-slate-100/80 dark:border-zinc-800/70 rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
            >
              <!-- Colored Accent Border Line (Slide-in transition) -->
              <div :class="[item.activeGlow]" class="absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-r-md"></div>

              <!-- Top Row: Icon & Mini indicator -->
              <div class="flex items-center justify-between mb-3 sm:mb-4.5">
                <div 
                  :class="[item.iconClass]" 
                  class="portal-icon-wrapper rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-3xs"
                  v-html="item.iconSvg"
                ></div>
              </div>

              <!-- Content details -->
              <h3 class="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                {{ item.title }}
              </h3>
              <span class="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-zinc-500">
                {{ item.subtitle }}
              </span>

              <!-- Premium Hover glow effect background -->
              <div class="absolute -right-12 -bottom-12 w-24 h-24 rounded-full bg-slate-400/5 dark:bg-zinc-400/5 group-hover:scale-150 transition-transform duration-500 ease-out pointer-events-none"></div>
            </Card>
          </Col>
        </Row>
      </div>

    </div>
  </div>
</template>

<style scoped>
.portal-container {
  padding: 16px;
}

@media (min-width: 640px) {
  .portal-container {
    padding: 32px 24px;
  }
}

.eamo-logo {
  height: 64px;
  width: auto;
  object-fit: contain;
}

@media (min-width: 640px) {
  .eamo-logo {
    height: 108px;
  }
}

/* Custom styling to ensure Ant Design card has correct cursor and layout */
.portal-card {
  cursor: pointer;
  border-radius: 16px !important;
}

.portal-card :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  padding: 14px !important;
}

@media (min-width: 640px) {
  .portal-card :deep(.ant-card-body) {
    padding: 22px !important;
  }
}

.portal-icon-wrapper {
  padding: 9px;
}

@media (min-width: 640px) {
  .portal-icon-wrapper {
    padding: 12px;
  }
}

.portal-icon-wrapper :deep(svg) {
  width: 22px;
  height: 22px;
}

@media (min-width: 640px) {
  .portal-icon-wrapper :deep(svg) {
    width: 28px;
    height: 28px;
  }
}
</style>
