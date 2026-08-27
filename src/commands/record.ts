import {
  AudioPacket,
  EndBehaviorType,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { CommandContext, SlashCommand, SlashCreator } from "slash-create";
import client from "../client.ts";
import { client as prismaClient } from "../prisma.ts";

import { decodeYapEntries, Packet } from "../yap/decode.ts";
import { CborSequenceEncoderStream, decodeCborSequence } from "@std/cbor";
import { Guild, VoiceState } from "discord.js";
import { CommandOptionType } from "slash-create/web";
import { YapEntry } from "../yap/entry.ts";
import { bucket, s3 } from "../s3.ts";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import * as path from "@std/path";
import { pooledMap } from "@std/async";
import {
  AudioBufferSink,
  AudioBufferSource,
  FilePathSource,
  FilePathTarget,
  Input,
  MATROSKA,
  MkvOutputFormat,
  Output,
  Quality,
} from "mediabunny";
import { muxStream } from "../yap/processing.ts";
import { transcribe } from "ai";
import { mistral, MistralTranscriptionModelOptions } from "@ai-sdk/mistral";
import { toFileUrl } from "@std/path/windows";
import { recordingQueue } from "../scheduler.ts";

export const handleRecordingEvent = async (
  recordingId: number,
) => {
  const recording = await prismaClient.recording.findUnique({
    where: {
      id: recordingId,
    },
  });
  if (!recording) return;

  const workdir = await Deno.makeTempDir();

  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: `recordings/${recording.storageID}/recording.yap.gz`,
    }),
  );

  const yap = decodeYapEntries(
    decodeCborSequence(
      await new Response(
        res.Body!.transformToWebStream().pipeThrough(
          new DecompressionStream("gzip"),
        ),
      ).bytes(),
    ) as YapEntry[],
  );

  const streams = await Array.fromAsync(
    pooledMap(1, yap.streams, async (stream) => {
      const audioFile = path.join(workdir, `output-${stream.ssrc}.mka`);

      const output = new Output({
        format: new MkvOutputFormat({
          appendOnly: true,
        }),
        target: new FilePathTarget(
          audioFile,
        ),
      });

      await muxStream(stream, output);

      const { segments } = await transcribe({
        model: mistral.transcription("voxtral-mini-latest"),
        audio: await Deno.readFile(audioFile),
        providerOptions: {
          mistral: {
            timestampGranularities: ["segment"],
          } satisfies MistralTranscriptionModelOptions,
        },
      });

      return {
        segments: segments.map((segment) => ({
          ...segment,
          startSecond: segment.startSecond + stream.received / 1000,
          endSecond: segment.endSecond + stream.received / 1000,
        })),
      };
    }),
  );

  const transcript = streams.flatMap((stream) => stream.segments);
  transcript.sort((a, b) => a.startSecond - b.startSecond);

  console.log(transcript);

  // {
  //   const ctx = new OfflineAudioContext({
  //     length: 48000 * yap.streams.reduce((max, stream) =>
  //       Math.max(
  //         max,
  //         stream.received +
  //           ((stream.packets.at(-1)!.rtpTimestamp +
  //             stream.packets.at(-1)!.duration -
  //             stream.packets[0].rtpTimestamp) / 48000),
  //       ), 0),
  //     sampleRate: 48000,
  //     numberOfChannels: 2,
  //   });

  //   for (const stream of yap.streams) {
  //     const input = new Input({
  //       formats: [MATROSKA],
  //       source: new FilePathSource(`output-${stream.ssrc}.mka`),
  //     });
  //     const bufferSink = new AudioBufferSink((await input.getAudioTracks())[0]);

  //     for await (const buffer of bufferSink.buffers()) {
  //       const source = ctx.createBufferSource();
  //       source.buffer = buffer.buffer;
  //       source.connect(ctx.destination);
  //       source.start(stream.received / 1000 + buffer.timestamp); // weird offset issue
  //     }
  //   }

  //   const audioBuffer = await ctx.startRendering();

  //   const output = new Output({
  //     format: new MkvOutputFormat(),
  //     target: new FilePathTarget("lol.mka"),
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
};

class Recorder {
  private connection: VoiceConnection | null = null;
  private writer: WritableStreamDefaultWriter<YapEntry> | null = null;
  private startTimestamp: number | null = null;

  public fileName: string | null = null;

  private userSet = new Set();
  private ssrcSet = new Set();

  constructor(private guild: Guild, private channelId: string) {}

