import client from '../client';
import { Events } from 'discord.js';

client.on(Events.MessageCreate, async (message) => {
  if (message.content.match(/\bkrane\b/)?.length) {
    await message.reply({
      stickers: ['1229211273904787531'],
    });
  }
});
