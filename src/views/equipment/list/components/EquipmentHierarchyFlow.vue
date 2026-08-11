<script lang="ts" setup>
import { ref, computed, watch, onMounted, nextTick, defineAsyncComponent } from 'vue';
import { VueFlow, useVueFlow, Position, MarkerType } from '@vue-flow/core';
import type { Node, Edge, Connection } from '@vue-flow/core';
import { Controls } from '@vue-flow/controls';
import { Background } from '@vue-flow/background';
import dagre from 'dagre';
import axios from 'axios';
import { Spin, Button, Input, Tooltip, message, Empty, Collapse, CollapsePanel } from 'ant-design-vue';
import { createIconifyIcon } from '@vben/icons';
import { useAccessStore } from '@vben/stores';
import { usePreferences } from '@vben/preferences';
import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import EquipmentFlowNode from './EquipmentFlowNode.vue';
import type { EquipmentNodeData } from './EquipmentFlowNode.vue';

const EquipmentUnifiedModal = defineAsyncComponent(
  () => import('./EquipmentUnifiedModal.vue')
);

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

const RefreshOutlined = createIconifyIcon('ant-design:reload-outlined');
const SearchOutlined = createIconifyIcon('ant-design:search-outlined');
const UnorderedListOutlined = createIconifyIcon('ant-design:unordered-list-outlined');
const HolderOutlined = createIconifyIcon('ant-design:holder-outlined');

export interface RawEquipment {
  id: string;
  code: string;
  name: string | null;
  parent_id?: string | null;
  is_active?: boolean;
  equipment_category_id?: string | null;
  equipment_category?: { id: string; name: string } | null;
}

const props = withDefaults(
  defineProps<{
    currentEquipmentId?: string | null;
    height?: string;
    readOnly?: boolean;
  }>(),
  {
    currentEquipmentId: null,
    height: '600px',
    readOnly: false,
  }
);

const emit = defineEmits<{
  (e: 'parent-updated'): void;
}>();

const loading = ref(false);
const rawEquipments = ref<RawEquipment[]>([]);
const searchKeyword = ref('');
const sidebarOpen = ref(true);
const canvasEquipmentIds = ref<Set<string>>(new Set());
const nodes = ref<Node<EquipmentNodeData>[]>([]);
const edges = ref<Edge[]>([]);

const NODE_HEIGHT = 58;

interface CustomFitViewOptions {
  padding?: number;
  duration?: number;
  maxZoom?: number;
  nodes?: string[];
}

const vueFlowInstance = useVueFlow();
const fitView = vueFlowInstance.fitView as (options?: CustomFitViewOptions) => Promise<boolean>;

const { isDark } = usePreferences();
const patternColor = computed(() => (isDark.value ? '#475569' : '#cbd5e1'));
const edgeStrokeColor = computed(() => (isDark.value ? '#4b5563' : '#d9d9d9'));
const markerColor = computed(() => (isDark.value ? '#6b7280' : '#bfbfbf'));

watch(isDark, () => {
  buildCanvasGraph();
});

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

const sidebarItems = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  return rawEquipments.value.filter((e) => {
    if (canvasEquipmentIds.value.has(e.id)) return false;
    if (!kw) return true;
    return (
      e.code.toLowerCase().includes(kw) ||
      (e.name && e.name.toLowerCase().includes(kw))
    );
  });
});

interface CategoryGroup {
  id: string;
  name: string;
  items: RawEquipment[];
}

const activeCategoryKeys = ref<string[]>([]);

const sidebarCategoryGroups = computed<CategoryGroup[]>(() => {
  const items = sidebarItems.value;
  const groupsMap = new Map<string, CategoryGroup>();

  items.forEach((e) => {
    const catId = e.equipment_category?.id || 'uncategorized';
    const catName = e.equipment_category?.name || $t('page.equipment.uncategorized');

    if (!groupsMap.has(catId)) {
      groupsMap.set(catId, {
        id: catId,
        name: catName,
        items: [],
      });
    }
    groupsMap.get(catId)!.items.push(e);
  });

  return Array.from(groupsMap.values());
});

