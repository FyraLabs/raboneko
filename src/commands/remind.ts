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
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
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

  const user = await raboneko.users.cache.get(reminder.userID)!.fetch();
  const message = await user.send({
    content: `Gmeow! Just wanted to remind you to \`${reminder.content}\`, nya~ Don't forget to take care of it, okie? :3`,
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
      description: 'All in one command to manager your reminders!',
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
          },
          orderBy: {
            time: 'asc',
          },
        });

        const filtered = reminders.filter((r) => r.content.startsWith(value));
        console.log(filtered);
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
        const time = new Date(Date.now() + delay);
        const msg = await ctx.sendFollowUp('Creating your reminder...');

        const channel = (await raboneko.channels.cache.get(msg.channelID)!.fetch()) as TextChannel;
        const message = await channel.messages.fetch(msg.id);

        const { id } = await client.reminder.create({
          data: {
            userID: ctx.user.id,
            content: reminder,
            time,
            link: message.url,
          },
        });

        await reminderQueue.add('reminder', { id }, { delay });

        await msg.edit(
          `Alrightie ${ctx.user.mention}, I'll remind you in <t:${
            (time.getTime() / 1000) | 0
          }:R> to \`${reminder}\`~`,
        );
        break;
      }
      case 'list': {
        const reminders = await client.reminder.findMany({
          where: {
            userID: ctx.user.id,
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
          if (reminder.time.getTime() > Date.now()) {
            content += `- ${reminder.content}: [link](${reminder.link}) (<t:${
              (reminder.time.getTime() / 1000) | 0
            }:R>)\n`;
          }
        }

        await ctx.sendFollowUp(content);
        break;
      }
      case 'delete': {
        const options = ctx.options[ctx.subcommands[0]];
        console.log(options);
        ctx.sendFollowUp('baller');
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
        const time = new Date(Date.now() + delay);

        await reminderQueue.add('reminder', { id: reminder.id }, { delay });

        await ctx.editParent(
          `Alrightie ${ctx.user.mention}, I'll re-remind you in <t:${
            (time.getTime() / 1000) | 0
          }:R> to \`${reminder.content}\`~`,
          {
            components: [],
          },
        );
      },
    );
  }
}
