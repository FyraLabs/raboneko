import client from '../client';
import { Events, Message } from 'discord.js';

function containsWord(msg: Message, word: string): boolean {
  return msg.content.match(`/\\b${word}\\b/i`)?.length !== 0;
}

client.on(Events.MessageCreate, async (message) => {
  if (containsWord(message, 'krane')) {
    await message.reply({
      stickers: ['1229211273904787531'],
    });
  }
  if (message.content.toLowerCase() == 'skull' || containsWord(message, 'skull\\s+emoji')) {
    await message.react('💀');
  }
});
