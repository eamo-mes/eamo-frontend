<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Modal, Spin, message } from 'ant-design-vue';
import axios from 'axios';

import { API_BASE_URL } from '#/api/config';
import { $t } from '#/locales';
import { useAccessStore } from '@vben/stores';

interface EquipmentItem {
  children?: EquipmentItem[];
  code: string;
  id: string;
  name: string | null;
  parent?: EquipmentItem | null;
}

const props = defineProps<{
  equipmentId: null | string;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
}>();

const childrenLoading = ref(false);
const selectedEquipment = ref<EquipmentItem | null>(null);
const childrenEquipments = ref<EquipmentItem[]>([]);

function getAuthHeaders() {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadRelationData(id: string) {
  childrenLoading.value = true;
  selectedEquipment.value = null;
  childrenEquipments.value = [];
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/equipment/${id}`, {
      headers: getAuthHeaders(),
      params: { include_children: true, include_parent: true },
    });
    const fetchedData = res.data?.data ?? res.data;
    if (fetchedData) {
      selectedEquipment.value = fetchedData;
      childrenEquipments.value = fetchedData.children || [];
    }
  } catch (err: any) {
    message.error(
      err?.response?.data?.message || $t('page.equipment.msgLoadRelationError'),
    );
  } finally {
    childrenLoading.value = false;
  }
}

watch(
  () => props.open,
  (newVal) => {
    if (newVal && props.equipmentId) {
      loadRelationData(props.equipmentId);
    }
  },
);
</script>

<template>
  <Modal
    :footer="null"
    :open="open"
    width="800px"
    @cancel="emit('update:open', false)"
    :title="
      selectedEquipment
        ? $t('page.equipment.relationModalTitle', {
            name: selectedEquipment.name || selectedEquipment.code,
          })
        : ''
    "
  >
    <Spin :spinning="childrenLoading">
      <div
        v-if="selectedEquipment"
        class="flex flex-col items-center gap-4 py-6 mt-4"
      >
        <!-- 1. Parent Node Section (Shown only if parent exists) -->
        <template v-if="selectedEquipment.parent">
          <div class="w-full max-w-[320px]">
            <div class="text-center mb-2">
              <span
                class="text-xs text-gray-400 font-semibold uppercase tracking-wider"
              >
                {{ $t('page.equipment.diagramParent') }}
              </span>
            </div>

            <div
              class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl shadow-xs text-center relative hover:shadow-sm hover:border-zinc-300 transition-all"
            >
              <router-link
                :to="{
                  name: 'EquipmentDetail',
                  query: { id: selectedEquipment.parent.id },
                }"
                @click="emit('update:open', false)"
                class="block hover:underline group"
              >
                <div
                  class="text-sm font-bold text-zinc-800 group-hover:text-blue-400 transition-colors"
                >
                  {{ selectedEquipment.parent.code }}
                </div>
                <div
                  class="text-xs text-zinc-500 mt-1 break-words group-hover:text-blue-400 transition-colors"
                >
                  {{ selectedEquipment.parent.name || '—' }}
                </div>
              </router-link>
            </div>
          </div>

          <!-- Connector Line 1: Parent -> Current -->
          <div class="flex flex-col items-center my-1">
            <div class="w-0.5 h-6 bg-zinc-300"></div>
            <div class="text-zinc-400 -mt-1 font-bold text-xs">▼</div>
          </div>
        </template>

        <!-- 2. Current Node Section (Always shown) -->
        <div class="w-full max-w-[340px]">
          <div class="text-center mb-2">
            <span
              class="text-xs text-zinc-500 font-bold uppercase tracking-wider"
            >
              {{ $t('page.equipment.diagramCurrent') }}
            </span>
          </div>

          <div
            class="p-4 bg-zinc-50 border-2 border-zinc-400 rounded-xl shadow-xs text-center relative hover:shadow-sm transition-all text-zinc-800"
          >
            <router-link
              :to="{
                name: 'EquipmentDetail',
                query: { id: selectedEquipment.id },
              }"
              @click="emit('update:open', false)"
              class="block hover:underline group"
            >
              <div
                class="text-sm font-bold text-zinc-800 group-hover:text-blue-400 transition-colors"
              >
                {{ selectedEquipment.code }}
              </div>
              <div
                class="text-xs text-zinc-500 mt-1 break-words group-hover:text-blue-400 transition-colors"
              >
                {{ selectedEquipment.name || '—' }}
              </div>
            </router-link>
          </div>
        </div>

        <!-- 3. Children Node Section (Shown only if children exist) -->
        <template v-if="childrenEquipments && childrenEquipments.length > 0">
          <!-- Connector Line 2: Current -> Children -->
          <div class="flex flex-col items-center my-1">
            <div class="w-0.5 h-6 bg-zinc-300"></div>
            <div class="text-zinc-400 -mt-1 font-bold text-xs">▼</div>
          </div>

          <div class="w-full">
            <div class="text-center mb-3">
              <span
                class="text-xs text-zinc-400 font-semibold uppercase tracking-wider"
              >
                {{ $t('page.equipment.diagramChildren') }}
              </span>
            </div>

            <!-- Children list container -->
            <div class="flex flex-wrap justify-center gap-4 px-4">
              <div
                v-for="child in childrenEquipments"
                :key="child.id"
                class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl shadow-xs text-center hover:shadow-sm hover:border-zinc-300 transition-all w-[200px] shrink-0"
              >
                <router-link
                  :to="{
                    name: 'EquipmentDetail',
                    query: { id: child.id },
                  }"
                  @click="emit('update:open', false)"
                  class="block hover:underline group"
                >
                  <div
                    class="text-sm font-bold text-zinc-800 group-hover:text-blue-400 transition-colors"
                  >
                    {{ child.code }}
                  </div>
                  <div
                    class="text-xs text-zinc-500 mt-1 break-words group-hover:text-blue-400 transition-colors"
                  >
                    {{ child.name || '—' }}
                  </div>
                </router-link>
              </div>
            </div>
          </div>
        </template>
      </div>
    </Spin>
  </Modal>
</template>
