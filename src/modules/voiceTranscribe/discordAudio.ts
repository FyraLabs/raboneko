import { polyfillWebCodecsApi } from 'webcodecs-polyfill';
import {
  BufferSource,
  Conversion,
  Input,
  NullTarget,
  OGG,
  Output,
  WavOutputFormat,
  WEBM,
} from 'mediabunny';

const TARGET_RATE = 16000;

polyfillWebCodecsApi();

async function decodeAudio(buffer: ArrayBuffer): Promise<Float32Array> {
  const input = new Input({
    formats: [OGG, WEBM],
    source: new BufferSource(buffer),
  });

  try {
    const chunks: Float32Array[] = [];
    let totalLength = 0;

    const conversion = await Conversion.init({
      input,
      output: new Output({
        format: new WavOutputFormat(),
        target: new NullTarget(),
      }),
      tracks: 'primary',
      video: { discard: true },
      audio: {
        codec: 'pcm-f32',
        numberOfChannels: 1,
        sampleRate: TARGET_RATE,
        sampleFormat: 'f32',
        forceTranscode: true,
        process(sample) {
          const chunk = new Float32Array(
            sample.allocationSize({ format: 'f32', planeIndex: 0 }) / 4,
          );
          sample.copyTo(chunk, { format: 'f32', planeIndex: 0 });
          chunks.push(chunk);
          totalLength += chunk.length;
          return sample;
        },
      },
    });

    if (!conversion.isValid) {
      throw new Error('Voice attachment has no convertible audio track.');
    }

    await conversion.execute();

    if (totalLength === 0) {
      throw new Error('Decoded PCM is empty.');
    }

    const audio = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }

    return audio;
  } finally {
    input.dispose();
  }
}

export async function fetchAttachmentToPcm16k(url: string): Promise<Float32Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download attachment (${res.status})`);
  }

  return decodeAudio(await res.arrayBuffer());
}
