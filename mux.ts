import { registerMediabunnyServer } from "@mediabunny/server";
registerMediabunnyServer();

import {
  ALL_FORMATS,
  BufferSource,
  BufferTarget,
  Conversion,
  EncodedAudioPacketSource,
  EncodedPacket,
  FilePathTarget,
  Input,
  Output,
  WavOutputFormat,
  WebMOutputFormat,
} from "mediabunny";

import { decodeCborSequence } from "@std/cbor";
import { YapEntry } from "./src/yap.ts";

const file = await Deno.readFile("recording.yap");
const entries = decodeCborSequence(file) as YapEntry[];

const streams = entries.filter((entry) => entry.type === "stream");
const packets = entries.filter((entry) => entry.type === "packet");
const userStates = entries.filter((entry) => entry.type === "userState");
console.log(userStates);

const muxStream = async (
  id: number,
  output: Output,
) => {
  let meow = false;

  const streamPackets = packets.filter((packet) => packet.ssrc === id);
  streamPackets.sort((a, b) => a.sequence - b.sequence);
  const startRtpTimestamp = streamPackets[0].rtpTimestamp;

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
};

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

for (const [i, stream] of streams.entries()) {
  const output = new Output({
    format: new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  await muxStream(stream.ssrc, output);

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BufferSource(output.target.buffer!),
  });
  const wav = new Output({
    format: new WavOutputFormat(),
    target: new FilePathTarget(`output-${i}.wav`),
  });
  const conversion = await Conversion.init({ input, output: wav });
  await conversion.execute();
}
