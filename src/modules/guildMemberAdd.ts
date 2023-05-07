import client from '../client';
import { Events } from 'discord.js';
import { getGeneralChannel } from '../util';

client.on(Events.GuildMemberAdd, async (member) => {
  const generalChannel = await getGeneralChannel();

  if (!generalChannel.isTextBased()) {
    throw new Error('General channel is not a text channel.');
  }

  await generalChannel.send(
    `Welcome~ ${member.displayName} :3`,
  );
});
