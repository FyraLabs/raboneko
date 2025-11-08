import client from '../client';
import { Message } from 'discord.js';
import { Experimental_Agent as Agent } from 'ai';
import { AzureOpenAIProviderSettings, createAzure } from '@ai-sdk/azure';
import { Image, pullImagePart } from '../util';
import { createWorkersAI } from 'workers-ai-provider';
import { ImagePart, ModelMessage, TextPart } from 'ai';
import { createAiGateway } from 'ai-gateway-provider';
import { toolSet } from '../llm_tools/tools';
import type { DiscordToolContext } from '../llm_tools/tools';
import { trace } from '@opentelemetry/api';
import { systemPrompt } from '../prompt';
import { OpenAIResponsesProviderOptions } from '@ai-sdk/openai';

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

const azure = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME!,
  apiKey: process.env.AZURE_API_KEY!,
});

const default_model = 'gpt-5';
const model = () => {
  const modelName = process.env.AZURE_AI_MODEL || default_model;
  if (process.env.AZURE_AI_MODEL) {
    console.log({ message: 'Using Azure AI model', modelName });
  }
  return modelName;
};

const prepend_system_prompt = process.env.RABONEKO_PREPEND_SYSTEM_PROMPT === 'true' || false;

// const model = '@cf/meta/llama-4-scout-17b-16e-instruct';
// TODO:  provider "workersai.chat" is currently not supported
// const workersModel = AiGateway(WorkersAI(model));

const azureModel = azure.responses(model());

const baseTools = toolSet();

const tracer = trace.getTracer('raboneko.llm');
function createAgentWithContext(context: DiscordToolContext) {
  const currentModel = model();
  return new Agent({
    experimental_telemetry: {
      isEnabled: true,
      tracer,
      metadata: {
        'llm.provider': 'azure',
        'llm.model': currentModel,
      },
    },
    model: azureModel,
    maxOutputTokens: 2000,
    system: systemPrompt().content,
    tools: baseTools,
    experimental_context: context,
  });
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

      const messageContent = `${username}: ${currentMessage.cleanContent}`;

      if (currentMessage.content.trim().length > 0) {
        userContent.push({
          type: 'text',
          providerOptions: {},
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
        console.log({ message: 'Could not fetch referenced message', error });
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
      ...(prepend_system_prompt ? [systemPrompt()] : []),
      ...(await Promise.all(
        history.map(async (msg) => {
          if (msg.role === 'user') {
            const userMsg = msg.content as Array<TextPart | ImagePart>;
            const newContent: Array<TextPart | ImagePart> = [];
            if (userMsg.find((part) => part.type === 'image')) {
              console.debug({ message: 'Processing user message with images', userMsg });
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
    const discordContext: DiscordToolContext = {
      channelId: message.channelId,
      userId: message.author.id,
      guildId: message.guildId ?? undefined,
      messageId: message.id,
    };

    const agent = createAgentWithContext(discordContext);

    console.log({
      message: 'Dispatching Raboneko agent',
      userId: discordContext.userId,
      channelId: discordContext.channelId,
      tools: Object.keys(agent.tools),
    });

    const response = await agent.generate({
      providerOptions: {
        openai: {
          promptCacheKey: `discord-chat-${message.channelId}`,
          textVerbosity: 'low',
          user: `${message.author.tag}:${message.author.id}`,
          store: true,
          instructions:
            'You are chatting in a Discord channel. Keep responses concise and relevant to the conversation.',
          parallelToolCalls: true,
          metadata: {
            'discord.channel_id': message.channelId,
            'discord.guild_id': message.guildId,
            'discord.message_id': message.id,
          },
          // todo: store previousResponseId for better threading?
        } satisfies OpenAIResponsesProviderOptions,
      },
      messages,
    });

    // return new Response(response.text)

    console.debug({
      message: 'LLM response debug',
      responseText: response.text,
      toolCalls: response.toolCalls,
      toolResults: response.toolResults,
      steps: response.steps?.length || 0,
      finishReason: response.finishReason,
    });

    replyText = response.text;
    if (response.finishReason === 'content-filter') {
      replyText += '\n\n-# this response got filtered out by the upstream content filters >_<';
    }

    // If there were tool calls, append their results to the response
    if (response.toolResults && response.toolResults.length > 0) {
      for (const toolResult of response.toolResults) {
        console.debug({ message: 'Tool result', toolResult });
        if (toolResult.output && typeof toolResult.output === 'object') {
          const result = toolResult.output as any;
          if (result.success && result.message) {
            // If there's no text response, use just the tool message
            // Otherwise append it
            if (!replyText || replyText.trim().length === 0) {
              replyText = `okie dokie! ${result.message}`;
            } else {
              replyText += `\n\n${result.message}`;
            }
          } else if (!result.success && result.error) {
            if (!replyText || replyText.trim().length === 0) {
              replyText = `nya... there was an error: ${result.error}`;
            } else {
              replyText += `\n\nnya... there was an error: ${result.error}`;
            }
          }
        }
      }
    }

    await message.reply({
      content: replyText?.trim().slice(0, 2000) ?? "Nya... I couldn't think of a response... >_<",
      allowedMentions: { repliedUser: true, users: [message.author.id] },
    });
  } catch (error) {
    console.error('Raboneko LLM error:', error);
    await message.reply(
      `Nya... I couldn't think of a response... >_<\n-# Error: ${(error as Error).message}`,
    );
  }
}
