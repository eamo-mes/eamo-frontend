<script lang="ts" setup>
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { Tooltip } from 'ant-design-vue';
import { createIconifyIcon } from '@vben/icons';
import { $t } from '#/locales';

const EyeOutlined = createIconifyIcon('ant-design:eye-outlined');
const CloseOutlined = createIconifyIcon('ant-design:close-outlined');

export interface EquipmentNodeData {
  id: string;
  code: string;
  name: string | null;
  category_name?: string | null;
  is_active?: boolean;
  parent_id?: string | null;
  isCurrent?: boolean;
  readOnly?: boolean;
  onRemoveParent?: (equipmentId: string) => void;
  onSelectEquipment?: (equipmentId: string) => void;
  onRemoveFromCanvas?: (equipmentId: string) => void;
}

const props = defineProps<{
  id: string;
  data: EquipmentNodeData;
}>();

const isCurrent = computed(() => !!props.data.isCurrent);

function handleSelect() {
  props.data.onSelectEquipment?.(props.id);
}
function handleRemoveFromCanvas() {
  props.data.onRemoveFromCanvas?.(props.id);
}
</script>

<template>
  <div class="eq-node" :class="{ 'eq-node--current': isCurrent }">
    <!-- Top handle: receives parent connection -->
    <Handle
      type="target"
      :position="Position.Top"
      id="parent-target"
      class="eq-handle eq-handle--top"
      :class="{ 'pointer-events-none': data.readOnly }"
    />

    <!-- Node body -->
    <div class="eq-node-body text-xs">
      <div class="eq-node-code">{{ data.code }}</div>
      <div class="eq-node-name">{{ data.name || '—' }}</div>
    </div>

    <!-- Direct Action Icons Bar on Top-Right (Always Visible unless readOnly) -->
    <div v-if="!data.readOnly" class="eq-node-actions" @click.stop>
      <!-- View Detail -->
      <Tooltip :title="$t('page.equipment.detail')">
        <button type="button" class="eq-action-btn hover:text-blue-500" @click="handleSelect">
          <EyeOutlined class="size-3.5 text-gray-400 hover:text-blue-500" />
        </button>
      </Tooltip>

      <!-- Remove from canvas -->
      <Tooltip :title="$t('page.equipment.btnRemoveFromCanvas')">
        <button type="button" class="eq-action-btn hover:text-orange-500" @click="handleRemoveFromCanvas">
          <CloseOutlined class="size-3.5 text-gray-400 hover:text-orange-500" />
        </button>
      </Tooltip>
    </div>

    <!-- Bottom handle: start parent connection from here -->
    <Handle
      type="source"
      :position="Position.Bottom"
      id="child-source"
      class="eq-handle eq-handle--bottom"
      :class="{ 'pointer-events-none': data.readOnly }"
    />
  </div>
</template>

<style scoped>
.eq-node {
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
  font-family: inherit;
  cursor: default;
}
.eq-node:hover {
  border-color: #1677ff;
  box-shadow: 0 2px 8px rgba(22,119,255,0.12);
}
.eq-node--current {
  border-color: #1677ff;
  border-width: 1.5px;
  background: #e6f4ff;
  box-shadow: 0 2px 8px rgba(22,119,255,0.18);
}

.eq-node-body {
  flex: 1;
  min-width: 0;
}

.eq-node-code {
  font-size: 13px;
  font-weight: 600;
  color: rgba(0,0,0,0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.eq-node-name {
  font-size: 12px;
  color: rgba(0,0,0,0.55);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.eq-node-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  flex-shrink: 0;
  opacity: 1;
}

.eq-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.eq-action-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

/* Handles — clear, sharp dots for easy dragging */
.eq-handle {
  width: 9px !important;
  height: 9px !important;
  border-radius: 50% !important;
  border: 2px solid #ffffff !important;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15) !important;
  transition: transform 0.15s !important;
}
.eq-handle:hover {
  transform: scale(1.3) !important;
}
.eq-handle--top {
  background: #1677ff !important;
  top: -5.5px !important;
}
.eq-handle--bottom {
  background: #52c41a !important;
  bottom: -5.5px !important;
}

/* ── Dark Mode Overrides ── */
.dark .eq-node {
  background: #1f2937;
  border-color: #374151;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.dark .eq-node:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59,130,246,0.25);
}
.dark .eq-node--current {
  border-color: #3b82f6;
  background: #172554;
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}
.dark .eq-node-code {
  color: rgba(255, 255, 255, 0.85);
}
.dark .eq-node-name {
  color: rgba(255, 255, 255, 0.45);
}
.dark .eq-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}
.dark .eq-handle {
  border-color: #1f2937 !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) !important;
}
</style>
