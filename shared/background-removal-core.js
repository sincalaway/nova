// Shared background-removal implementation. The caller supplies the ONNX Runtime
// module so the web build can load it from a pinned CDN while the extension keeps
// its local, packaged runtime.

const MODEL_URL = 'https://huggingface.co/studioludens/birefnet-lite-512/resolve/4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7/onnx/model_fp16.onnx?download=true';
const INPUT_SIZE = 512;

export function createBackgroundRemoval(ort) {
  let sessionPromise = null;

  function report(callback, message, progress) {
    try { callback?.(message, progress); } catch (_) {}
  }

  async function loadModel(onProgress) {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      report(onProgress, '正在下载本地模型', 0);
      const response = await fetch(MODEL_URL, { cache: 'force-cache', credentials: 'omit', mode: 'cors' });
      if (!response.ok) throw new Error(`模型下载失败（HTTP ${response.status}）。检查网络后可重试。`);
      const total = Number(response.headers.get('content-length')) || 0;
      let buffer;
      if (response.body?.getReader) {
        const reader = response.body.getReader(), chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); received += value.byteLength;
          report(onProgress, '正在下载本地模型', total ? received / total : null);
        }
        buffer = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      } else {
        buffer = new Uint8Array(await response.arrayBuffer());
        report(onProgress, '正在下载本地模型', 1);
      }
      report(onProgress, '正在初始化 WebGPU 推理', null);
      ort.env.logLevel = 'warning';
      const session = await ort.InferenceSession.create(buffer, {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all'
      });
      report(onProgress, '本地模型已就绪', 1);
      return session;
    })().catch(error => {
      sessionPromise = null;
      throw new Error(error?.message || '本地模型加载失败。');
    });
    return sessionPromise;
  }

  function imageToTensor(bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE; canvas.height = INPUT_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const values = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0, n = INPUT_SIZE * INPUT_SIZE; i < n; i++) {
      values[i] = (pixels[i * 4] / 255 - mean[0]) / std[0];
      values[n + i] = (pixels[i * 4 + 1] / 255 - mean[1]) / std[1];
      values[2 * n + i] = (pixels[i * 4 + 2] / 255 - mean[2]) / std[2];
    }
    return new ort.Tensor('float32', values, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  }

  function toPngBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法生成 PNG 图片。')), 'image/png'));
  }

  return {
    async removeBackground(file, onProgress) {
      if (!(file instanceof Blob)) throw new Error('请先选择有效图片。');
      if (!navigator.gpu) throw new Error('此浏览器不支持 WebGPU；可使用纯色背景抠除。');
      let bitmap;
      try {
        report(onProgress, '正在读取图片', null);
        bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > 32000000) throw new Error('图片像素过多，请先缩小尺寸。');
        const session = await loadModel(onProgress);
        report(onProgress, '正在识别主体', null);
        const input = imageToTensor(bitmap);
        const outputs = await session.run({ [session.inputNames[0]]: input });
        const mask = outputs[session.outputNames[0]];
        const dims = mask.dims || [], height = Number(dims.at(-2)) || INPUT_SIZE, width = Number(dims.at(-1)) || INPUT_SIZE;
        const logits = mask.data, maskPixels = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const logit = Number(logits[i]);
          const alpha = Math.max(0, Math.min(1, 1 / (1 + Math.exp(-logit))));
          const j = i * 4;
          maskPixels[j] = maskPixels[j + 1] = maskPixels[j + 2] = 255;
          maskPixels[j + 3] = Math.round(alpha * 255);
        }
        const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height;
        maskCanvas.getContext('2d').putImageData(new ImageData(maskPixels, width, height), 0, 0);
        const outputCanvas = document.createElement('canvas'); outputCanvas.width = bitmap.width; outputCanvas.height = bitmap.height;
        const outputContext = outputCanvas.getContext('2d', { willReadFrequently: false });
        outputContext.drawImage(bitmap, 0, 0);
        outputContext.globalCompositeOperation = 'destination-in';
        outputContext.drawImage(maskCanvas, 0, 0, bitmap.width, bitmap.height);
        outputContext.globalCompositeOperation = 'source-over';
        report(onProgress, '正在生成透明 PNG', 1);
        return await toPngBlob(outputCanvas);
      } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('本地智能去背失败。可尝试纯色背景抠除。');
      } finally {
        bitmap?.close?.();
      }
    }
  };
}
