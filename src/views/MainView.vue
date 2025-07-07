<template>
  <div class="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
    <div class="bg-white shadow-md rounded-lg p-6 mb-6 w-full max-w-2xl relative">
      <h1 class="text-2xl font-bold mb-2">retto-demo</h1>
      <p class="text-gray-600">High-performance inference of the PaddleOCR model on desktop and WebAssembly🦀</p>
      <div class="absolute top-4 right-4">
        <a aria-label="GitHub" href="https://github.com/NekoImageLand/retto" target="_blank">
          <img alt="GitHub" class="h-6 w-6" src="@/assets/github-mark.svg"/>
        </a>
      </div>
    </div>
    <div class="bg-white shadow-md rounded-lg p-6 mb-4 w-full max-w-2xl">
      <label class="block text-lg font-medium mb-2" for="model">Select OCR Model</label>
      <select
          id="model"
          v-model="currentModel"
          class="border border-gray-300 rounded-lg p-2 w-full"
      >
        <option
            v-for="model in models"
            :key="model.value"
            :value="model.value"
        >
          {{ model.label }}
        </option>
      </select>
      <p class="text-gray-700 mt-2">{{ currentDesc }}</p>
    </div>
    <div class="bg-white shadow-md rounded-lg p-4 mb-6 w-full max-w-2xl">
      <p class="text-gray-800">
        Status: <span :class="statusClass">{{ ocrStore.statusText }}</span>
        <span v-if="ocrStore.state === RettoState.Processing"> ({{ ocrStore.progress }}%)</span>
      </p>
      <div v-if="ocrStore.state === RettoState.Processing" class="w-full bg-gray-200 rounded-full h-2 mt-2">
        <el-progress
            :percentage="ocrStore.progress"
            :show-text="false"
        />
      </div>
    </div>
    <UploadArea v-if="!showResult" @file-ready="rettoOCR"/>
    <OcrDisplay
        v-else
        :bitmap="currentBitmap!"
        :boxes="detBoxes"
        :results="recResults"
        @reset="resetAll"
    />
    <footer class="mt-0 text-center text-gray-500">
      <p>Built on WASM, all computations are performed locally</p>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import * as hub from '@huggingface/hub';
import { RettoState, useOcrStore } from '@/stores/ocr';
import UploadArea from '@/components/UploadArea.vue';
import OcrDisplay from '@/components/OcrDisplay.vue';
import { type PointBox, type RecProcessorSingleResult, Retto } from '@nekoimageland/retto-wasm';
import { storeToRefs } from "pinia";

interface ModelOption {
  value: string;
  label: string;
  desc: string;
  repo: string;
  det: string;
  rec: string;
  cls: string;
  dict: string;
}

const ocrStore = useOcrStore();

const models = ref<ModelOption[]>([
  {
    value: 'ch_PP-OCRv4',
    label: 'PaddleOCR [中文] ch_PP-OCRv4',
    desc: 'PaddleOCR于2023年5月发布的服务端文本识别模型',
    repo: 'pk5ls20/PaddleModel',
    det: 'retto/onnx/ch_PP-OCRv4_det_infer.onnx',
    rec: 'retto/onnx/ch_PP-OCRv4_rec_infer.onnx',
    cls: 'retto/onnx/ch_ppocr_mobile_v2.0_cls_infer.onnx',
    dict: 'retto/onnx/ppocr_keys_v1.txt',
  }
]);

const currentModel = ref(ocrStore.currentModel || models.value[0].value);
const currentDesc = computed(() => {
  const m = models.value.find(m => m.value === currentModel.value);
  return m ? m.desc : '';
});
watch(currentModel, (v) => {
  ocrStore.currentModel = v;
  localStorage.setItem('currentModel', v);
});

const statusClassMap: Record<RettoState, string> = {
  [RettoState.Idle]: 'text-green-600',
  [RettoState.Processing]: 'text-blue-600',
  [RettoState.Error]: 'text-red-600',
};
const statusClass = computed(() => statusClassMap[ocrStore.state]);

const { progress } = storeToRefs(ocrStore);
watch(progress, (s, d) => console.debug(`Retto process: ${d}% => ${s}%`));

const onIdle = (text?: string) => {
  ocrStore.statusText = text ?? 'Idle';
  ocrStore.state = RettoState.Idle;
  ocrStore.progress = 0;
}

const onStartProcess = (text: string) => {
  ocrStore.statusText = text;
  ocrStore.state = RettoState.Processing;
  ocrStore.progress = 0;
}

