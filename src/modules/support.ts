import client from '../client';
import { ChannelType, Events } from 'discord.js';

const cannedResponses = new Map([
  [
    'Ultramarine Linux',
    `Hewwo! If you haven't already, please make sure to provide the following:
* Version and edition of Ultramrine (ex. Ultramarine 40 KDE)
* Any relavant hardware details, especially if using a port of Ultramarine (ex. Chromebooks)
* Age of the install (ex. 1 week old)
* Any recent changes made to the system (ex. updates, new software, etc.)
* Any error messages you're seeing
* Any steps you've already taken to try and resolve the issue
* Any other relevant information

This will help us help you faster! :3`,
  ],
]);

client.on(Events.ThreadCreate, async (thread) => {
  if (
    !(
      thread.parent?.type === ChannelType.GuildForum &&
      thread.parent.id === process.env.SUPPORT_FORUM_ID!
    )
  ) {
    return;
  }

  const entry = Array.from(cannedResponses.entries()).find(([tag]) =>
    thread.appliedTags.includes(tag),
  );
  if (!entry) return;

  await thread.send(entry[1]);
});
