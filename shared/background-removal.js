import * as ort from 'onnxruntime-web/webgpu';
import { createBackgroundRemoval } from './background-removal-core.js';

// Extension builds bundle this module together with the local ONNX WASM runtime.
export const { removeBackground } = createBackgroundRemoval(ort);
