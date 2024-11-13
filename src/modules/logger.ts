import client from '../client';
import { EmbedBuilder, Events, time, TimestampStyles } from 'discord.js';
import { getLoggingChannel, userURL } from '../util';

// Right now we log the following for moderation purposes:
// - MessageDelete
// - MessageUpdate
// - GuildMemberAdd
// - GuildMemberRemove

client.on(Events.MessageDelete, async (message) => {
  if (!message.member || message.author?.bot) return;

  const loggingChannel = await getLoggingChannel();
  if (!loggingChannel.isSendable()) {
    throw new Error('Logging channel is not a text channel.');
  }

  const embed = new EmbedBuilder()
    .setTitle('Message Delete')
    .setAuthor({
      name: message.member.displayName,
      iconURL: message.member.displayAvatarURL(),
      url: userURL(message.member.user.id),
    })
    .setColor('#ff0000')
    .setDescription(message.content && message.content.length !== 0 ? message.content : 'Unknown')
    .setFooter({
      text: `Message ID: ${message.id} | User ID: ${message.member.user.id}`,
    }).data;

  await loggingChannel.send({
    embeds: [embed],
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!oldMessage.member || oldMessage.author?.bot || newMessage.author?.bot) return;

  const loggingChannel = await getLoggingChannel();
  if (!loggingChannel.isSendable()) {
    throw new Error('Logging channel is not a text channel.');
  }

  const embed = new EmbedBuilder()
    .setTitle('Message Update')
    .setAuthor({
      name: oldMessage.member.displayName,
      iconURL: oldMessage.member.displayAvatarURL(),
      url: userURL(oldMessage.member.user.id),
    })
    .setColor('#ffff00')
    .addFields(
      {
        name: 'Old Content',
        value:
          oldMessage.content && oldMessage.content?.length !== 0 ? oldMessage.content : 'Unknown',
      },
      {
        name: 'New Content',
        value:
          newMessage.content && newMessage.content.length !== 0 ? newMessage.content : 'Unknown',
      },
    )
    .setFooter({
      text: `Message ID: ${oldMessage.id} | User ID: ${oldMessage.member.user.id}`,
    }).data;

  await loggingChannel.send({
    embeds: [embed],
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  const loggingChannel = await getLoggingChannel();
  if (!loggingChannel.isSendable()) {
    throw new Error('Logging channel is not a text channel.');
  }

  const embed = new EmbedBuilder()
    .setTitle('Member Join')
    .setAuthor({
      name: member.displayName,
      iconURL: member.displayAvatarURL(),
      url: userURL(member.user.id),
    })
    .setColor('#00ff00')
    .addFields({
      name: 'Discord User Since',
      value: time(member.user.createdAt, TimestampStyles.ShortDateTime),
    })
    .setFooter({
      text: `Member ID: ${member.id} | User ID: ${member.user.id}`,
    }).data;

  await loggingChannel.send({
    embeds: [embed],
  });
});

client.on(Events.GuildMemberRemove, async (member) => {
  const loggingChannel = await getLoggingChannel();
  if (!loggingChannel.isSendable()) {
    throw new Error('Logging channel is not a text channel.');
  }

  const embed = new EmbedBuilder()
    .setTitle('Member Leave')
    .setAuthor({
      name: member.displayName,
      iconURL: member.displayAvatarURL(),
      url: userURL(member.user.id),
    })
    .setColor('#ff0000')
    .addFields({
      name: 'Member Since',
      value: member.joinedAt ? time(member.joinedAt, TimestampStyles.ShortDateTime) : 'Unknown',
    })
    .setFooter({
      text: `Member ID: ${member.id} | User ID: ${member.user.id}`,
    }).data;

  await loggingChannel.send({
    embeds: [embed],
  });
});
