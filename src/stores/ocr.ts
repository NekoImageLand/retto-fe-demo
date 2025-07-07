import { defineStore } from "pinia";

export enum RettoState {
  Idle,
  Processing,
  Error
}

export const useOcrStore = defineStore("ocr", {
  state: (): {
    objectUrls: string[];
    currentModel: string;
    results: string[];
    statusText: string;
    progress: number;
    state: RettoState;
  } => ({
    objectUrls: [],
    currentModel: "",
    results: [],
    statusText: "Idle",
    progress: 0,
    state: RettoState.Idle,
  }),
  actions: {
    clear() {
      this.objectUrls = [];
      this.results = [];
      this.currentModel = "";
    },
  },
});
