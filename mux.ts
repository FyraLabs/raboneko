import "node-web-audio-api/polyfill.js";
import { registerMediabunnyServer } from "@mediabunny/server";
registerMediabunnyServer();

import { fromFileUrl, toFileUrl } from "jsr:@std/path";
import {
  AppendOnlyStreamTarget,
  AudioBufferSink,
  AudioBufferSource,
  BufferSource,
  BufferTarget,
  Conversion,
  EncodedAudioPacketSource,
  EncodedPacket,
  FilePathSource,
  FilePathTarget,
  Input,
  MATROSKA,
  MkvOutputFormat,
  Output,
  Quality,
  ReadableStreamSource,
  StreamTarget,
  WAVE,
  WavOutputFormat,
} from "mediabunny";
import { OfflineAudioContext } from "node-web-audio-api";
import "@std/dotenv/load";
import { mistral, MistralTranscriptionModelOptions } from "@ai-sdk/mistral";
import { transcribe } from "ai";
import { pooledMap } from "@std/async/pool";
import * as bytes from "@std/bytes";

import { decodeCborSequence } from "@std/cbor";
import { YapEntry } from "./src/yap/entry.ts";
import { decodeYapEntries, Packet } from "./src/yap/decode.ts";
import { assert } from "node:console";
import { muxStream } from "./src/yap/processing.ts";

const transcribeStream = async (audioFile: string, startSecond: number) => {
  const { text, segments, language } = await transcribe({
    model: mistral.transcription("voxtral-mini-latest"),
    audio: toFileUrl(audioFile),
    providerOptions: {
      mistral: {
        timestampGranularities: ["segment"],
      } satisfies MistralTranscriptionModelOptions,
    },
  });

  return {
    text,
    language,
    // Segment timings come back relative to the stream, so shift them onto the
    // recording's timeline.
    segments: segments.map((segment) => ({
      ...segment,
      startSecond: segment.startSecond + startSecond,
      endSecond: segment.endSecond + startSecond,
    })),
  };
};

let unifiedTranscript: {
  userId: string;
  text: string;
  start: number;
  end: number;
}[] = [];

const file = await Deno.readFile("recording.yap");
const yap = decodeYapEntries(decodeCborSequence(file) as YapEntry[]);

// Steps:
// - Get streams, process them one by one into .wav files.
// - Mix them into a single playable file
// - Upload individual streams to get transcripts
// - Mix transcripts together

await Array.fromAsync(
  pooledMap(1, yap.streams, async (stream) => {
    const output = new Output({
      format: new MkvOutputFormat({
        appendOnly: true,
      }),
      target: new FilePathTarget(`output-${stream.ssrc}.mka`),
    });

    await muxStream(stream, output);

    return {
      userId: stream.userId,
      start: stream.packets[0].duration,
      // buffer: wav.target.buffer!,
    };
  }),
);

// something something trim

const meta = Object.fromEntries(
  yap.streams.map(({ userId, received, ssrc }) => [ssrc, {
    userId,
    received,
  }]),
);

const mixStreams = async () => {
  const ctx = new OfflineAudioContext({
    length: 48000 * 100,
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  for (const stream of yap.streams) {
    const input = new Input({
      formats: [MATROSKA],
      source: new FilePathSource(`output-${stream.ssrc}.mka`),
    });
    const bufferSink = new AudioBufferSink((await input.getAudioTracks())[0]);

    for await (const buffer of bufferSink.buffers()) {
      const source = ctx.createBufferSource();
      source.buffer = buffer.buffer;
      source.connect(ctx.destination);
      source.start(buffer.timestamp); // weird offset issue
    }
  }

  const audioBuffer = await ctx.startRendering();

  const output = new Output({
    format: new MkvOutputFormat(),
    target: new FilePathTarget("lol.mka"),
  });

  const bufferSource = new AudioBufferSource({
    codec: "opus",
    quality: new Quality("medium"),
  });
  output.addAudioTrack(bufferSource);

  await output.start();

  await bufferSource.add(audioBuffer);
  bufferSource.close();

  await output.finalize();
};

mixStreams();

// {
//   const ctx = new OfflineAudioContext({
//     length: 48000 * 100,
//     sampleRate: 48000,
//     numberOfChannels: 2,
//   });

//   for (const track of tracks) {
//     for await (const buffer of track.sink.buffers()) {
//       const source = ctx.createBufferSource();
//       source.buffer = buffer.buffer;
//       source.connect(ctx.destination);
//       source.start(track.start + buffer.timestamp);
//     }
//   }

//   const audioBuffer = await ctx.startRendering();

//   const output = new Output({
//     format: new MkvOutputFormat(),
//     target: new FilePathTarget("lol.ogg"),
//   });

//   const bufferSource = new AudioBufferSource({
//     codec: "opus",
//     quality: new Quality("medium"),
//   });
//   output.addAudioTrack(bufferSource);

//   await output.start();

//   await bufferSource.add(audioBuffer);
//   bufferSource.close();

//   await output.finalize();
// }

// for (const [i, stream] of streams.entries()) {
//   const output = new Output({
//     format: new MkvOutputFormat(),
//     target: new BufferTarget(),
//   });

//   const startSecond = await muxStream(stream.ssrc, output);

//   const input = new Input({
//     formats: [MATROSKA],
//     source: new BufferSource(output.target.buffer!),
//   });
//   const wav = new Output({
//     format: new WavOutputFormat(),
//     target: new BufferTarget(),
//   });
//   const conversion = await Conversion.init({
//     input,
//     output: wav,
//   });
//   await conversion.execute();

//   const wavBuffer = new Uint8Array(wav.target.buffer!);
//   await Deno.writeFile(`output-${i}.wav`, wavBuffer);

//   const transcript = await transcribeStream(wavBuffer, startSecond);

//   unifiedTranscript = unifiedTranscript.concat(
//     transcript.segments.map((s) => ({
//       userId: stream.userId,
//       start: s.startSecond,
//       end: s.endSecond,
//       text: s.text.trim(),
//     })),
//   );
// }

// unifiedTranscript.sort((a, b) => a.start - b.start);

// console.log(unifiedTranscript);

// trim
