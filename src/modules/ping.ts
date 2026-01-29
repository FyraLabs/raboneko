import client from '../client';
import { Events } from 'discord.js';

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
  'beep!',
  'boop!',
  'mreow~ :3',
  'hiiiiii',
];

client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === message.client.user.id) return;
  const me = client.user?.id;
  if (!me || !message.mentions.has(me)) {
    return;
  }
  await message.reply(mentionedResponses[Math.floor(Math.random() * mentionedResponses.length)]);
});
