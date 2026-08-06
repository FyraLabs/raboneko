import "node-web-audio-api/polyfill.js";
import { registerMediabunnyServer } from "@mediabunny/server";
registerMediabunnyServer();

import {
  AudioBufferSink,
  AudioBufferSource,
  BufferSource,
  BufferTarget,
  Conversion,
  EncodedAudioPacketSource,
  EncodedPacket,
  FilePathTarget,
  Input,
  MATROSKA,
  MkvOutputFormat,
  Output,
  Quality,
  WavOutputFormat,
} from "mediabunny";
import { OfflineAudioContext } from "node-web-audio-api";
import "@std/dotenv/load";
import { mistral, MistralTranscriptionModelOptions } from "@ai-sdk/mistral";
import { transcribe } from "ai";
import { pooledMap } from "@std/async/pool";

import { decodeCborSequence } from "@std/cbor";
import { YapEntry } from "./src/yap.ts";

function opusPacketDuration(packet: Uint8Array): number {
  const toc = packet[0];
  const config = toc >> 3;
  const code = toc & 0b11;

  // Frame size in seconds, per RFC 6716 §3.1
  let frameSize: number;
  if (config < 12) {
    frameSize = [0.01, 0.02, 0.04, 0.06][config % 4]; // SILK
  } else if (config < 16) {
    frameSize = [0.01, 0.02][config % 2]; // Hybrid
  } else {
    frameSize = [0.0025, 0.005, 0.01, 0.02][config % 4]; // CELT
  }

  const frameCount = code === 0
    ? 1
    : code === 1 || code === 2
    ? 2
    : packet[1] & 0b111111; // code 3: arbitrary count in the next byte

  return frameSize * frameCount;
}

///

const muxStream = async (
  id: number,
  output: Output,
) => {
  let meow = false;

  const streamPackets = packets.filter((packet) => packet.ssrc === id);
  streamPackets.sort((a, b) => a.sequence - b.sequence);
  const startRtpTimestamp = streamPackets[0].rtpTimestamp;
  // The muxed timeline is anchored to the first packet, so that packet's
  // `received` is where this stream starts within the recording as a whole.
  const startSecond = streamPackets[0].received / 1000;

  const packetSource = new EncodedAudioPacketSource("opus");
  output.addAudioTrack(packetSource);

  await output.start();

  for (const { data, rtpTimestamp } of streamPackets) {
    const packet = new EncodedPacket(
      data,
      "key",
      (rtpTimestamp - startRtpTimestamp) / 48000,
      opusPacketDuration(data),
    );

    await packetSource.add(
      packet,
      !meow
        ? {
          decoderConfig: {
            codec: "opus",
            numberOfChannels: 2,
            sampleRate: 48000,
            description: new Uint8Array([
              0x4f,
              0x70,
              0x75,
              0x73,
              0x48,
              0x65,
              0x61,
              0x64,
              0x01,
              0x02,
              0x00,
              0x00,
              0x80,
              0xbb,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
            ]),
          },
        }
        : undefined,
    );
  }

  packetSource.close();

  await output.finalize();

  return startSecond;
};

const transcribeStream = async (audio: Uint8Array, startSecond: number) => {
  const { text, segments, language } = await transcribe({
    model: mistral.transcription("voxtral-mini-latest"),
    audio,
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
const entries = decodeCborSequence(file) as YapEntry[];

const streams = entries.filter((entry) => entry.type === "stream");
const packets = entries.filter((entry) => entry.type === "packet");
const userStates = entries.filter((entry) => entry.type === "userState");

// Steps:
// - Get streams, process them one by one into .wav files.
// - Mix them into a single playable file
// - Upload individual streams to get transcripts
// - Mix transcripts together

const tracks = await Array.fromAsync(pooledMap(1, streams, async (stream) => {
  const output = new Output({
    format: new MkvOutputFormat(),
    target: new BufferTarget(),
  });

  const startSecond = await muxStream(stream.ssrc, output);

  const input = new Input({
    formats: [MATROSKA],
    source: new BufferSource(output.target.buffer!),
  });

  const sink = new AudioBufferSink((await input.getAudioTracks())[0]);
  // const wav = new Output({
  //   format: new WavOutputFormat(),
  //   target: new BufferTarget(),
  // });
  // const conversion = await Conversion.init({
  //   input,
  //   output: wav,
  // });
  // await conversion.execute();

  return {
    userId: stream.userId,
    start: startSecond,
    // buffer: wav.target.buffer!,
    sink,
  };
}));

{
  const ctx = new OfflineAudioContext({
    length: 48000 * 100,
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  for (const track of tracks) {
    for await (const buffer of track.sink.buffers()) {
      const source = ctx.createBufferSource();
      source.buffer = buffer.buffer;
      source.connect(ctx.destination);
      source.start(track.start + buffer.timestamp);
    }
  }

  const audioBuffer = await ctx.startRendering();

  const output = new Output({
    format: new MkvOutputFormat(),
    target: new FilePathTarget("lol.ogg"),
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
}

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
