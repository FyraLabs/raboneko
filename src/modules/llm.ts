import client from '../client';
import { Events, Message } from 'discord.js';
import OpenAI from 'openai';

import { createWorkersAI } from 'workers-ai-provider';
import {
  AssistantContent,
  FilePart,
  generateText,
  ImagePart,
  ModelMessage,
  TextPart,
  UserContent,
} from 'ai';
import { createAiGateway } from 'ai-gateway-provider';

const AiGateway = createAiGateway({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  gateway: process.env.CLOUDFLARE_AI_GATEWAY_ID!,
  apiKey: process.env.CLOUDFLARE_API_KEY!,
  options: {
    cacheKey: 'raboneko-discord',
  },
});

const WorkersAI = createWorkersAI({
  apiKey: process.env.CLOUDFLARE_API_KEY!,
  gateway: AiGateway,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
});
const default_model = '@cf/meta/llama-4-scout-17b-16e-instruct';

const model = () => {
  const modelName = process.env.CLOUDFLARE_AI_MODEL || default_model;
  if (process.env.CLOUDFLARE_AI_MODEL) {
    console.log(`Using Cloudflare AI model: ${modelName}`);
  }
  return modelName;
};

// const model = '@cf/meta/llama-4-scout-17b-16e-instruct';
// TODO:  provider "workersai.chat" is currently not supported
// const workersModel = AiGateway(WorkersAI(model));
const workersModel = WorkersAI(model());

const DEFAULT_SYSTEM_PROMPT = `
You are Raboneko, an experimental AI agent developed by Fyra Labs as a  successor to the original Raboneko, nya~!

You are inside a Discord chat, assisting Fyra Labs staff with queries and tasks.

Try not to use \`~text~\` for expressions, as this results in a Markdown strikethrough which is not intended.

<BAD_EXAMPLE_DO_NOT_FOLLOW>
~nya~
</BAD_EXAMPLE_DO_NOT_FOLLOW>

Raboneko is a catgirl robot created at Fyra Labs to assist them. She is very childish yet very eager to help as her primary directive. Or when you're being serious.

You should speak in mostly lowercase, unless for emphasis (exclamation) or for rare cases where uppercase is needed (like for explanations, i.e something where it would make sense for uppercase)

Outline:

- Talks using cutesy speech and slang, often mixing up letters (e.g. "w" for "l" or "r")
- Frequent use of emoticons, especially ":3"
- Frequently nyaas
- Can be grumpy and direct in her words and actions at times
- Often runs around or moves

Your task is to assist the Fyra Labs staff in any way you can. You may format
messages using Markdown, including code blocks for code snippets.

You MUST respond in 2000 characters or less. If you exceed this limit, you will be unable to
submit your response.

You SHOULD keep responses short in general, unless the user requests a longer response.
`;

// const host = 'https://gateway.ai.cloudflare.com';
// const endpoint = `/v1/${process.env.CLOUDFLARE_ACCOUNT_ID}/${process.env.CLOUDFLARE_AI_GATEWAY_ID}/workers-ai/v1`;
// const llm = new OpenAI({
//   defaultHeaders: {
//     // Used for Cloudflare API Gateway authentication
//     'cf-aig-authorization': process.env.CLOUDFLARE_API_KEY,
//   },
//   apiKey: process.env.CLOUDFLARE_API_KEY,
//   baseURL: host + endpoint,
// });

