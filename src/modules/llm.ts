import client from '../client';
import { Events, Message } from 'discord.js';
import OpenAI from 'openai';

const model = '@cf/openai/gpt-oss-120b';
const responses_api = true;

const DEFAULT_SYSTEM_PROMPT = `
You are Raboneko, an experimental AI agent developed by Fyra Labs as a  successor to the original Raboneko, nya~!

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
`;

const llm = new OpenAI({
  apiKey: process.env.CLOUDFLARE_API_KEY,
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
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
      content: `${msg_content}`,
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
        if (responses_api) {
            let response = await llm.responses.create({
                model: model,
                instructions: DEFAULT_SYSTEM_PROMPT,
                input: history,
            });

            console.debug(response);

            replyText = response.output_text;
        } else {
            let response = await llm.chat.completions.create({
                model: model,
                messages: messages,
            });

            console.debug(response);
            replyText = response.choices[0].message.content!;
        }

        await message.reply(
            replyText?.trim().slice(0, 2000) ?? "Nya... I couldn't think of a response... >_<",
        );
    } catch (error) {
        console.error('oh shit!', error);
    }
}

// client.on(Events.MessageCreate, async (message) => {
//   if (message.author.id === message.client.user.id) return;
//   const me = client.user?.id;
//   if (!me || !message.mentions.has(me)) {
//     return;
//   }
//   const authorName = message.author;
//   const userMessage = message.cleanContent;
//   console.log(`User message: ${userMessage}`);
//   console.debug(`Author: ${authorName.tag} (${authorName.id})`);

//   await LLMResponse(message);
// });
