<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { Button, notification, message } from 'ant-design-vue';
import { Html5Qrcode } from 'html5-qrcode';
import { useI18n } from '@vben/locales';

defineOptions({ name: 'QrCameraScanner' });

export interface EquipmentItem {
  id: string;
  code: string;
  name: string | null;
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    equipments?: EquipmentItem[];
    autoStart?: boolean;
    viewportId?: string;
  }>(),
  {
    equipments: () => [],
    autoStart: false,
    viewportId: 'qr-scanner-shared-viewport',
  }
);

const emit = defineEmits<{
  (e: 'scanned', payload: { rawText: string; matchedEquipment?: EquipmentItem }): void;
  (e: 'not-found', payload: { rawText: string }): void;
  (e: 'error', errMessage: string): void;
}>();

const { t } = useI18n();

const isScanning = ref(false);
const scanErrorMessage = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

let html5QrCode: Html5Qrcode | null = null;

// ─── Lookup Helper ───
function findEquipByQrText(text: string): EquipmentItem | undefined {
  if (!props.equipments || props.equipments.length === 0) return undefined;
  const cleanText = text.trim().toLowerCase();

  // Match code or id directly
  let match = props.equipments.find(
    (e) =>
      (e.code && String(e.code).toLowerCase() === cleanText) ||
      (e.id && String(e.id).toLowerCase() === cleanText)
  );
  if (match) return match;

  // Match JSON payload if applicable
  try {
    const obj = JSON.parse(text);
    if (obj?.id) {
      match = props.equipments.find(
        (e) => e.id && String(e.id).toLowerCase() === String(obj.id).toLowerCase()
      );
      if (match) return match;
    }
    if (obj?.code) {
      match = props.equipments.find(
        (e) => e.code && String(e.code).toLowerCase() === String(obj.code).toLowerCase()
      );
      if (match) return match;
    }
  } catch (e) {
    // Not valid JSON, ignore
  }

  // Match substring
  match = props.equipments.find(
    (e) => e.code && cleanText.includes(String(e.code).toLowerCase())
  );
  return match;
}

// ─── Real-time Camera Auto Scanner ───
async function startCamera() {
  await stopCamera();
  scanErrorMessage.value = '';
  await nextTick();

  try {
    isScanning.value = true;
    html5QrCode = new Html5Qrcode(props.viewportId);

    const config = {
      fps: 10,
      qrbox: { width: 230, height: 230 },
      aspectRatio: 1.0,
    };

    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText: string) => {
        handleRawScannedText(decodedText);
      },
      (_errorMessage: string) => {}
    );
  } catch (err: unknown) {
    console.error('Html5Qrcode camera error:', err);
    isScanning.value = false;
    const msg =
      t('page.portal.cameraPermissionError') ||
      'Không thể mở Camera. Vui lòng cấp quyền Camera trên trình duyệt.';
    scanErrorMessage.value = msg;
    message.error(
      t('page.portal.cameraAccessErrorToast') || 'Không thể truy cập Camera. Vui lòng cấp quyền!'
    );
    emit('error', msg);
  }
}

async function stopCamera() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (e) {
      console.warn('Error stopping camera scanner:', e);
    }
  }
  html5QrCode = null;
  isScanning.value = false;
}

async function handleRawScannedText(rawText: string) {
  await stopCamera();

  const matched = findEquipByQrText(rawText);

  if (matched) {
    emit('scanned', { rawText, matchedEquipment: matched });
  } else {
    // ─── Fallback Notification ───
    notification.warning({
      message: t('page.portal.qrNotFoundTitle') || 'Không tìm thấy thiết bị',
      description:
        t('page.portal.qrNotFoundDesc', { text: rawText }) ||
        `Hệ thống không tìm thấy thiết bị nào phù hợp với mã QR/UUID: "${rawText}"`,
      duration: 4.5,
    });
    emit('not-found', { rawText });
    emit('scanned', { rawText, matchedEquipment: undefined });
  }
}

// ─── File Upload Fallback ───
function triggerFileInput() {
  fileInputRef.value?.click();
}

