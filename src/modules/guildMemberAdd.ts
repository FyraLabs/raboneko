import client from '../client';
import { Events } from 'discord.js';
import { getGeneralChannel } from '../util';

client.on(Events.GuildMemberAdd, async (member) => {
  const generalChannel = await getGeneralChannel();

  if (!generalChannel.isSendable()) {
    throw new Error('General channel is not a text channel.');
  }

  await member.roles.add(process.env.MEMBER_ROLE_ID!);
  await generalChannel.send(`Welcome~ ${member} :3`);
});
