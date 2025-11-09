import { Channel, Guild } from 'discord.js';
import client from './client';
import { ConnectionOptions } from 'bullmq';
import { ApplicationCommandOptionChoice } from 'slash-create';
import { Message } from 'discord.js';
import { ImagePart } from 'ai';

// Why? Because throw expressions don't exist yet. One can wish... https://github.com/tc39/proposal-throw-expressions
export const throwError = (message: string): never => {
  throw new Error(message);
};

export const enumStringsToChoice = (e: Map<number, string>): ApplicationCommandOptionChoice[] =>
  Array.from(e.entries())
    .sort((a, b) => a[0] - b[0])
    .map((e) => ({ name: e[1], value: e[0].toString() }));

export const getPrimaryGuild = (): Promise<Guild> =>
  client.guilds.fetch(process.env.PRIMARY_GUILD_ID!);

export const getAnnoucementsChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.ANNOUNCEMENTS_CHANNEL_ID!)) ??
  throwError('Announcements channel not found');

export const getUpdatesChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.UPDATES_CHANNEL_ID!)) ??
  throwError('Updates channel not found');

export const getGeneralChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.GENERAL_CHANNEL_ID!)) ??
  throwError('General channel not found');

export const getLoggingChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.LOGGING_CHANNEL_ID!)) ??
  throwError('Logging channel not found');

export const getRedisConnection = (): ConnectionOptions => ({
  host: process.env.REDIS_HOST!,
  port: (() => {
    const parsed = Number.parseInt(process.env.REDIS_PORT ?? '', 10);
    if (Number.isNaN(parsed)) {
      console.warn('REDIS_PORT is not a valid number; defaulting to 6379');
      console.warn(`Expected a number but got: ${process.env.REDIS_PORT}`);
      return 6379;
    }
    return parsed;
  })(),
  db: process.env.REDIS_DB ? Number.parseInt(process.env.REDIS_DB!, 10) : 0,
  password: process.env.REDIS_PASSWORD,
});

export const containsWord = (msg: Message, word: string): boolean => {
  const matches = msg.content.match(new RegExp(`\\b${word}\\b`, 'i'));
  return matches != null && matches.length > 0;
};

export const userURL = (id: string) => `https://discord.com/users/${id}`;

export class Image {
  private dataUri?: string;
  private dataUriPromise?: Promise<string>;

  public constructor(public readonly url: string) {}

  public static fromUrl(url: string): Image {
    return new Image(url);
  }

  private static inferMimeType(url: string): string | undefined {
    try {
      const { pathname } = new URL(url);
      const extension = pathname.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'png':
          return 'image/png';
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'gif':
          return 'image/gif';
        case 'webp':
          return 'image/webp';
        case 'svg':
          return 'image/svg+xml';
        case 'bmp':
          return 'image/bmp';
        case 'tiff':
        case 'tif':
          return 'image/tiff';
        default:
          return undefined;
      }
    } catch {
      return undefined;
    }
  }

  private static resolveMimeType(
    headerContentType: string | null | undefined,
    url: string,
  ): string {
    const candidates = [headerContentType?.split(';')[0]?.trim(), Image.inferMimeType(url)];

    for (const type of candidates) {
      if (!type) {
        continue;
      }
      const normalized = type.toLowerCase();
      if (normalized.startsWith('image/')) {
        return normalized;
      }
    }

    throw new Error(`Unsupported or missing image MIME type for URL: ${url}`);
  }

  /*
   * Downloads the image from the provided URL, caches it, and exposes a data URI.
   * Subsequent calls reuse the cached data URI or an in-flight fetch.
   * @return A promise that resolves to the cached data URI for the image
   */
  public async toBase64Data(): Promise<string> {
    if (this.dataUri) {
      return this.dataUri;
    }

    if (this.dataUriPromise) {
      return this.dataUriPromise;
    }

    const fetchPromise = (async () => {
      const response = await fetch(this.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${this.url}`);
      }

      const headerContentType = response.headers.get('content-type');
      const contentType = Image.resolveMimeType(headerContentType, this.url);
      const buffer = await response.arrayBuffer();
      const base64String = Buffer.from(buffer).toString('base64');
      return `data:${contentType};base64,${base64String}`;
    })();

    this.dataUriPromise = fetchPromise;

    try {
      const dataUri = await fetchPromise;
      this.dataUri = dataUri;
      return dataUri;
    } finally {
      this.dataUriPromise = undefined;
    }
  }

  public async toArrayBuffer(): Promise<ArrayBuffer> {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${this.url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  }
}
/*
  Converts an ImagePart with a URL to an ImagePart with a data URI by downloading the image.
  @param imgpart The ImagePart with a URL to convert
  @return A promise that resolves to a new ImagePart with a data URI
*/
export async function pullImagePart(imgpart: ImagePart): Promise<ImagePart> {
  const image = imgpart.image;
  if (!image.toString().startsWith('data:')) {
    console.debug({ message: 'Pulling image part', imgpart });
    // get data buffer from image URL
    const img = new Image(image.toString());
    const dataUri = await img.toBase64Data();
    return {
      type: 'image',
      image: new URL(dataUri),
      providerOptions: {
        // workersai: {
        //   image_url: dataUri,
        // },
      },
    } as ImagePart;
  } else {
    return imgpart;
  }
}