  private handleSpeakingStart = async (userId: string) => {
    if (this.userSet.has(userId)) {
      return;
    }

    this.userSet.add(userId);

    const stream = this.connection!.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.Manual,
      },
    });

    stream.on("data", async (packet: AudioPacket) => {
      if (!this.ssrcSet.has(packet.ssrc)) {
        await this.writer!.write(
          {
            type: "stream",
            ssrc: packet.ssrc,
            userId,
          },
        );
        this.ssrcSet.add(packet.ssrc);
      }

      await this.writer!.write(
        {
          type: "packet",
          ssrc: packet.ssrc,
          sequence: packet.sequence,
          data: packet.payload,
          rtpTimestamp: packet.timestamp,
          received: performance.timeOrigin + performance.now() -
            this.startTimestamp!,
        },
      );
    });
  };

  private handleVoiceStateUpdate = async (
    oldState: VoiceState,
    newState: VoiceState,
  ) => {
    if (
      oldState.guild.id !== this.guild.id ||
      newState.guild.id !== this.guild.id ||
      oldState.channelId !== this.channelId &&
        newState.channelId !== this.channelId
    ) {
      return;
    }

    if (
      oldState.channelId !== newState.channelId
    ) {
      await this.writer!.write(
        {
          type: "userState",
          userId: newState.id,
          received: performance.timeOrigin + performance.now() -
            this.startTimestamp!,
          key: "joined",
          value: newState.channelId === this.channelId,
        },
      );
    }

    if (oldState.mute !== newState.mute) {
      await this.writer!.write(
        {
          type: "userState",
          userId: newState.id,
          received: performance.timeOrigin + performance.now() -
            this.startTimestamp!,
          key: "muted",
          value: newState.mute ?? false,
        },
      );
    }

    if (oldState.deaf !== newState.deaf) {
      await this.writer!.write(
        {
          type: "userState",
          userId: newState.id,
          received: performance.timeOrigin + performance.now() -
            this.startTimestamp!,
          key: "deafened",
          value: newState.deaf ?? false,
        },
      );
    }
  };

  async start() {
    this.connection = joinVoiceChannel({
      adapterCreator: this.guild.voiceAdapterCreator,
      guildId: this.guild.id,
      channelId: this.channelId,
      selfDeaf: false,
      selfMute: true,
    });

    this.startTimestamp = performance.timeOrigin + performance.now();
    this.fileName = await Deno.makeTempFile();
    const file = await Deno.create(this.fileName);
    const stream = new CborSequenceEncoderStream();
    this.writer = stream.writable.getWriter();

    stream.readable.pipeTo(file.writable);

    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);

    await this.writer.write(
      {
        type: "header",
        version: 0,
        timestamp: this.startTimestamp,
      },
    );

    this.connection.receiver.speaking.on("start", this.handleSpeakingStart);
    client.on("voiceStateUpdate", this.handleVoiceStateUpdate);
  }

  async stop() {
    if (this.connection) {
      client.off("voiceStateUpdate", this.handleVoiceStateUpdate);
      this.connection.receiver.speaking.off(
        "start",
        this.handleSpeakingStart,
      );
      await this.writer?.close();
      this.connection.disconnect();
      this.connection.destroy();
      this.connection = null;
    }
  }
}

export default class RecordCommand extends SlashCommand {
  /// A map of guild IDs to their respective recorders.
  /// No, you cannot have multiple recorders per guild, because Discord doesn't allow multiple voice connections per guild.
  recorders: Record<string, Recorder> = {};

  public constructor(creator: SlashCreator) {
    super(creator, {
      name: "record",
      description: "A voice recorder",
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "start",
          description: "Start",
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "stop",
          description: "Stop",
        },
      ],
    });
  }

  public override async run(ctx: CommandContext): Promise<void> {
    switch (ctx.subcommands[0]) {
      case "start": {
        const guild = await client.guilds.fetch(ctx.guildID!);
        const member = await guild.members.fetch(ctx.member!.id);
        const currentVoiceChannel = member.voice.channelId;
        if (!currentVoiceChannel) {
          await ctx.sendFollowUp(
            "You need to be in a voice channel, silly cat~",
          );
          return;
        }

        if (this.recorders[guild.id]) {
          await ctx.sendFollowUp(
            "NYA! I'm already recording~ If you want to start a new recording, stop the current one first >.<",
          );
          return;
        }

        const recorder = new Recorder(guild, currentVoiceChannel);
        this.recorders[guild.id] = recorder;
        recorder.start();

        await ctx.sendFollowUp("Listening in~ ^_^");
        break;
      }
      case "stop": {
        if (!this.recorders[ctx.guildID!]) {
          await ctx.sendFollowUp(
            "I can't stop recording if I'm not recording (o_O)?",
          );
          return;
        }

        const fileName = this.recorders[ctx.guildID!].fileName!;
        await this.recorders[ctx.guildID!].stop();
        delete this.recorders[ctx.guildID!];

        const file = await Deno.open(fileName, {
          read: true,
        });

        const reader = file.readable.pipeThrough(new CompressionStream("gzip"));

        const storageId = crypto.randomUUID();

        await new Upload({
          client: s3,
          params: {
            Bucket: bucket,
            Key: `recordings/${storageId}/recording.yap.gz`,
            Body: reader,
            ContentType: "application/cbor-seq",
          },
        }).done();

        await Deno.remove(fileName);

        const { id } = await prismaClient.recording.create({
          data: {
            storageID: storageId,
            userID: "",
          },
        });

        await recordingQueue.add("recording", { id });

        await ctx.sendFollowUp("Goodbye~ (o_o)/");
        break;
      }
    }
  }
}
