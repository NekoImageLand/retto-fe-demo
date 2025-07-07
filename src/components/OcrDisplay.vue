<template>
  <div class="bg-white shadow-md rounded-lg p-6 mb-4 w-full max-w-2xl">
    <div class="flex justify-end mb-4 space-x-2">
      <button
          class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded"
          @click="toggleResults"
      >
        Results
      </button>
      <button
          class="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded"
          @click="emit('reset')"
      >
        Reset
      </button>
    </div>
    <div class="relative">
      <img
          ref="imgRef"
          :src="imageSrc"
          class="w-full rounded"
          @load="onImageLoad"
      />
      <div v-if="imageLoaded">
        <div
            v-for="(box, idx) in boxes"
            :key="idx"
            :style="computeBoxStyle(box)"
            class="absolute border-2 border-blue-500 cursor-pointer"
            @click="selectedIndex = idx"
            @mouseenter="hoverIndex = idx"
            @mouseleave="hoverIndex = null"
        ></div>
        <div
            v-if="activeIndex !== null"
            :style="popoverStyle(activeBox)"
            class="absolute bg-white p-2 text-sm rounded shadow max-w-xs"
        >
          <div class="font-medium">{{ activeResult.text }}</div>
          <div class="text-gray-600 text-xs">
            score: {{ activeResult.score.toFixed(2) }}
          </div>
        </div>
      </div>
    </div>
    <ElDialog v-model="showResults" :destroy-on-close="true" title="Results" width="50%">
      <div class="max-h-60 overflow-y-auto">
        <div
            v-for="(res, idx) in results"
            :key="idx"
            class="mb-3"
        >
          <div class="font-medium text-gray-800">{{ res.text }}</div>
          <div class="text-gray-600 text-xs">
            (score: {{ res.score.toFixed(2) }})
          </div>
        </div>
      </div>
      <template #footer>
        <button
            class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-1 px-3 rounded"
            @click="showResults = false"
        >
          Close
        </button>
      </template>
    </ElDialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { ElDialog } from 'element-plus';
import type { PointBox, RecProcessorSingleResult } from '@nekoimageland/retto-wasm';

const props = defineProps<{
  bitmap: ImageBitmap;
  boxes: PointBox[];
  results: RecProcessorSingleResult[];
}>();
const emit = defineEmits<{ (e: 'reset'): void }>();

const imgRef = ref<HTMLImageElement | null>(null);
const imageSrc = ref<string>('');
const imageLoaded = ref(false);
const hoverIndex = ref<number | null>(null);
const selectedIndex = ref<number | null>(null);
const showResults = ref(false);

onMounted(() => {
  const canvas = document.createElement('canvas');
  canvas.width = props.bitmap.width;
  canvas.height = props.bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(props.bitmap, 0, 0);
  imageSrc.value = canvas.toDataURL();
});

const onImageLoad = () => imageLoaded.value = true;
const toggleResults = () => showResults.value = !showResults.value;

const activeIndex = computed<number | null>(() => hoverIndex.value ?? selectedIndex.value);
const activeBox = computed(() => props.boxes[activeIndex.value!]);
const activeResult = computed(() => props.results[activeIndex.value!]);

const computeBoxStyle = (box: PointBox) => {
  if (!imgRef.value) return {};
  const rect = imgRef.value.getBoundingClientRect();
  const scaleX = rect.width / props.bitmap.width;
  const scaleY = rect.height / props.bitmap.height;
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
};

const popoverStyle = (box: PointBox) => {
  if (!imgRef.value) return {};
  const rect = imgRef.value.getBoundingClientRect();
  const scaleX = rect.width / props.bitmap.width;
  const scaleY = rect.height / props.bitmap.height;
  const xs = box.inner.map(p => p.x);
  const ys = box.inner.map(p => p.y);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  return {
    left: `${maxX * scaleX + 4}px`,
    top: `${minY * scaleY}px`,
  };
};
</script>

<style scoped>
</style>
