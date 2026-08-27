import { EncodedAudioPacketSource, EncodedPacket, Output } from "mediabunny";
import { Stream } from "./decode.ts";
import { assert } from "@std/assert";

const OPUS_SILENCE_PACKET = new Uint8Array([
  0xF8,
  0xFF,
  0xFE,
]);

const OPUS_PACKET_META = {
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
};

export const muxStream = async (
  stream: Stream,
  output: Output,
) => {
  const packetSource = new EncodedAudioPacketSource("opus");
  output.addAudioTrack(packetSource);

  await output.start();

  const startRtpTimestamp = stream.packets[0].rtpTimestamp;
  let lastEnd = startRtpTimestamp;

  for (const { data, rtpTimestamp, duration } of stream.packets) {
    const numberOfSilencePackets = (rtpTimestamp - lastEnd) / 960;
    assert(
      numberOfSilencePackets >= 0,
      `Packets are out of order: ${rtpTimestamp} < ${lastEnd}`,
    );
    assert(
      Number.isInteger(numberOfSilencePackets),
      `Packets are not aligned: ${rtpTimestamp} - ${lastEnd} = ${numberOfSilencePackets}`,
    );

    for (let i = 0; i < numberOfSilencePackets; i++) {
      await packetSource.add(
        new EncodedPacket(
          OPUS_SILENCE_PACKET,
          "key",
          (lastEnd + i * 960 - startRtpTimestamp) / 48000,
          960 / 48000,
        ),
        OPUS_PACKET_META,
      );
    }
    lastEnd = rtpTimestamp + duration;

    const packet = new EncodedPacket(
      data,
      "key",
      (rtpTimestamp - startRtpTimestamp) / 48000,
      duration / 48000,
    );

    await packetSource.add(
      packet,
      OPUS_PACKET_META,
    );
  }

  packetSource.close();

  await output.finalize();
};