async function handleFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    scanErrorMessage.value = '';
    const tempScanner = new Html5Qrcode('qr-temp-file-decoder');
    const resultText = await tempScanner.scanFile(file, true);
    await tempScanner.clear();
    handleRawScannedText(resultText);
  } catch (err) {
    console.error('File scan error:', err);
    const msg =
      t('page.portal.unableToDecodeQr') || 'Không thể đọc được mã QR từ hình ảnh này.';
    message.error(msg);
    scanErrorMessage.value = msg;
  } finally {
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}

defineExpose({
  startCamera,
  stopCamera,
  isScanning,
});

onMounted(() => {
  if (props.autoStart) {
    startCamera();
  }
});

onUnmounted(() => {
  stopCamera();
});
</script>

<template>
  <div class="flex flex-col items-center w-full">
    <!-- Hidden File Input & Decoder Div for Image Upload Fallback -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="handleFileSelected"
    />
    <div id="qr-temp-file-decoder" class="hidden"></div>

    <!-- Viewfinder Container (Equipment UI Style) -->
    <div
      class="relative w-72 h-72 border border-slate-200/80 dark:border-zinc-800 bg-black rounded-3xl flex flex-col items-center justify-center overflow-hidden shadow-inner cursor-pointer p-0 group"
      @click="!isScanning ? startCamera() : null"
    >
      <!-- Real Html5Qrcode Camera Video Container -->
      <div :id="viewportId" class="w-full h-full object-cover z-0"></div>

      <!-- Laser Line Scan Animation (Equipment UI Style) -->
      <div
        v-if="isScanning"
        class="scanline absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_12px_#6366f1] z-10 pointer-events-none"
      ></div>

      <!-- Viewfinder Corner Brackets (Equipment UI Style) -->
      <div
        class="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg z-10 pointer-events-none"
      ></div>
      <div
        class="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg z-10 pointer-events-none"
      ></div>
      <div
        class="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg z-10 pointer-events-none"
      ></div>
      <div
        class="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg z-10 pointer-events-none"
      ></div>

      <!-- Initial Overlay UI when camera is OFF -->
      <div
        v-if="!isScanning"
        class="absolute inset-0 text-center z-20 flex flex-col items-center justify-center p-4 bg-slate-900/90 w-full h-full hover:bg-slate-900/80 transition-colors"
      >
        <div
          class="mb-3 p-3.5 bg-indigo-500/20 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
            />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </div>
        <p class="text-[11px] text-slate-300 font-medium px-2 m-0">
          {{ t('page.portal.pressButtonToOpenCamera') || 'Bấm nút bên dưới để mở Camera quét tự động' }}
        </p>
      </div>
    </div>

    <!-- Error Message Display -->
    <p v-if="scanErrorMessage" class="text-xs text-rose-400 mt-2 mb-0 font-medium text-center">
      {{ scanErrorMessage }}
    </p>

    <!-- Action Buttons (Equipment & Incident Report UX Mix) -->
    <div class="mt-5 w-full max-w-[288px] flex flex-col gap-2.5">
      <Button
        v-if="!isScanning"
        type="primary"
        size="large"
        block
        class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold text-sm h-11 rounded-xl flex items-center justify-center gap-2 shadow-md"
        @click="startCamera"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0c-.698.04-1.332.417-1.736 1.039l-.821 1.316Z"
          />
        </svg>
        {{ t('page.portal.btnTurnOnCameraReal') || 'Mở Camera Quét QR' }}
      </Button>

      <Button
        v-else
        type="default"
        size="large"
        block
        class="bg-zinc-800 hover:bg-zinc-700 text-rose-400 border-zinc-700 font-bold text-xs h-10 rounded-xl"
        @click="stopCamera"
      >
        {{ t('page.portal.btnTurnOffCamera') || 'Tắt Camera' }}
      </Button>

      <!-- Fallback Upload Button -->
      <button
        type="button"
        class="text-[11px] font-semibold text-slate-400 hover:text-indigo-500 cursor-pointer bg-transparent border-0 underline self-center mt-0.5"
        @click="triggerFileInput"
      >
        {{ t('page.portal.selectImageFromDevice') || 'Tải ảnh QR từ thiết bị' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes scan {
  0% {
    top: 0%;
  }
  50% {
    top: 100%;
  }
  100% {
    top: 0%;
  }
}
.scanline {
  animation: scan 3s linear infinite;
}

:deep(#qr-scanner-shared-viewport video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
</style>
