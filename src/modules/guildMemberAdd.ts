import client from '../client';
import { ChannelType, Events } from 'discord.js';
import { getGeneralChannel } from '../util';

client.on(Events.GuildMemberAdd, async (member) => {
  const generalChannel = await getGeneralChannel();

  if (generalChannel?.type !== ChannelType.GuildText) {
    throw new Error('General channel is not a text channel.');
  }

  await generalChannel.send(
    `Heya~ ${member.displayName}! Welcome to the Fyra Discord, we're the home of products such as tauOS: the next generation, friendly, and private operating system. Our server is also a chill place to talk tech and hangout. If you have any questions, feel free to ask! :3`,
  );
  await generalChannel.send(
    `By the way, my name is Raboneko, Fyra's virtual neko assistant, *nya~* It's a pleasure to meet nyu, and I hope you have a great time here as well ^_^`,
  );
});