watch(
  sidebarCategoryGroups,
  (groups) => {
    activeCategoryKeys.value = groups.map((g) => g.id);
  },
  { immediate: true, deep: true }
);

const calculatedNodeWidth = ref(160);

function layoutGraph(nodesList: Node<EquipmentNodeData>[], edgesList: Edge[], nodeWidth: number) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 96 });

  nodesList.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: NODE_HEIGHT }));
  edgesList.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodesList.map((n) => {
    const pos = g.node(n.id);
    if (pos) {
      n.targetPosition = Position.Top;
      n.sourcePosition = Position.Bottom;
      n.position = { x: pos.x - nodeWidth / 2, y: pos.y - NODE_HEIGHT / 2 };
    }
    return n;
  });
}

function buildCanvasGraph() {
  const canvasIds = canvasEquipmentIds.value;
  if (canvasIds.size === 0) {
    nodes.value = [];
    edges.value = [];
    return;
  }

  // Calculate uniform width based on the longest text on canvas
  let maxLen = 0;
  rawEquipments.value.forEach((item) => {
    if (!canvasIds.has(item.id)) return;
    const codeLen = item.code?.length ?? 0;
    const nameLen = item.name?.length ?? 0;
    maxLen = Math.max(maxLen, codeLen, nameLen);
  });
  const nodeWidth = Math.max(160, Math.min(320, maxLen * 8 + 48));
  calculatedNodeWidth.value = nodeWidth;

  const newNodes: Node<EquipmentNodeData>[] = [];
  const newEdges: Edge[] = [];

  rawEquipments.value.forEach((item) => {
    if (!canvasIds.has(item.id)) return;

    newNodes.push({
      id: item.id,
      type: 'equipment',
      position: { x: 0, y: 0 },
      draggable: !props.readOnly,
      data: {
        id: item.id,
        code: item.code,
        name: item.name,
        category_name: item.equipment_category?.name,
        is_active: item.is_active,
        parent_id: item.parent_id,
        isCurrent: item.id === props.currentEquipmentId,
        readOnly: props.readOnly,
        onRemoveParent: handleRemoveParent,
        onSelectEquipment: handleSelectEquipment,
        onRemoveFromCanvas: removeFromCanvas,
      },
    });

    if (item.parent_id && canvasIds.has(item.parent_id)) {
      newEdges.push({
        id: `e-${item.parent_id}-${item.id}`,
        source: item.parent_id,
        target: item.id,
        sourceHandle: 'child-source',
        targetHandle: 'parent-target',
        type: 'smoothstep',
        animated: false,
        style: { stroke: edgeStrokeColor.value, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: markerColor.value, width: 12, height: 12 },
      });
    }
  });

  const layouted = layoutGraph(newNodes, newEdges, nodeWidth);
  nodes.value = layouted;
  edges.value = newEdges;

  nextTick(() => fitView({ padding: 0.2, duration: 350 }));
}

function getFamilyIds(equipmentId: string): Set<string> {
  const result = new Set<string>();
  const itemMap = new Map<string, RawEquipment>();
  rawEquipments.value.forEach((e) => itemMap.set(e.id, e));

  // 1. Trace UP to find the top-most root ancestor
  let rootId = equipmentId;
  const visitedAncestors = new Set<string>();
  while (rootId && itemMap.has(rootId) && !visitedAncestors.has(rootId)) {
    visitedAncestors.add(rootId);
    const parentId = itemMap.get(rootId)?.parent_id;
    if (parentId && itemMap.has(parentId)) {
      rootId = parentId;
    } else {
      break;
    }
  }

  // 2. Build children map for fast downward traversal
  const childrenMap = new Map<string, string[]>();
  rawEquipments.value.forEach((e) => {
    if (e.parent_id) {
      const arr = childrenMap.get(e.parent_id) ?? [];
      arr.push(e.id);
      childrenMap.set(e.parent_id, arr);
    }
  });

  // 3. Trace DOWN from the top-most root ancestor to collect all descendants from top to bottom
  const queue = [rootId];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (result.has(currId)) continue;
    result.add(currId);

    const children = childrenMap.get(currId) ?? [];
    children.forEach((childId) => {
      if (!result.has(childId)) {
        queue.push(childId);
      }
    });
  }

  return result;
}

