<script lang="ts" setup generic="T">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { $t } from '#/locales';

interface Props {
  items?: T[] | null;
  limit?: number;
  collapsedHeight?: number;
  collapseText?: string;
  expandText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  limit: 2,
  collapsedHeight: 32,
  collapseText: '',
  expandText: '',
});

const isExpanded = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const shouldShowButton = ref(false);

const collapseLabel = computed(() => props.collapseText || $t('page.equipment.btnCollapse'));
const expandLabel = computed(() => props.expandText || $t('page.equipment.btnShowMore'));

function checkOverflow() {
  if (containerRef.value) {
    if (isExpanded.value) {
      shouldShowButton.value = true;
      return;
    }
    const hasScroll = containerRef.value.scrollHeight > props.collapsedHeight + 4;
    shouldShowButton.value = hasScroll;
  }
}

onMounted(() => {
  nextTick(() => {
    checkOverflow();
  });
});

watch(
  () => props.items,
  () => {
    nextTick(() => {
      checkOverflow();
    });
  },
  { deep: true },
);
</script>

<template>
  <div v-if="items && items.length > 0">
    <div
      ref="containerRef"
      class="flex flex-wrap gap-1 transition-all duration-300 ease-in-out overflow-hidden"
      :style="{ maxHeight: isExpanded ? '2000px' : `${collapsedHeight}px` }"
    >
      <slot></slot>
    </div>
    <div v-if="shouldShowButton">
      <span
        class="text-xs text-blue-500 hover:text-blue-700 cursor-pointer font-semibold inline-block mt-0.5 select-none"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? collapseLabel : expandLabel }}
      </span>
    </div>
  </div>
  <span v-else class="text-gray-400">—</span>
</template>
