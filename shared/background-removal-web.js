import { createBackgroundRemoval } from './background-removal-core.js';

// Keep the web deployment free of the ~28 MiB WASM asset. The extension uses the
// separate local entry point (background-removal.js) and is unaffected.
const ORT_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort.webgpu.min.mjs';
let enginePromise;

async function loadEngine() {
  if (!enginePromise) {
    enginePromise = import(/* @vite-ignore */ ORT_CDN_URL)
      .then(ort => createBackgroundRemoval(ort))
      .catch(error => {
        enginePromise = null;
        throw new Error(error?.message || '网页端去背运行时加载失败。');
      });
  }
  return enginePromise;
}

export async function removeBackground(file, onProgress) {
  const engine = await loadEngine();
  return engine.removeBackground(file, onProgress);
}
