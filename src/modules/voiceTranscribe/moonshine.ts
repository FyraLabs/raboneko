import path from 'node:path';
import { createRequire } from 'node:module';
import { MoonshineModel, Settings } from '@moonshine-ai/moonshine-js';

const require = createRequire(__filename);
const onnxRuntimeWebRoot = path.dirname(require.resolve('onnxruntime-web/package.json'));

Settings.BASE_ASSET_PATH.ONNX_RUNTIME = `${path.join(onnxRuntimeWebRoot, 'dist')}/`;

const SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 10;
const CHUNK_SIZE = SAMPLE_RATE * CHUNK_SECONDS;

const model = new MoonshineModel('model/tiny', 'float');
let loadPromise: Promise<void> | undefined;

async function ensureLoaded(): Promise<void> {
  loadPromise ??= model.loadModel();
  await loadPromise;
}

export async function transcribePcm16k(audio: Float32Array): Promise<string> {
  await ensureLoaded();

  const parts: string[] = [];
  for (let offset = 0; offset < audio.length; offset += CHUNK_SIZE) {
    const chunk = audio.subarray(offset, offset + CHUNK_SIZE);
    const text = ((await model.generate(chunk)) ?? '').trim();
    if (text.length > 0) {
      parts.push(text);
    }
  }

  return parts.join(' ');
}