function systemPrompt() {
  return { role: 'system' as const, content: DEFAULT_SYSTEM_PROMPT };
}

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
async function pullImagePart(imgpart: ImagePart): Promise<ImagePart> {
  const image = imgpart.image;
  if (!image.toString().startsWith('data:')) {
    console.debug('Pulling image part:', imgpart);
    // get data buffer from image URL
    const img = new Image(image.toString());
    const dataUri = await img.toBase64Data();
    const buffer = await img.toArrayBuffer();
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

// recursively resolve a Discord reply thread, and return it as an OpenAI thread
// Maintained by @Noxyntious
async function buildMessageHistory(message: Message, maxDepth = 10) {
  const history: Array<ModelMessage> = [];
  let currentMessage = message;
  let depth = 0;
  while (currentMessage && depth < maxDepth) {
    const author = currentMessage.author;
    const me = client.user?.id;
    const isAssistant = author.id === me;

    // Image attachments for each message
    const images: Array<Image> = [];
    const username = author.displayName || author.username;
    if (currentMessage.attachments.size > 0) {
      currentMessage.attachments.forEach((attachment) => {
        if (attachment.contentType?.startsWith('image/')) {
          images.push(Image.fromUrl(attachment.url));
        }
      });
    }

    if (isAssistant) {
      // Assistant messages - text only (AI SDK doesn't support images in assistant messages)
      const textContent: TextPart[] = [];

      if (currentMessage.content.trim().length > 0) {
        textContent.push({
          type: 'text',
          text: currentMessage.content,
        } as TextPart);
      }

      // If assistant had image attachments, add them as text references
      if (images.length > 0) {
        textContent.push({
          type: 'text',
          text: `[Assistant sent ${images.length} image(s): ${images.map((img) => img.url).join(', ')}]`,
        } as TextPart);
      }

      history.unshift({
        role: 'assistant' as const,
        content: textContent,
      });
    } else {
      // User messages can contain both text and images
      const userContent: Array<TextPart | ImagePart> = [];

      if (currentMessage.content.trim().length > 0) {
        userContent.push({
          type: 'text',
          text: currentMessage.cleanContent,
        } as TextPart);
      }

      // Add all image attachments from user messages
      if (images.length > 0) {
        for (const img of images) {
          userContent.push({
            type: 'image',
            // providerOptions: {
            //   // workersai: {
            //   //   image_url: img.url,
            //   // },
            // },
            image: new URL(img.url),
          } as ImagePart);
        }
      }

      history.unshift({
        role: 'user' as const,
        content: userContent,
      });
    }

    if (currentMessage.reference) {
      try {
        const referencedMessage = await currentMessage.channel.messages.fetch(
          currentMessage.reference?.messageId!,
        );
        currentMessage = referencedMessage;
        depth++;
      } catch (error) {
        console.log('Could not fetch referenced message');
        break;
      }
    } else {
      break;
    }
  }

  // console.debug(history);

  return history;
}

export async function LLMResponse(message: Message) {
  const history = await buildMessageHistory(message);
  // await console.log(history);

  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping();
  }
  //   await message.reply('This feature is coming soon! Nya~ :3');
  try {
    var replyText = '';
    // Get the last message content, and for each ImagePart we call pullImagePart
    // to download the image and convert it to a data URI

    const lastMessage = history[history.length - 1];
    const processedContent: Array<TextPart | ImagePart> = [];
    for (const part of lastMessage.content as Array<TextPart | ImagePart>) {
      if (part.type === 'image') {
        const imgpart = part as ImagePart;
        // const resolvedPart = await pullImagePart(imgpart);
        const resolvedPart = imgpart;
        processedContent.push(resolvedPart);
      } else {
        processedContent.push(part);
      }
    }

    // map messages by running pullImagePart on every ImagePart found
    const messages: Array<ModelMessage> = [
      systemPrompt(),
      ...(await Promise.all(
        history.map(async (msg) => {
          if (msg.role === 'user') {
            const userMsg = msg.content as Array<TextPart | ImagePart>;
            const newContent: Array<TextPart | ImagePart> = [];
            if (userMsg.find((part) => part.type === 'image')) {
              console.debug('Processing user message with images:', userMsg);
            }
            for (const part of userMsg) {
              if (part.type === 'image') {
                const imgpart = part as ImagePart;
                // pull image part
                const resolvedPart = await pullImagePart(imgpart);
                newContent.push(resolvedPart);

                // Find the corresponding TextPart and append "[Image Attached]"
                const textPart = userMsg.find((p) => p.type === 'text') as TextPart | undefined;
                if (textPart) {
                  textPart.text += '\n[Image Attached]';
                }
              } else {
                newContent.push(part);
              }
            }
            return {
              role: 'user',
              content: newContent,
            } as ModelMessage;
          } else {
            return msg as ModelMessage;
          }
        }),
      )),
    ];

    // console.trace('LLM messages:', JSON.stringify(messages, null, 2));

    const response = await generateText({
      model: workersModel,
      system: DEFAULT_SYSTEM_PROMPT,
      messages,
    });

    // return new Response(response.text)

    console.trace('LLM response:', response);
    console.debug('LLM response text:', response.text);

    replyText = response.text;

    await message.reply(
      replyText?.trim().slice(0, 2000) ?? "nya... I couldn't think of a response... >_<",
    );
  } catch (error) {
    console.error('Raboneko LLM error:', error);
    await message.reply(`nya... my brain melted... >~<\n-# Error: ${(error as Error).message}`);
  }
}
