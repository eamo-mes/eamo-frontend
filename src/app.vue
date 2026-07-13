<script lang="ts" setup>
import { computed } from 'vue';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';

import { App, ConfigProvider, theme } from 'ant-design-vue';

import { antdLocale } from '#/locales';

defineOptions({ name: 'App' });

const { isDark } = usePreferences();
const { tokens } = useAntdDesignTokens();

const tokenTheme = computed(() => {
  const algorithm = isDark.value
    ? [theme.darkAlgorithm]
    : [theme.defaultAlgorithm];

  // antd 紧凑模式算法
  if (preferences.app.compact) {
    algorithm.push(theme.compactAlgorithm);
  }

  return {
    algorithm,
    token: tokens,
  };
});
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <App>
      <RouterView />
    </App>
  </ConfigProvider>
</template>

<style>
/* Fix background transparency for all fixed/pinned cells in Ant Design Vue tables globally */
.ant-table-cell-fix-left,
.ant-table-cell-fix-right {
  background-color: hsl(var(--card)) !important;
}

/* Retain standard table header background for fixed cells */
.ant-table-thead th.ant-table-cell-fix-left,
.ant-table-thead th.ant-table-cell-fix-right {
  background-color: #fafafa !important;
}
.dark .ant-table-thead th.ant-table-cell-fix-left,
.dark .ant-table-thead th.ant-table-cell-fix-right {
  background-color: #1f2937 !important;
}

/* Retain standard hover background for fixed cells */
.ant-table-row:hover > td.ant-table-cell-fix-left,
.ant-table-row:hover > td.ant-table-cell-fix-right,
.ant-table-row-hover > td.ant-table-cell-fix-left,
.ant-table-row-hover > td.ant-table-cell-fix-right,
.ant-table-cell-row-hover {
  background-color: hsl(var(--accent)) !important;
}
</style>