const onError = (err: Error) => {
  console.error('Retto error:', err);
  ocrStore.statusText = 'Error: ' + err.message;
  ocrStore.state = RettoState.Error;
  ocrStore.progress = 0;
}

const resetAll = () => {
  currentBitmap.value = null;
  detBoxes.value = [];
  recResults.value = [];
  showResult.value = false;
  ocrStore.clear();
  ocrStore.statusText = 'Idle';
  ocrStore.progress = 0;
  ocrStore.state = RettoState.Idle;
}

let rettoInstance: Retto | null = null;

const initRetto = async () => {
  const m = models.value.find(m => m.value === currentModel.value)!;
  onStartProcess('Downloading model files');
  const filePaths = [m.det, m.rec, m.cls, m.dict];
  const rawData = await Promise.all(
      filePaths.map(async path => {
        const [{ lastCommit }] = await hub.pathsInfo({ repo: { type: 'model', name: m.repo }, paths: [path], expand: true });
        const info = await hub.fileDownloadInfo({ repo: { type: 'model', name: m.repo }, path, raw: true });
        return { path, commit: lastCommit.id, info: info! };
      })
  );
  const cacheStorage = await caches.open('model-cache');
  const loaded = Array(rawData.length).fill(0);
  const buffers = await Promise.all(
      rawData.map(({ path, commit, info }, idx) => (async () => {
        info.url = info.url.replace('/raw/', '/resolve/');
        const key = `${m.repo}:${path}`;
        if (localStorage.getItem(`commit:${key}`) === commit) {
          const cached = await cacheStorage.match(info.url);
          if (cached) {
            loaded[idx] = 1;
            ocrStore.progress = Math.round((loaded.reduce((a, b) => a + b) / loaded.length) * 100);
            return cached.arrayBuffer();
          }
        }
        const res = await axios.get<ArrayBuffer>(info.url, {
          responseType: 'arraybuffer',
          onDownloadProgress: e => {
            if (e.total) {
              loaded[idx] = Math.min(1, e.loaded / e.total);
              ocrStore.progress = Math.round((loaded.reduce((a, b) => a + b) / loaded.length) * 100);
            }
          }
        });
        await cacheStorage.put(info.url, new Response(res.data));
        localStorage.setItem(`commit:${key}`, commit);
        loaded[idx] = 1;
        ocrStore.progress = Math.round((loaded.reduce((a, b) => a + b) / loaded.length) * 100);
        return res.data;
      })())
  );
  // Load wasm
  onStartProcess('Loading WASM');
  rettoInstance = await Retto.load(ratio => {
    ocrStore.progress = Math.round(ratio * 100);
  });
  await rettoInstance.init({
    det_model: buffers[0],
    rec_model: buffers[1],
    cls_model: buffers[2],
    rec_dict: buffers[3],
  });
  onIdle();
}

const bitmapToBuffer = async (bitmap: ImageBitmap): Promise<ArrayBuffer> => {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r));
  if (!blob) throw new Error('Canvas toBlob failed');
  return blob.arrayBuffer();
};

const currentBitmap = ref<ImageBitmap | null>(null);
const detBoxes = ref<PointBox[]>([]);
const recResults = ref<RecProcessorSingleResult[]>([]);
const showResult = ref(false);

const rettoOCR = async (bitmap: ImageBitmap) => {
  try {
    onStartProcess("Det")
    const start = performance.now();
    currentBitmap.value = bitmap;
    const buf = await bitmapToBuffer(bitmap);
    for await (const stage of rettoInstance!.recognize(buf)) {
      ocrStore.statusText = stage.stage.charAt(0).toUpperCase() + stage.stage.slice(1);
      const map: Record<string, number> = { det: 33, cls: 66, rec: 100 };
      ocrStore.progress = map[stage.stage];
      if (stage.stage === 'det') {
        detBoxes.value = stage.result.map(r => r.boxes);
        ocrStore.statusText = 'Cls';
      } else if (stage.stage === 'cls') {
        ocrStore.statusText = 'Rec';
      } else if (stage.stage === 'rec') {
        recResults.value = stage.result;
      }
    }
    onIdle(`Done in ${((performance.now() - start) / 1000).toFixed(3)}s`);
    ocrStore.results = recResults.value.map(r => r.text);
    showResult.value = true;
  } catch (err) {
    onError(err as Error);
  }
}

onMounted(async () => {
  const saved = localStorage.getItem('currentModel');
  if (saved) currentModel.value = saved;
  try {
    await initRetto();
  } catch (err) {
    onError(err as Error);
  }
});
</script>

<style scoped>
</style>
