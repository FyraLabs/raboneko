import { CommandContext, CommandOptionType, SlashCommand, SlashCreator } from 'slash-create';
import parse from 'parse-duration';
import raboneko from '../client';
import { client } from '../prisma';
import { TextChannel } from 'discord.js';
import { reminderQueue } from '../scheduler';

export const handleReminderEvent = async (reminderID: number): Promise<void> => {
  const reminder = await client.reminder.findUnique({
    where: {
      id: reminderID,
    },
  });

  if (!reminder) return;

  const user = await raboneko.users.cache.get(reminder.userID).fetch();
  await user.send(
    `Gmeow! Just wanted to remind you to \`${reminder.content}\`, nya~ Don't forget to take care of it, okay? :3`,
  );
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
      ],
    });
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

        const channel = (await raboneko.channels.cache.get(msg.channelID).fetch()) as TextChannel;
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
          `Alrightie ${ctx.member.mention}, I'll remind you in <t:${
            (time.getTime() / 1000) | 0
          }:R> to \`${reminder}\`~`,
        );
        break;
      }
      case 'list': {
        const reminders = await client.reminder.findMany({
          where: {
            userID: ctx.member.id,
          },
          orderBy: {
            time: 'asc',
          },
        });

        if (reminders.length === 0) {
          ctx.sendFollowUp("Nyu have no reminders, looks like someone's all caught up :3");
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
      }
    }
  }
}
