<script lang="ts" setup>
import { $t } from '#/locales';
import { Card } from 'ant-design-vue';
</script>

<template>
  <div class="p-6">
    <Card :title="$t('page.ops.errorMonitoring')">
      <div class="text-gray-400 text-center py-8">
        Nội dung trống / Empty content
      </div>
    </Card>
  </div>
</template>
