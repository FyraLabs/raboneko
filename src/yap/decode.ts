/// While a yap file is just a cbor sequence of entries you can parse and use immedately, for most uses, you probably want to decode them for ease of use.
/// Right now decoding just means running through the file and indexing packets by their respective userIds, and unwrapping packet sequences and timestamps; then massaging the data into a nice format.

import { assert } from "@std/assert";
import { YapEntry } from "./entry.ts";

/// A packet contains raw Opus audio data and associated metadata.
export type Packet = {
  /// The sequence of the audio packet. This is an unwrapped version of the rawSequence suitable for most applications.
  sequence: number;
  /// The raw sequence of the audio packet, as seen in the RTP packet. This is a value wrapped by the sender, you probably want sequence.
  rawSequence: number;
  /// The RTP timestamp of the audio packet. This is an unwrapped version of the rawRtpTimestamp suitable for most applications.
  rtpTimestamp: number;
  /// The raw RTP timestamp of the audio packet, as seen in the RTP packet. This is a value wrapped by the sender, you probably want rtpTimestamp.
  rawRtpTimestamp: number;
  /// The timestamp in milliseconds of when this packet was received by the recorder, relative to the start timestamp.
  received: number;
  /// The duration of this packet in samples, as determined by the Opus packet header.
  duration: number;
  /// The raw Opus audio data.
  data: Uint8Array;
};

/// A stream contains audio packets from a specific user within a recording.
/// Throughout a session, a user may have multiple streams, think if the user reconnects.
export type Stream = {
  /// The Discord user ID associated with this stream.
  userId: string;
  /// The RTP ssrc indentifying this stream. You can think of this as the stream ID.
  ssrc: number;
  /// The packets in this stream, sorted by their sequence.
  packets: Packet[];
};

/// A state update represents when a particular user performs an action like: leaving, joining, muting, deafening, etc...
export type UserStateUpdate = {
  /// The Discord user ID.
  userId: string;
  /// The timestamp in milliseconds of when this state change was observed by the recorder, relative to the start timestamp.
  received: number;
  /// The "key" of the state that is being updated. They're pretty self-explanitory.
  key: "muted" | "deafened" | "joined";
  /// The new value for the key. Right now all of the key are booleans, there's no half-way muted :p
  value: boolean;
};

/// The result of decoding the entries in a yap file. For most applications, this should be easier to consume.
export type DecodedYap = {
  /// The starting timestamp for the recording in milliseconds, useful for cataloguing and as the base for the other timestamps.
  startTimestamp: number;
  /// The streams in this recording.
  streams: Stream[];
  /// The user state updates in this recording.
  userStateUpdates: UserStateUpdate[];
};

const diff16 = (a: number, b: number) => ((a - b) << 16) >> 16;
const diff32 = (a: number, b: number) => (a - b) | 0;

// Frame size as 48k samples per configuration
const silk = [480, 960, 1920, 2880];
const hybrid = [480, 960];
const celt = [120, 240, 480, 960];

function opusPacketDuration(packet: Uint8Array): number {
  const toc = packet[0];
  const config = toc >> 3;
  const code = toc & 0b11;

  const frameSize = config < 12
    ? silk[config % 4]
    : config < 16
    ? hybrid[config % 2]
    : celt[config % 4];

  const frameCount = code === 0
    ? 1
    : code === 1 || code === 2
    ? 2
    : packet[1] & 0b111111; // code 3: arbitrary count in the next byte

  return frameSize * frameCount;
}

export const decodeYapEntries = (entries: YapEntry[]): DecodedYap => {
  const header = entries[0];
  assert(header.type === "header", "first entry in sequence must be a header");

  const decoded: DecodedYap = {
    startTimestamp: header.timestamp,
    streams: [],
    userStateUpdates: [],
  };

  const ssrcToStream: Record<number, Stream> = {};

  for (const entry of entries) {
    switch (entry.type) {
      case "stream": {
        const stream = {
          ssrc: entry.ssrc,
          userId: entry.userId,
          packets: [],
        };

        decoded.streams.push(stream);
        ssrcToStream[stream.ssrc] = stream;
        break;
      }
      case "packet": {
        const stream = ssrcToStream[entry.ssrc];
        const previousPacket = stream.packets.at(-1);

        const sequence = previousPacket
          ? previousPacket.sequence +
            diff16(entry.sequence, previousPacket.rawSequence)
          : entry.sequence;
        const rtpTimestamp = previousPacket
          ? previousPacket.rtpTimestamp +
            diff32(entry.rtpTimestamp, previousPacket.rawRtpTimestamp)
          : entry.rtpTimestamp;

        stream.packets.push({
          data: entry.data,
          received: entry.received,
          rawSequence: entry.sequence,
          rawRtpTimestamp: entry.rtpTimestamp,
          duration: opusPacketDuration(entry.data),
          sequence,
          rtpTimestamp,
        });
        break;
      }
      case "userState": {
        decoded.userStateUpdates.push({
          key: entry.key,
          received: entry.received,
          userId: entry.userId,
          value: entry.value,
        });
        break;
      }
    }
  }

  decoded.streams.forEach((stream) =>
    stream.packets.sort((a, b) => a.sequence - b.sequence)
  );

  return decoded;
};
