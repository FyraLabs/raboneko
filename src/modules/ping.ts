import client from '../client';
import { Events, Message } from 'discord.js';
import { LLMResponse } from './llm';

const LLMRole = process.env.LLM_ROLE_ID;

const mentionedResponses = [
  'nyes?',
  'hewwo~',
  'oww, that was loud >_<',
  'your friendly robot neko, at your service :3',
  'nya?!',
  'huh?',
  '*runs with toast in mouth*',
  'how are nyu?',
  'hai!',
  'gmeow~',
  '*runs away with krane*',
];

async function defaultResponse(message: Message) {
  return message.reply(mentionedResponses[Math.floor(Math.random() * mentionedResponses.length)]);
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === message.client.user.id) return;
  const me = client.user?.id;
  if (!me || !message.mentions.has(me)) {
    return;
  }
  const is_llm_role = message.member!.roles.cache.some((role) => role.id === LLMRole);

  console.log(`Mentioned by ${message.author.username}, can use LLM: ${is_llm_role}`);

  if (is_llm_role) {
    // filter role pings if LLM user
    // no @everyone, @here, or role pings
    if (message.mentions.users.size > 0) {
      return LLMResponse(message);
    } else {
      console.log('role ping, not triggering LLM');
      await defaultResponse(message);
    }
  } else {
    await defaultResponse(message);
  }
});