let draggedId: string | null = null;

function onSidebarDragStart(event: DragEvent, equipmentId: string) {
  draggedId = equipmentId;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/equipment-id', equipmentId);
  }
}

function onCanvasDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function onCanvasDrop(event: DragEvent) {
  event.preventDefault();
  const eid = event.dataTransfer?.getData('application/equipment-id') ?? draggedId;
  if (!eid) return;
  getFamilyIds(eid).forEach((id) => canvasEquipmentIds.value.add(id));
  draggedId = null;
  buildCanvasGraph();
}

function removeFromCanvas(equipmentId: string) {
  canvasEquipmentIds.value.delete(equipmentId);
  buildCanvasGraph();
}

async function onConnect(connection: Connection) {
  const parentId = connection.source;
  const childId = connection.target;
  if (!parentId || !childId || parentId === childId) {
    message.warning($t('page.equipment.msgCannotSetSelfParent'));
    return;
  }
  try {
    loading.value = true;
    await axios.patch(
      `${API_BASE_URL}/v1/equipment/${childId}/parent`,
      { parent_id: parentId },
      { headers: getAuthHeaders() }
    );
    message.success($t('page.equipment.msgUpdateParentSuccess'));
    const item = rawEquipments.value.find((e) => e.id === childId);
    if (item) item.parent_id = parentId;
    buildCanvasGraph();
    emit('parent-updated');
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    message.error(error?.response?.data?.message ?? $t('page.equipment.msgUpdateParentError'));
  } finally {
    loading.value = false;
  }
}

async function handleRemoveParent(equipmentId: string) {
  try {
    loading.value = true;
    await axios.patch(
      `${API_BASE_URL}/v1/equipment/${equipmentId}/parent`,
      { parent_id: null },
      { headers: getAuthHeaders() }
    );
    message.success($t('page.equipment.msgRemoveParentSuccess'));
    const item = rawEquipments.value.find((e) => e.id === equipmentId);
    if (item) item.parent_id = null;
    buildCanvasGraph();
    emit('parent-updated');
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    message.error(error?.response?.data?.message ?? $t('page.equipment.msgRemoveParentError'));
  } finally {
    loading.value = false;
  }
}

const selectedModalEquipmentId = ref<string | null>(null);
const unifiedModalOpen = ref(false);

function handleSelectEquipment(equipmentId: string) {
  selectedModalEquipmentId.value = equipmentId;
  unifiedModalOpen.value = true;
}

