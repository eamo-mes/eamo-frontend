<script lang="ts" setup>
import { Statistic, Skeleton } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { $t } from '#/locales';

interface SummaryItem {
  active?: number;
  description: string;
  icon: string;
  inactive?: number;
  overdue?: number;
  title: string;
  upcoming?: number;
  value: number | string;
}

interface DashboardSummary {
  active_inactive: SummaryItem;
  maintenance: SummaryItem;
  total_assets: SummaryItem;
  with_errors: SummaryItem;
}

const props = defineProps<{
  loading: boolean;
  summary: DashboardSummary | null;
}>();

function iconFor(name: string): string {
  switch (name) {
    case 'DatabaseOutlined':
      return 'ant-design:database-outlined';
    case 'CheckCircleOutlined':
      return 'ant-design:check-circle-outlined';
    case 'WarningOutlined':
      return 'ant-design:warning-outlined';
    case 'ClockCircleOutlined':
      return 'ant-design:clock-circle-outlined';
    default:
      return 'ant-design:info-circle-outlined';
  }
}

function titleFor(key: string): string {
  switch (key) {
    case 'total_assets':
      return $t('page.equipment.widgetTitleTotalAssets');
    case 'active_inactive':
      return $t('page.equipment.widgetTitleActiveInactive');
    case 'with_errors':
      return $t('page.equipment.widgetTitleWithErrors');
    case 'maintenance':
      return $t('page.equipment.widgetTitleMaintenance');
    default:
      return key;
  }
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- 1. Total Assets -->
    <div
      class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md text-foreground"
    >
      <Skeleton :loading="loading" :paragraph="{ rows: 2 }" active>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {{ titleFor('total_assets') }}
          </span>
          <div class="size-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
            <IconifyIcon
              :icon="iconFor(summary?.total_assets.icon ?? '')"
              class="text-lg text-blue-500"
            />
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <Statistic
            :value="Number(summary?.total_assets.value) || 0"
            :value-style="{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, color: 'inherit' }"
            class="text-foreground dark:text-zinc-50"
          />
          <!-- Mini Sparkline (Blue) -->
          <div class="w-24 h-10 overflow-hidden shrink-0">
            <svg class="w-full h-full" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sparkline-blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <path d="M 0 30 Q 20 15 40 25 T 80 10 T 100 15" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M 0 30 Q 20 15 40 25 T 80 10 T 100 15 L 100 40 L 0 40 Z" fill="url(#sparkline-blue)"/>
            </svg>
          </div>
        </div>

        <div class="flex items-center gap-4 pt-1 border-t border-border">
          <div class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-emerald-500 inline-block"></span>
            <span class="text-xs text-muted-foreground">
              {{ $t('page.equipment.widgetActive') }}:
              <strong class="text-emerald-600 dark:text-emerald-400">
                {{ summary?.active_inactive.active ?? 0 }}
              </strong>
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-zinc-400 inline-block"></span>
            <span class="text-xs text-muted-foreground">
              {{ $t('page.equipment.widgetInactive') }}:
              <strong class="text-zinc-500">
                {{ summary?.active_inactive.inactive ?? 0 }}
              </strong>
            </span>
          </div>
        </div>
      </Skeleton>
    </div>

    <!-- 2. Active / Inactive -->
    <div
      class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md text-foreground"
    >
      <Skeleton :loading="loading" :paragraph="{ rows: 2 }" active>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {{ titleFor('active_inactive') }}
          </span>
          <div class="size-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <IconifyIcon
              :icon="iconFor(summary?.active_inactive.icon ?? '')"
              class="text-lg text-emerald-500"
            />
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <div class="flex items-end gap-2">
            <Statistic
              :value="Number(summary?.active_inactive.active) || 0"
              :value-style="{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, color: 'inherit' }"
              class="text-foreground dark:text-zinc-50"
            />
            <span class="text-sm text-muted-foreground pb-1.5">
              / {{ Number(summary?.total_assets.value) || 0 }}
            </span>
          </div>
          <!-- Mini Sparkline (Green) -->
          <div class="w-24 h-10 overflow-hidden shrink-0">
            <svg class="w-full h-full" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sparkline-green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <path d="M 0 20 Q 25 10 50 25 T 100 15" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M 0 20 Q 25 10 50 25 T 100 15 L 100 40 L 0 40 Z" fill="url(#sparkline-green)"/>
            </svg>
          </div>
        </div>

        <div class="pt-1 border-t border-border">
          <div class="text-xs text-muted-foreground mt-1">
            {{
              Number(summary?.total_assets.value) > 0
                ? Math.round(
                    (Number(summary?.active_inactive.active) /
                      Number(summary?.total_assets.value)) *
                      100,
                  )
                : 0
            }}% {{ $t('page.equipment.widgetActiveRate') }}
          </div>
        </div>
      </Skeleton>
    </div>

    <!-- 3. With Errors -->
    <div
      class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md text-foreground"
    >
      <Skeleton :loading="loading" :paragraph="{ rows: 2 }" active>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {{ titleFor('with_errors') }}
          </span>
          <div
            class="size-9 rounded-lg flex items-center justify-center shrink-0"
            :class="
              Number(summary?.with_errors.value) > 0
                ? 'bg-red-50 dark:bg-red-950/40'
                : 'bg-zinc-50 dark:bg-zinc-900/40'
            "
          >
            <IconifyIcon
              :icon="iconFor(summary?.with_errors.icon ?? '')"
              class="text-lg"
              :class="
                Number(summary?.with_errors.value) > 0
                  ? 'text-red-500'
                  : 'text-zinc-400'
              "
            />
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <Statistic
            :value="Number(summary?.with_errors.value) || 0"
            :value-style="{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, color: 'inherit' }"
            class="text-foreground dark:text-zinc-50"
          />
          <!-- Mini Sparkline (Red) -->
          <div class="w-24 h-10 overflow-hidden shrink-0">
            <svg class="w-full h-full" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sparkline-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#ef4444" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <path d="M 0 35 Q 20 10 40 30 T 80 15 T 100 38" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M 0 35 Q 20 10 40 30 T 80 15 T 100 38 L 100 40 L 0 40 Z" fill="url(#sparkline-red)"/>
            </svg>
          </div>
        </div>

        <div class="pt-1 border-t border-border">
          <span class="text-xs text-muted-foreground">
            {{
              Number(summary?.with_errors.value) > 0
                ? $t('page.equipment.widgetHasErrors')
                : $t('page.equipment.widgetNoErrors')
            }}
          </span>
        </div>
      </Skeleton>
    </div>

    <!-- 4. Maintenance -->
    <div
      class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md text-foreground"
    >
      <Skeleton :loading="loading" :paragraph="{ rows: 2 }" active>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {{ titleFor('maintenance') }}
          </span>
          <div
            class="size-9 rounded-lg flex items-center justify-center shrink-0"
            :class="
              Number(summary?.maintenance.overdue) > 0
                ? 'bg-amber-50 dark:bg-amber-950/40'
                : 'bg-zinc-50 dark:bg-zinc-900/40'
            "
          >
            <IconifyIcon
              :icon="iconFor(summary?.maintenance.icon ?? '')"
              class="text-lg"
              :class="
                Number(summary?.maintenance.overdue) > 0
                  ? 'text-amber-500'
                  : 'text-zinc-400'
              "
            />
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <Statistic
            :value="Number(summary?.maintenance.overdue) || 0"
            :value-style="{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, color: 'inherit' }"
            class="text-foreground dark:text-zinc-50"
          />
          <!-- Mini Sparkline (Yellow) -->
          <div class="w-24 h-10 overflow-hidden shrink-0">
            <svg class="w-full h-full" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sparkline-yellow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <path d="M 0 10 Q 25 15 50 30 T 100 35" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M 0 10 Q 25 15 50 30 T 100 35 L 100 40 L 0 40 Z" fill="url(#sparkline-yellow)"/>
            </svg>
          </div>
        </div>

        <div class="flex items-center gap-4 pt-1 border-t border-border">
          <div class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-amber-500 inline-block"></span>
            <span class="text-xs text-muted-foreground">
              {{ $t('page.equipment.widgetOverdue') }}:
              <strong class="text-amber-600 dark:text-amber-400">
                {{ summary?.maintenance.overdue ?? 0 }}
              </strong>
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-sky-400 inline-block"></span>
            <span class="text-xs text-muted-foreground">
              {{ $t('page.equipment.widgetUpcoming') }}:
              <strong class="text-sky-500">
                {{ summary?.maintenance.upcoming ?? 0 }}
              </strong>
            </span>
          </div>
        </div>
      </Skeleton>
    </div>
  </div>
</template>
