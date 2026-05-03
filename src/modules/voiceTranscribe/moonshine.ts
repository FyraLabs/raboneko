import path from 'node:path';
import { createRequire } from 'node:module';
import { MoonshineModel, Settings } from '@moonshine-ai/moonshine-js';

const require = createRequire(__filename);
const onnxRuntimeWebRoot = path.dirname(require.resolve('onnxruntime-web/package.json'));

Settings.BASE_ASSET_PATH.ONNX_RUNTIME = `${path.join(onnxRuntimeWebRoot, 'dist')}/`;

const model = new MoonshineModel('model/tiny', 'float');
let loadPromise: Promise<void> | undefined;

async function ensureLoaded(): Promise<void> {
  loadPromise ??= model.loadModel();
  await loadPromise;
}

export async function transcribePcm16k(audio: Float32Array): Promise<string> {
  await ensureLoaded();
  return (await model.generate(audio)) ?? '';
}
