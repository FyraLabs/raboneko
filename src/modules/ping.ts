import { client } from '../index';
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
  'gmeow~'
];

client.on(Events.MessageCreate, async (message) => {
  const me = client.user?.id;
  if (!me || !message.mentions.has(me)) {
    return;
  }
  await message.reply(mentionedResponses[Math.floor(Math.random() * mentionedResponses.length)]);
});
