import client from '../client';
import { Events, Message } from 'discord.js';

const containsWord = (msg: Message, word: string): boolean =>
  msg.content.match(`/\\b${word}\\b/i`)?.length !== 0;

client.on(Events.MessageCreate, async (message) => {
  if (containsWord(message, 'krane')) {
    await message.react('1233642528889245776');
  }
  if (message.content.toLowerCase() == 'skull' || containsWord(message, 'skull\\s+emoji')) {
    await message.react('💀');
  }
});
