import client from '../client';
import { Events } from 'discord.js';
import { client as prismaClient } from '../prisma';

client.on(Events.MessageCreate, async (message) => {
  if (message.channelId !== process.env.WRAPS_CHANNEL_ID || message.author.bot) return;

  const content = message.content.trim();

  // TODO: Generate one-liner

  await message.startThread({
    name: `${message.author.displayName} - ${new Date().toDateString()}`,
  });

  await prismaClient.wrap.create({
    data: {
      userID: message.author.id,
      content: content,
      wrapMessageID: message.id,
    },
  });
});
