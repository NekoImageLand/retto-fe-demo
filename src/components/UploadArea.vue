<template>
  <div
      :class="[
      'relative bg-white border-2 border-dashed rounded-lg w-full max-w-2xl h-64 flex items-center justify-center mb-6 transition-colors',
      { 'bg-blue-50': isOnDrag },
      { 'opacity-50 pointer-events-none filter grayscale': ocrStore.state !== RettoState.Idle }
    ]"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @paste.prevent="handlePaste"
  >
    <input
        ref="fileInput"
        accept="image/*"
        class="hidden"
        multiple
        type="file"
        @change="onFilesSelected"
    />
    <div class="text-center">
      <p class="mb-4">Drag &amp; drop images here, or</p>
      <button
          class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
          :disabled="ocrStore.state !== RettoState.Idle"
          @click="triggerFileInput"
      >
        Upload Images
      </button>
      <p class="mt-4 text-sm text-gray-500">
        Or press <kbd class="px-2 py-1 bg-gray-200 rounded">Ctrl + V</kbd> to paste from clipboard
      </p>
    </div>
    <div
v-if="isOnDrag && ocrStore.state === RettoState.Idle"
         class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span class="text-blue-500 font-bold">Release to start OCR</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RettoState, useOcrStore } from '@/stores/ocr.ts';

const ocrStore = useOcrStore();
const emit = defineEmits<{
  (e: 'file-ready', bitmap: ImageBitmap): void;
}>();
const fileInput = ref<HTMLInputElement | null>(null);
const isOnDrag = ref(false);

const triggerFileInput = () => fileInput.value?.click();

const onFilesSelected = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (!files) return;
  Array.from(files).forEach(file =>
      createImageBitmap(file).then(bitmap => emit('file-ready', bitmap))
  );
};

const handlePaste = (event: ClipboardEvent) => {
  if (ocrStore.state !== RettoState.Idle) return;
  const items = event.clipboardData?.items;
  if (!items) return;
  Array.from(items).forEach(item => {
    const file = item.getAsFile();
    if (item.kind === 'file' && file) {
      createImageBitmap(file).then(bitmap => emit('file-ready', bitmap));
    }
  });
};

const handleDragOver = () => {
  if (ocrStore.state !== RettoState.Idle) return;
  isOnDrag.value = true;
};

const handleDragLeave = () => {
  if (ocrStore.state !== RettoState.Idle) return;
  isOnDrag.value = false;
};

const handleDrop = (event: DragEvent) => {
  if (ocrStore.state !== RettoState.Idle) return;
  isOnDrag.value = false;
  const files = event.dataTransfer?.files;
  if (!files) return;
  Array.from(files).forEach(file =>
      createImageBitmap(file).then(bitmap => emit('file-ready', bitmap))
  );
};
</script>
