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

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (newMessage.channelId !== process.env.WRAPS_CHANNEL_ID || newMessage.author.bot) return;

  await prismaClient.wrap.update({
    where: {
      wrapMessageID: newMessage.id,
    },
    data: {
      content: newMessage.content,
    },
  });
});

client.on(Events.MessageDelete, async (message) => {
  if (message.channelId !== process.env.WRAPS_CHANNEL_ID || message.author?.bot) return;

  await prismaClient.wrap.delete({
    where: {
      wrapMessageID: message.id,
    },
  });
});
