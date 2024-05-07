import client from '../client';
import { Events, Message } from 'discord.js';
import { containsWord } from '../util'


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
