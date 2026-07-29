<script lang="ts" setup>
import { ref } from 'vue';
import { Modal, Button, QRCode, message } from 'ant-design-vue';
import { $t } from '#/locales';

interface CategoryOption {
  id: string;
  code: string;
  name: string;
}

interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  equipment_category_id?: string | null;
  equipment_category?: CategoryOption | null;
  is_active?: boolean;
}

const props = defineProps<{
  open: boolean;
  equipment: EquipmentItem | null;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
}>();

const qrContainerRef = ref<HTMLDivElement | null>(null);

function handlePrint() {
  if (!props.equipment) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    message.error('Không thể mở cửa sổ in. Vui lòng cho phép trình duyệt mở popup.');
    return;
  }

  // Get image src or canvas data from the QRCode element
  let qrDataUrl = '';
  if (qrContainerRef.value) {
    const canvas = qrContainerRef.value.querySelector('canvas');
    if (canvas) {
      qrDataUrl = canvas.toDataURL('image/png');
    } else {
      const img = qrContainerRef.value.querySelector('img');
      if (img) {
        qrDataUrl = img.src;
      }
    }
  }

  const eqCode = props.equipment.code || '—';
  const eqName = props.equipment.name || 'Chưa đặt tên';
  const categoryName = props.equipment.equipment_category?.name || '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>In mã QR - ${eqCode}</title>
        <style>
          @page {
            size: auto;
            margin: 10mm;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 90vh;
            margin: 0;
            background: #ffffff;
            color: #111827;
          }
          .qr-card {
            border: 2px solid #111827;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            width: 300px;
            box-shadow: none;
          }
          .qr-image {
            width: 200px;
            height: 200px;
            margin: 0 auto 16px auto;
            display: block;
          }
          .eq-title {
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 6px 0;
            word-break: break-word;
          }
          .eq-code {
            font-size: 13px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 600;
            color: #374151;
            background: #f3f4f6;
            padding: 4px 10px;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 6px;
          }
          .eq-category {
            font-size: 11px;
            color: #6b7280;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="qr-card">
          ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-image" alt="QR Code" />` : ''}
          <div class="eq-title">${eqName}</div>
          <div class="eq-code">MÃ: ${eqCode}</div>
          ${categoryName ? `<p class="eq-category">Loại: ${categoryName}</p>` : ''}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 250);
          };
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
</script>

<template>
  <Modal
    :open="open"
    width="600px"
    :title="$t('page.equipment.qrModalTitle')"
    :destroy-on-close="true"
    @update:open="(val: boolean) => emit('update:open', val)"
  >
    <div class="flex flex-col items-center justify-center p-6 space-y-4 text-center">
      <!-- QR Code Wrapper -->
      <div 
        ref="qrContainerRef" 
        class="p-4 bg-white border border-border rounded-2xl shadow-xs flex items-center justify-center"
      >
        <QRCode
          :value="equipment?.id || equipment?.code || ''"
          :size="220"
          bordered
          color="#111827"
          bg-color="#ffffff"
        />
      </div>

      <!-- Equipment Specs Details -->
      <div class="space-y-1.5 max-w-[400px]">
        <h3 class="text-base font-bold text-foreground m-0 leading-snug">
          {{ equipment?.name || '—' }}
        </h3>
        <div class="flex items-center justify-center gap-2">
          <span class="text-xs font-mono font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
            {{ $t('page.equipment.colCode') }}: {{ equipment?.code || '—' }}
          </span>
        </div>
        <p v-if="equipment?.equipment_category?.name" class="text-xs text-muted-foreground m-0 pt-0.5">
          {{ $t('page.equipment.colCategory') }}: {{ equipment.equipment_category.name }}
        </p>
      </div>
    </div>

    <!-- Modal Footer with Print Button -->
    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button type="default" @click="emit('update:open', false)">
          {{ $t('page.equipment.modalCancel') }}
        </Button>
        <Button
          type="primary"
          class="bg-[#5c3e35] hover:bg-[#4b332b] border-[#5c3e35] text-white flex items-center gap-1.5 font-medium"
          @click="handlePrint"
        >
          <!-- Printer Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect width="12" height="8" x="6" y="14" rx="1"/></svg>
          {{ $t('page.equipment.btnPrintQr') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
