import client from '../client';
import { Events } from 'discord.js';
import { containsWord } from '../util';

client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === message.client.user.id) return;
  if (containsWord(message, 'krane')) {
    await message.react('1233642528889245776');
  }
  if (containsWord(message, 'hayato')) {
    await message.react('1231664960032215070');
  }
  if (message.content.toLowerCase() == 'skull' || containsWord(message, 'skull\\s+emoji')) {
    await message.react('💀');
  }
  if (containsWord(message, 'good\\s+bot") {
    await message.reply("thank nyu~")
  }
});
