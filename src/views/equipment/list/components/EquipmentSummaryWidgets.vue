<script lang="ts" setup>
import { computed } from 'vue';
import { Statistic, Skeleton } from 'ant-design-vue';
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

const totalAssets = computed(() => Number(props.summary?.total_assets.value) || 0);
const activeCount = computed(() => Number(props.summary?.active_inactive.active) || 0);
const errorsCount = computed(() => Number(props.summary?.with_errors.value) || 0);
const overdueCount = computed(() => Number(props.summary?.maintenance.overdue) || 0);
const upcomingCount = computed(() => Number(props.summary?.maintenance.upcoming) || 0);

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.round((value / total) * 100), 100);
}

const activeRate = computed(() => percentage(activeCount.value, totalAssets.value));
const errorsRate = computed(() => percentage(errorsCount.value, totalAssets.value));
const maintenanceTotal = computed(() => overdueCount.value + upcomingCount.value);
const overdueRate = computed(() => percentage(overdueCount.value, maintenanceTotal.value));

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
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <!-- 1. Active / Inactive -->
    <div
      class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 transition-all duration-300"
    >
      <Skeleton :loading="loading" :paragraph="{ rows: 2 }" active>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {{ titleFor('active_inactive') }}
          </span>
        </div>

        <div>
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
        </div>

        <div class="pt-1 border-t border-border">
          <div class="h-1.5 overflow-hidden rounded-full bg-[#5ab1ef]/15 dark:bg-[#5ab1ef]/25">
            <div class="h-full rounded-full bg-[#5ab1ef] transition-all" :style="{ width: `${activeRate}%` }" />
          </div>
          <div class="text-xs text-muted-foreground mt-1">
            {{ activeRate }}% {{ $t('page.equipment.widgetActiveRate') }}
          </div>
          <div class="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              {{ $t('page.equipment.widgetActive') }}:
              <strong class="text-[#5ab1ef]">
                {{ activeCount }}
              </strong>
            </span>
            <span>
              {{ $t('page.equipment.widgetInactive') }}:
              <strong class="text-zinc-500">
                {{ summary?.active_inactive.inactive ?? 0 }}
              </strong>
            </span>
          </div>
        </div>
      </Skeleton>
    </div>

    <!-- 3. With Errors -->
    <div
      class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 transition-all duration-300"
    >
      <Skeleton :loading="loading" :paragraph="{ rows: 2 }" active>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {{ titleFor('with_errors') }}
          </span>
        </div>

        <div class="flex items-end gap-2">
          <Statistic
            :value="Number(summary?.with_errors.value) || 0"
            :value-style="{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, color: 'inherit' }"
            class="text-foreground dark:text-zinc-50"
          />
          <span class="pb-1.5 text-sm text-muted-foreground">/ {{ totalAssets }}</span>
        </div>

        <div class="pt-1 border-t border-border">
          <div class="h-1.5 overflow-hidden rounded-full bg-[#2ec7c9]/10 dark:bg-[#2ec7c9]/20">
            <div class="h-full rounded-full bg-[#2ec7c9] transition-all" :style="{ width: `${errorsRate}%` }" />
          </div>
          <span class="mt-1 block text-xs text-muted-foreground">
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
      class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 transition-all duration-300"
    >
      <Skeleton :loading="loading" :paragraph="{ rows: 2 }" active>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {{ titleFor('maintenance') }}
          </span>
        </div>

        <div class="flex items-end gap-2">
          <Statistic
            :value="Number(summary?.maintenance.overdue) || 0"
            :value-style="{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, color: 'inherit' }"
            class="text-foreground dark:text-zinc-50"
          />
          <span class="pb-1.5 text-sm text-muted-foreground">/ {{ totalAssets }}</span>
        </div>

        <div class="pt-1 border-t border-border">
          <div class="flex h-1.5 overflow-hidden rounded-full bg-[#67e0e3]/20 dark:bg-[#67e0e3]/30">
            <div class="h-full bg-[#b6a2de] transition-all" :style="{ width: `${overdueRate}%` }" />
            <div class="h-full flex-1 bg-[#67e0e3]" />
          </div>
          <div class="mt-2 flex items-center gap-4">
            <div class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-[#b6a2de] inline-block"></span>
              <span class="text-xs text-muted-foreground">
                {{ $t('page.equipment.widgetOverdue') }}:
                <strong class="text-[#b6a2de]">
                  {{ summary?.maintenance.overdue ?? 0 }}
                </strong>
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-[#67e0e3] inline-block"></span>
              <span class="text-xs text-muted-foreground">
                {{ $t('page.equipment.widgetUpcoming') }}:
                <strong class="text-[#67e0e3]">
                  {{ summary?.maintenance.upcoming ?? 0 }}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </Skeleton>
    </div>
  </div>
</template>
