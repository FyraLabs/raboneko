import client from '../client';
import { Events, Message } from 'discord.js';
import OpenAI from 'openai';

import { createWorkersAI } from 'workers-ai-provider';
import { generateText } from 'ai';
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
  // gateway: AiGateway,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
});

const model = '@cf/openai/gpt-oss-120b';
const responses_api = true;
const workersModel = WorkersAI(model);

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

const host = 'https://gateway.ai.cloudflare.com';
const endpoint = `/v1/${process.env.CLOUDFLARE_ACCOUNT_ID}/${process.env.CLOUDFLARE_AI_GATEWAY_ID}/workers-ai/v1`;
const llm = new OpenAI({
  defaultHeaders: {
    // Used for Cloudflare API Gateway authentication
    'cf-aig-authorization': process.env.CLOUDFLARE_API_KEY,
  },
  apiKey: process.env.CLOUDFLARE_API_KEY,
  baseURL: host + endpoint,
});

function systemPrompt() {
  return { role: 'system' as const, content: DEFAULT_SYSTEM_PROMPT };
}
// recursively resolve a Discord reply thread, and return it as an OpenAI thread

async function buildMessageHistory(message: Message, maxDepth = 10) {
  const history: Array<{ role: 'user' | 'assistant'; content: string; username: string }> = [];
  let currentMessage = message;
  let depth = 0;
  while (currentMessage && depth < maxDepth) {
    const author = currentMessage.author;
    const me = client.user?.id;
    const username = author.displayName || author.username;
    // history.unshift({
    //   author: isBot ? "rabo" : username,
    //   content: currentMessage.content,
    //   isBot: isBot,
    // });
    const msg_content = currentMessage.cleanContent;
    history.unshift({
      role: author.id === me ? 'assistant' : 'user',
      username: username,
      content: msg_content,
    });

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

  console.debug(history);

  return history;
}

export async function LLMResponse(message: Message) {
  const history = await buildMessageHistory(message);
  const messages = [
    systemPrompt(),
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
  ];
  // await console.log(history);

  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping();
  }
  //   await message.reply('This feature is coming soon! Nya~ :3');
  try {
    var replyText = '';

    const response = await generateText({
      model: workersModel,
      system: DEFAULT_SYSTEM_PROMPT,
      messages: messages,
    });

    console.trace('LLM response:', response);
    console.debug('LLM response text:', response.content);

    replyText = response.text;

    await message.reply(
      replyText?.trim().slice(0, 2000) ?? "Nya... I couldn't think of a response... >_<",
    );
  } catch (error) {
    console.error('Raboneko LLM error:', error);
    await message.reply(
      `Nya... I couldn't think of a response... >_<\n-# Error: ${(error as Error).message}`,
    );
  }
}
