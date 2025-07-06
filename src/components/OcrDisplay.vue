<template>
  <div class="relative w-full max-w-2xl">
    <button
        class="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded"
        @click="emit('reset')"
    >
      Reset
    </button>
    <img
        ref="imgRef"
        :src="imageSrc"
        class="w-full rounded"
        @load="onImageLoad"
    />
    <div
        v-if="imageLoaded"
    >
      <div
          v-for="(box, idx) in boxes"
          :key="idx"
          :style="computeBoxStyle(box)"
          class="absolute border-2 border-blue-500 cursor-pointer"
          @mouseenter="hoverIndex = idx"
          @mouseleave="hoverIndex = null"
          @click="selectedIndex = idx"
      ></div>
      <div
          v-if="(selectedIndex !== null)"
          :style="popoverStyle(activeBox)"
          class="absolute bg-white p-2 text-sm rounded shadow max-w-xs"
      >
        <div class="font-medium">{{ activeResult.text }}</div>
        <div class="text-gray-600 text-xs">score: {{ activeResult.score.toFixed(2) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { PointBox, RecProcessorSingleResult } from '@nekoimageland/retto-wasm';

const props = defineProps<{
  bitmap: ImageBitmap;
  boxes: PointBox[];
  results: RecProcessorSingleResult[];
}>();
const emit = defineEmits<{
  (e: 'reset'): void;
}>();

const imgRef = ref<HTMLImageElement | null>(null);
const imageSrc = ref<string>('');
const imageLoaded = ref(false);
const hoverIndex = ref<number | null>(null);
const selectedIndex = ref<number | null>(null);

onMounted(() => {
  const canvas = document.createElement('canvas');
  canvas.width = props.bitmap.width;
  canvas.height = props.bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(props.bitmap, 0, 0);
  imageSrc.value = canvas.toDataURL();
});

const onImageLoad = () => {
  imageLoaded.value = true;
}

const computeBoxStyle = (box: PointBox) => {
  if (!imgRef.value) return {};
  const { width: imgW, height: imgH } = imgRef.value.getBoundingClientRect();
  const scaleX = imgW / props.bitmap.width;
  const scaleY = imgH / props.bitmap.height;
  const xs = box.inner.map(p => p.x);
  const ys = box.inner.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    left: `${minX * scaleX}px`,
    top: `${minY * scaleY}px`,
    width: `${(maxX - minX) * scaleX}px`,
    height: `${(maxY - minY) * scaleY}px`,
  };
}

const popoverStyle = (box: PointBox) => {
  if (!imgRef.value) return {};
  const { width: imgW, height: imgH } = imgRef.value.getBoundingClientRect();
  const scaleX = imgW / props.bitmap.width;
  const scaleY = imgH / props.bitmap.height;
  const xs = box.inner.map(p => p.x);
  const ys = box.inner.map(p => p.y);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const left = maxX * scaleX + 4; // 4px margin to the right
  const top = minY * scaleY; // align top
  return {
    left: `${left}px`,
    top: `${top}px`,
  };
}

const activeIndex = computed(() => hoverIndex.value ?? selectedIndex.value);
const activeBox = computed(() => props.boxes[activeIndex.value!]);
const activeResult = computed(() => props.results[activeIndex.value!]);
</script>

<style scoped>
</style>
