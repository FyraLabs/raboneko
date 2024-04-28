import client from '../client';
import { Events, Message } from 'discord.js';

const containsWord = (msg: Message, word: string): boolean => {
  const matches = msg.content.match(new RegExp(`\\b${word}\\b`, 'i'));
  return matches != null && matches.length > 0;
};

client.on(Events.MessageCreate, async (message) => {
  if (containsWord(message, 'krane')) {
    await message.react('1233642528889245776');
  }
  if (containsWord(message, 'hayato')) {
    await message.react('1231664960032215070');
  }
  if (message.content.toLowerCase() == 'skull' || containsWord(message, 'skull\\s+emoji')) {
    await message.react('💀');
  }
});
