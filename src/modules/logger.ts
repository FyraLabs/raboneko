import client from '../client';
import { EmbedBuilder, Events, time, TimestampStyles } from 'discord.js';
import { getLoggingChannel, userURL } from '../util';

// Right now we log the following for moderation purposes:
// - MessageDelete
// - MessageUpdate
// - GuildMemberAdd
// - GuildMemberRemove

client.on(Events.MessageDelete, async (message) => {
  if (!message.member) return;

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
    .setDescription(message.content)
    .setFooter({
      text: `Message ID: ${message.id}`,
    }).data;

  await loggingChannel.send({
    embeds: [embed],
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!oldMessage.member) return;

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
        value: oldMessage.content ?? 'Unknown',
      },
      {
        name: 'New Content',
        value: newMessage.content ?? 'Unknown',
      },
    )
    .setFooter({
      text: `Message ID: ${oldMessage.id}`,
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
    .addFields(
      {
        name: 'Discord User Since',
        value: time(member.user.createdAt, TimestampStyles.ShortDateTime),
      },
      {
        name: 'User ID',
        value: member.user.id,
      },
    )
    .setFooter({
      text: `Member ID: ${member.id}`,
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
    .addFields(
      {
        name: 'Member Since',
        value: member.joinedAt ? time(member.joinedAt, TimestampStyles.ShortDateTime) : 'Unknown',
      },
      {
        name: 'User ID',
        value: member.user.id,
      },
    )
    .setFooter({
      text: `Member ID: ${member.id}`,
    }).data;

  await loggingChannel.send({
    embeds: [embed],
  });
});
