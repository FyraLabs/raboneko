// Types and utiltiies to work with yap files, Raboneko's append-only format for recording Discord call audio and user events.

/// A yap file is a log of user events and audio packets from the recording of a Discord call.
/// It is a CBOR sequence of the following entries, always starting with a header entry.
export type YapEntry = {
  /// The first entry in the file.
  type: "header";
  /// The version of the yap format we're on.
  version: 0;
  /// The starting timestamp for the recording, useful for cataloguing and as the base for the other timestamps.
  timestamp: number;
} | {
  /// Basically this creates an association between the RTP ssrc and the Discord user ID.
  /// This is useful so you know what packet came from what user, plus it's a lot more compact than a user ID in each packet.
  type: "stream";
  /// You can think of this as the stream ID, which while associated with a user is not 1 to 1.
  /// This means a user can have multiple ssrcs/streams within a call, think if the user reconnects.
  ssrc: number;
  /// The Discord user ID associated with this stream.
  userId: string;
} | {
  /// An audio packet. Yeah.
  type: "packet";
  /// The RTP ssrc, which you can think of as the stream ID. You can match this against a stream entry.
  ssrc: number;
  /// The sequence of the audio packet.
  /// In RTP, packets can be received out of order, so you can use this to reorder packets in post-processing.
  sequence: number;
  /// The RTP timestamp, which is not an unix timestamp or an otherwise absolute timestamp.
  /// It's relative to the stream itself and that's it. Not to the user, the stream as indicated by the ssrc.
  rtpTimestamp: number;
  /// The timestamp in milliseconds of when this packet was received by the recorder, relative to the start timestamp in the header entry.
  /// A nice to have in case we need it in the future. Not really that useful at the moment though.
  received: number;
  /// The raw Opus audio data.
  data: Uint8Array;
} | {
  /// An entry indicating a change in the user's state within a recording.
  type: "userState";
  /// The Discord user ID.
  userId: string;
  /// The timestamp in milliseconds of when this state change was observed by the recorder, relative to the start timestamp in the header entry.
  received: number;
  /// The "key" of the state that is being updated. They're pretty self-explanitory.
  key: "muted" | "deafened" | "joined";
  /// The new value for the key. Right now all of the key are booleans, there's no half-way muted :p
  value: boolean;
};
