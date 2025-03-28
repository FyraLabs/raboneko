import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  ComponentContext,
  ComponentType,
  SlashCommand,
  SlashCreator,
  TextInputStyle,
} from 'slash-create';
import parse from 'parse-duration';
import raboneko from '../client';
import { client } from '../prisma';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, messageLink, TextChannel } from 'discord.js';
import { reminderQueue } from '../scheduler';

export const handleReminderEvent = async (reminderID: number): Promise<void> => {
  const reminder = await client.reminder.findUnique({
    where: {
      id: reminderID,
    },
  });

  if (!reminder) return;

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Go to original message')
      .setStyle(ButtonStyle.Link)
      .setURL(reminder.link),
    new ButtonBuilder()
      .setCustomId('snooze')
      .setLabel('Snooze')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🛌'),
  );

  const channel = (await raboneko.channels.fetch(reminder.channelID)) as TextChannel;
  const message = await channel.send({
    content: `Gmeow <@${reminder.userID}>! Just wanted to remind you to \`${reminder.content}\`, nya~ Don't forget to take care of it, okie? :3`,
    components: [buttonRow],
  });

  await client.reminder.update({
    where: {
      id: reminderID,
    },
    data: {
      reminderMessageID: message.id,
    },
  });
};

export default class Remind extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'remind',
      description: 'All in one command to manage your reminders!',
      dmPermission: false,
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'create',
          description: 'Create a reminder',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'time',
              description: 'The time to remind you in',
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: 'reminder',
              description: 'What to remind you of',
              required: false,
            },
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'list',
          description: 'List your running reminders',
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'delete',
          description: 'Delete a reminder',
          options: [
            {
              type: CommandOptionType.INTEGER,
              name: 'reminder',
              description: 'Reminder to delete',
              required: true,
              autocomplete: true,
            },
          ],
        },
      ],
    });

    creator.registerGlobalComponent('snooze', this.snoozeHandler);
  }

  public async autocomplete(ctx: AutocompleteContext): Promise<void> {
    switch (ctx.subcommands[0]) {
      case 'delete': {
        if (ctx.focused !== 'reminder') return;

        const value = ctx.options.delete.reminder as string;

        const reminders = await client.reminder.findMany({
          where: {
            userID: ctx.user.id,
            time: {
              gte: new Date(),
            },
          },
          orderBy: {
            time: 'asc',
          },
        });

        const filtered = reminders.filter((r) => r.content.startsWith(value));
        await ctx.sendResults(filtered?.map((t) => ({ name: t.content, value: t.id })) || []);

        break;
      }
    }
  }

  public async run(ctx: CommandContext): Promise<void> {
    // Good grief, what a terrible way to do this.
    switch (ctx.subcommands[0]) {
      case 'create': {
        const options = ctx.options[ctx.subcommands[0]];
        const reminder = options.reminder ?? '...';
        const delay = parse(options.time);
        if (typeof delay !== 'number') {
          await ctx.sendFollowUp(
            'The time you input is invalid! The format must be something along the lines of `1h30m25s`.',
          );
          return;
        }
        const time = new Date(Date.now() + delay);
        const msg = await ctx.sendFollowUp('Creating your reminder...');

        const { id } = await client.reminder.create({
          data: {
            userID: ctx.user.id,
            channelID: ctx.channelID,
            content: reminder,
            time,
            link: ctx.guildID
              ? messageLink(msg.channelID, msg.id, ctx.guildID)
              : messageLink(msg.channelID, msg.id),
          },
        });

        await reminderQueue.add('reminder', { id }, { delay });

        await msg.edit(
          `Alrightie ${ctx.user.mention}, I'll remind you in <t:${Math.trunc(
            time.getTime() / 1000,
          )}:R> to \`${reminder}\`~`,
        );
        break;
      }
      case 'list': {
        const reminders = await client.reminder.findMany({
          where: {
            userID: ctx.user.id,
            time: {
              gte: new Date(),
            },
          },
          orderBy: {
            time: 'asc',
          },
        });

        if (reminders.length === 0) {
          await ctx.sendFollowUp("Nyu have no reminders, looks like someone's all caught up :3");
          return;
        }

        let content = "Here's your reminders!\n";
        for (const reminder of reminders) {
          content += `- ${reminder.content}: [link](${reminder.link}) (<t:${Math.trunc(
            reminder.time.getTime() / 1000,
          )}:R>)\n`;
        }

        await ctx.sendFollowUp(content);
        break;
      }
      case 'delete': {
        const options = ctx.options[ctx.subcommands[0]];
        const reminder = await client.reminder.delete({
          where: {
            id: options.reminder,
          },
        });
        await ctx.sendFollowUp(`Deleted \`${reminder.content}\`!`);
      }
    }
  }

  private async snoozeHandler(ctx: ComponentContext): Promise<void> {
    const reminder = await client.reminder.findUnique({
      where: {
        reminderMessageID: ctx.message.id,
      },
    });

    if (!reminder) return;

    if (ctx.user.id !== reminder.userID) {
      await ctx.sendFollowUp({
        content: 'This snooze button is not for you, sorry!',
        ephemeral: true,
      });
      return;
    }

    await ctx.sendModal(
      {
        title: 'Reschedule this reminder?',
        components: [
          {
            type: ComponentType.ACTION_ROW,
            components: [
              {
                type: ComponentType.TEXT_INPUT,
                custom_id: 'duration',
                label: 'Duration',
                style: TextInputStyle.SHORT,
                max_length: 20,
                placeholder: '5m',
                required: true,
              },
            ],
          },
        ],
      },
      async (ctx) => {
        const delay = parse(ctx.values.duration);
        if (typeof delay !== 'number') {
          await ctx.sendFollowUp(
            'The time you input is invalid! The format must be something along the lines of `1h30m25s`.',
          );
          return;
        }

        const time = new Date(Date.now() + delay);
        await reminderQueue.add('reminder', { id: reminder.id }, { delay });

        await ctx.editParent({
          components: [],
          content: `Alrightie ${ctx.user.mention}, I'll re-remind you in <t:${Math.trunc(
            time.getTime() / 1000,
          )}:R> to \`${reminder.content}\`~`,
        });
      },
    );
  }
}