async function fetchEquipmentData() {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment`, {
      headers: getAuthHeaders(),
      params: { per_page: 1000 },
    });
    const raw = res.data?.data ?? res.data ?? [];
    rawEquipments.value = Array.isArray(raw) ? raw : [];

    if (props.currentEquipmentId) {
      getFamilyIds(props.currentEquipmentId).forEach((id) =>
        canvasEquipmentIds.value.add(id)
      );
    }
    buildCanvasGraph();
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    message.error(error?.response?.data?.message ?? $t('page.equipment.msgLoadListError'));
  } finally {
    loading.value = false;
  }
}

function resetLayout() {
  buildCanvasGraph();
}

watch(() => props.currentEquipmentId, () => {
  canvasEquipmentIds.value.clear();
  fetchEquipmentData();
});

onMounted(() => {
  fetchEquipmentData();
});
</script>

<template>
  <div class="eqflow-root" :style="{ height, '--node-width': `${calculatedNodeWidth}px` }">
    <div class="eqflow-layout">

      <!-- ── Sidebar (Hidden in readOnly mode) ── -->
      <transition name="sb-slide">
        <div v-if="sidebarOpen && !readOnly" class="eqflow-sidebar">
        
          <!-- Search -->
          <div class="p-2">
            <Input
              v-model:value="searchKeyword"
              :placeholder="$t('page.equipment.placeholderSearchHierarchy')"
              allow-clear
            >
              <template #prefix>
                <SearchOutlined class="text-gray-400 size-4" />
              </template>
            </Input>
          </div>

          <!-- List -->
          <div class="sb-list">
            <div v-if="sidebarItems.length === 0" class="py-10 flex justify-center">
              <Empty :description="$t('page.equipment.sidebarAllPlaced')" />
            </div>

            <Collapse
              v-else
              v-model:activeKey="activeCategoryKeys"
              :bordered="false"
              class="sb-collapse"
            >
              <CollapsePanel
                v-for="group in sidebarCategoryGroups"
                :key="group.id"
                class="sb-collapse-panel"
              >
                <template #header>
                  <div class="flex items-center justify-between w-full pr-1">
                    <span class="font-semibold text-xs text-slate-700 dark:text-slate-200 truncate">
                      {{ group.name }}
                    </span>
                    <span class="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                      {{ group.items.length }}
                    </span>
                  </div>
                </template>

                <div class="sb-category-items">
                  <div
                    v-for="item in group.items"
                    :key="item.id"
                    class="sb-item"
                    :class="{ 'sb-item--current': item.id === currentEquipmentId }"
                    draggable="true"
                    @dragstart="onSidebarDragStart($event, item.id)"
                  >
                    <HolderOutlined class="size-4 text-slate-400 shrink-0" />
                    <div class="min-w-0 flex-1">
                      <div class="sb-item-code truncate">{{ item.code }}</div>
                      <div class="sb-item-name truncate">{{ item.name || '—' }}</div>
                    </div>
                  </div>
                </div>
              </CollapsePanel>
            </Collapse>
          </div>
        </div>
      </transition>

      <!-- ── Canvas ── -->
      <div class="eqflow-canvas-col">
        <!-- Toolbar (Hidden in readOnly mode) -->
        <div v-if="!readOnly" class="canvas-toolbar">
          <div class="flex items-center gap-2">
            <Tooltip :title="sidebarOpen ? $t('page.equipment.btnCloseSidebar') : $t('page.equipment.btnOpenSidebar')">
              <Button @click="sidebarOpen = !sidebarOpen">
                <UnorderedListOutlined class="size-4" />
              </Button>
            </Tooltip>
          </div>

          <div class="flex items-center gap-2">
            <Button @click="resetLayout">
              <RefreshOutlined class="size-4" />
              {{ $t('page.equipment.btnResetLayout') }}
            </Button>
          </div>
        </div>

        <!-- Drop zone + VueFlow -->
        <div
          class="canvas-drop-zone"
          @dragover="onCanvasDragOver"
          @drop="onCanvasDrop"
        >
          <!-- Loading overlay -->
          <div v-if="loading" class="canvas-loading">
            <Spin />
          </div>

          <!-- Empty state -->
          <div v-if="!loading && nodes.length === 0" class="canvas-empty">
            <Empty :description="$t('page.equipment.canvasEmptyHint')" />
          </div>

          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :default-viewport="{ zoom: 1, x: 0, y: 0 }"
            :min-zoom="0.2"
            :max-zoom="2"
            :fit-view-on-init="true"
            :pan-on-drag="true"
            :pan-on-scroll="false"
            :zoom-on-scroll="true"
            :zoom-on-pinch="true"
            :prevent-scrolling="true"
            :nodes-draggable="!readOnly"
            :nodes-connectable="!readOnly"
            :elements-selectable="!readOnly"
            @connect="onConnect"
          >
            <template #node-equipment="nodeProps">
              <EquipmentFlowNode v-bind="nodeProps" />
            </template>
            <Controls />
            <Background variant="dots" :pattern-color="patternColor" :gap="24" :size="1.2" />
          </VueFlow>
        </div>
      </div>

    </div>

    <!-- Equipment Detail Unified Modal -->
    <EquipmentUnifiedModal
      v-model:open="unifiedModalOpen"
      :equipment-id="selectedModalEquipmentId"
      @saved="fetchEquipmentData"
    />
  </div>
</template>

<style scoped>
/* ── Root ── */
.eqflow-root {
  display: block;
  overflow: hidden;
}

.eqflow-layout {
  display: flex;
  height: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
}

/* ── Sidebar ── */
.eqflow-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e2e8f0;
  background: #fff;
  overflow: hidden;
}

.sb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #fafafa;
}

.sb-title {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sb-close-btn {
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.sb-close-btn:hover { color: #475569; }

.sb-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sb-collapse {
  background: transparent !important;
}

:deep(.sb-collapse-panel) {
  border-bottom: 1px solid #f1f5f9 !important;
}
:deep(.sb-collapse-panel:last-child) {
  border-bottom: none !important;
}
:deep(.sb-collapse-panel .ant-collapse-header) {
  padding: 8px 6px !important;
  align-items: center !important;
}
:deep(.sb-collapse-panel .ant-collapse-content-box) {
  padding: 2px 4px 8px 4px !important;
}

.sb-category-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sb-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  background: #fff;
  cursor: grab;
  user-select: none;
  transition: border-color 0.2s, background 0.2s;
}
.sb-item:hover {
  border-color: #4096ff;
  background: #f0f5ff;
}
.sb-item:active {
  opacity: 0.6;
  cursor: grabbing;
}
.sb-item--current {
  border-color: #1677ff;
  background: #e6f4ff;
}

.sb-item-code {
  font-size: 13px;
  font-weight: 600;
  color: rgba(0,0,0,0.88);
  font-family: inherit;
  line-height: 1.3;
}
.sb-item-name {
  font-size: 12px;
  color: rgba(0,0,0,0.45);
  margin-top: 2px;
  line-height: 1.3;
}

/* Slide transition */
.sb-slide-enter-active,
.sb-slide-leave-active {
  transition: width 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}
.sb-slide-enter-from,
.sb-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}
.sb-slide-enter-to,
.sb-slide-leave-from {
  width: 300px;
  opacity: 1;
}

/* ── Canvas ── */
.eqflow-canvas-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  flex-shrink: 0;
  min-height: 40px;
}

.canvas-toolbar-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0,0,0,0.65);
}

.canvas-drop-zone {
  flex: 1;
  position: relative;
  /* VueFlow MUST have explicit dimensions */
  min-height: 0;
  overflow: hidden;
}

/* Critical: VueFlow wrapper must fill the drop zone */
.canvas-drop-zone :deep(.vue-flow) {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
}

.canvas-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248,250,252,0.75);
  z-index: 20;
}

.canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

/* Node wrapper — no extra chrome from VueFlow */
:deep(.vue-flow__node-equipment) {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  width: var(--node-width, 160px) !important;
}

/* Clean grab cursor on canvas */
:deep(.vue-flow__pane) {
  cursor: grab !important;
}
:deep(.vue-flow__pane:active) {
  cursor: grabbing !important;
}

/* ── Dark Mode Overrides ── */
.dark .eqflow-layout {
  border-color: #374151;
  background: #111827;
}

.dark .eqflow-sidebar {
  border-right-color: #374151;
  background: #1f2937;
}

.dark .sb-header {
  border-bottom-color: #374151;
  background: #111827;
}

.dark .sb-title {
  color: #9ca3af;
}

.dark .sb-item {
  border-color: #374151;
  background: #1f2937;
}
.dark .sb-item:hover {
  border-color: #3b82f6;
  background: #1e3a8a;
}
.dark .sb-item--current {
  border-color: #3b82f6;
  background: #172554;
}

.dark .sb-item-code {
  color: rgba(255, 255, 255, 0.85);
}
.dark .sb-item-name {
  color: rgba(255, 255, 255, 0.45);
}

.dark .canvas-toolbar {
  border-bottom-color: #374151;
  background: #1f2937;
}

.dark .canvas-loading {
  background: rgba(17, 24, 39, 0.75);
}

.dark :deep(.sb-collapse-panel) {
  border-bottom-color: #374151 !important;
}
.dark :deep(.sb-collapse-panel .ant-collapse-content) {
  background: transparent !important;
}

/* VueFlow Controls in Dark Mode */
.dark :deep(.vue-flow__controls) {
  background-color: #1f2937;
  border: 1px solid #374151;
}
.dark :deep(.vue-flow__controls-button) {
  background-color: #1f2937;
  color: #f3f4f6;
  border-bottom: 1px solid #374151;
}
.dark :deep(.vue-flow__controls-button:hover) {
  background-color: #374151;
}
.dark :deep(.vue-flow__controls-button svg) {
  fill: #f3f4f6;
}
</style>
