import client from '../client';
import { Events } from 'discord.js';

client.on(Events.MessageCreate, async (message) => {
  if (message.content === "skull" || message.content.includes("skull emoji")) {
    await message.react("💀");
  }
});
