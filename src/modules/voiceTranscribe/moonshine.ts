import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { MoonshineModel, Settings } from '@moonshine-ai/moonshine-js';
import { NonRealTimeVAD } from '@ricky0123/vad-web';

const require = createRequire(__filename);
const onnxRuntimeWebRoot = path.dirname(require.resolve('onnxruntime-web/package.json'));
const vadOnnxRuntimeWebRoot = path.dirname(
  require.resolve('@ricky0123/vad-web/node_modules/onnxruntime-web/package.json'),
);
const vadModelPath = require.resolve('@ricky0123/vad-web/dist/silero_vad_legacy.onnx');

Settings.BASE_ASSET_PATH.ONNX_RUNTIME = `${path.join(onnxRuntimeWebRoot, 'dist')}/`;

const SAMPLE_RATE = 16000;
const MAX_SEGMENT_SIZE = SAMPLE_RATE * 25;

const model = new MoonshineModel('model/base');
let loadPromise: Promise<void> | undefined;
let vadPromise: Promise<NonRealTimeVAD> | undefined;

async function ensureLoaded(): Promise<void> {
  loadPromise ??= model.loadModel();
  await loadPromise;
}

async function readArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  const buffer = await readFile(filePath);
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

async function ensureVadLoaded(): Promise<NonRealTimeVAD> {
  vadPromise ??= NonRealTimeVAD.new({
    modelURL: vadModelPath,
    modelFetcher: readArrayBuffer,
    ortConfig(ort) {
      ort.env.wasm.wasmPaths = `${path.join(vadOnnxRuntimeWebRoot, 'dist')}/`;
    },
  });
  return vadPromise;
}

export async function preloadTranscriber(): Promise<void> {
  await Promise.all([ensureLoaded(), ensureVadLoaded()]);
}

function splitByMaxLength(audio: Float32Array): Float32Array[] {
  const segments: Float32Array[] = [];
  for (let offset = 0; offset < audio.length; offset += MAX_SEGMENT_SIZE) {
    segments.push(audio.subarray(offset, offset + MAX_SEGMENT_SIZE));
  }
  return segments;
}

async function splitWithVad(audio: Float32Array): Promise<Float32Array[]> {
  const vad = await ensureVadLoaded();
  const segments: Float32Array[] = [];

  for await (const segment of vad.run(audio, SAMPLE_RATE)) {
    for (const chunk of splitByMaxLength(segment.audio)) {
      segments.push(chunk);
    }
  }

  return segments.length > 0 ? segments : splitByMaxLength(audio);
}

export async function transcribePcm16k(audio: Float32Array): Promise<string> {
  await ensureLoaded();

  const parts: string[] = [];
  let chunks: Float32Array[];
  try {
    chunks = await splitWithVad(audio);
  } catch (err) {
    console.warn('[voiceTranscribe] Falling back to max-length segmentation.', err);
    chunks = splitByMaxLength(audio);
  }

  for (const chunk of chunks) {
    const text = ((await model.generate(chunk)) ?? '').trim();
    if (text.length > 0) {
      parts.push(text);
    }
  }

  return parts.join(' ');
}
