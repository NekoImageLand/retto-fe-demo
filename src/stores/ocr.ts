import { defineStore } from "pinia";

export const useOcrStore = defineStore("ocr", {
  state: (): {
    objectUrls: string[];
    currentModel: string;
    results: string[];
    statusText: string;
    progress: number;
    isProcessing: boolean
  } => ({
    objectUrls: [],
    currentModel: "",
    results: [],
    statusText: "Idle",
    progress: 0,
    isProcessing: false,
  }),
  actions: {
    clear() {
      this.objectUrls = [];
      this.results = [];
      this.currentModel = "";
    },
  },
});
