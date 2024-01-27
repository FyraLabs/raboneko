import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ProgressLog } from '@prisma/client';
import { client } from '../prisma';
import bot from '../client';
import {
  enumStringsToChoice,
  getAnnoucementsChannel,
  getPrimaryGuild,
  getUpdatesChannel,
} from '../util';
import { EmbedBuilder, RESTError, RESTJSONErrorCodes } from 'discord.js';
import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  Member,
  SlashCommand,
  SlashCreator,
} from 'slash-create';

dayjs.extend(isoWeek);
dayjs.extend(utc);

enum Product {
  TAUOS,
  HOMEPAGE,
  PHOTON_BROWSER,
  INTERNAL,
  RABONEKO,
  ANDAMAN,
  TERRA,
  OTHER,
  ULTRAMARINE,
}

const productToString = new Map<Product, string>([
  [Product.TAUOS, 'tauOS'],
  [Product.HOMEPAGE, 'Homepage'],
  [Product.PHOTON_BROWSER, 'photonBrowser'],
  [Product.INTERNAL, 'InternalTools'],
  [Product.RABONEKO, 'Raboneko (me :3)'],
  [Product.ANDAMAN, 'Andaman'],
  [Product.TERRA, 'Terra'],
  [Product.OTHER, 'Other'],
  [Product.ULTRAMARINE, 'Ultramarine'],
]);

const _stringToProduct = new Map<string, Product>(
  [...productToString.entries()].map(([k, v]) => [v, k]),
);

enum LogType {
  MILESTONE,
  BLOCKER,
  RELEASE,
  FEATURE,
  BUG_FIX,
  OTHER,
  IMPROVEMENT,
}

const logTypeToString = new Map<LogType, string>([
  [LogType.MILESTONE, 'Milestone'],
  [LogType.BLOCKER, 'Blocker'],
  [LogType.RELEASE, 'Release'],
  [LogType.FEATURE, 'Feature'],
  [LogType.IMPROVEMENT, 'Improvement'],
  [LogType.BUG_FIX, 'Bug Fix'],
  [LogType.OTHER, 'Other'],
]);

const _stringToLogType = new Map<string, LogType>(
  [...logTypeToString.entries()].map(([k, v]) => [v, k]),
);

const logTypeToEmoji = new Map<LogType, string>([
  [LogType.MILESTONE, ':bookmark:'],
  [LogType.BLOCKER, ':octagonal_sign:'],
  [LogType.RELEASE, ':rocket:'],
  [LogType.FEATURE, ':sparkles:'],
  [LogType.IMPROVEMENT, ':hammer:'],
  [LogType.BUG_FIX, ':bug:'],
  [LogType.OTHER, ':notepad_spiral:'],
]);

const groupLogs = (logs: ProgressLog[]): Record<string, ProgressLog[]> =>
  logs.reduce(
    (prev, l) => {
      const productString = productToString.get(l.product)!;

      if (!(productString in prev)) {
        prev[productString] = [];
      }

      prev[productString].push(l);

      return prev;
    },
    {} as Record<string, ProgressLog[]>,
  );

const partitionStringsByLength = (strings: string[], maxLength: number): string[][] => {
  const final: string[][] = [[]];
  let sub = final[0];

  strings.forEach((string) => {
    const lengthAfterPush = sub.reduce((acc, curr) => acc + curr.length, 0) + string.length;
    if (lengthAfterPush <= maxLength) {
      sub.push(string);
    } else {
      sub = [];
      final.push(sub);
      sub.push(string);
    }
  });

  return final;
};

const generateFields = (
  grouped: Record<string, ProgressLog[]>,
): Promise<Array<{ name: string; value: string }>> =>
  Promise.all(
    Object.entries(grouped).map(async ([product, logs]) => {
      const formatted = await Promise.all(
        [...logs]
          .sort((l1, l2) => l1.createdAt.valueOf() - l2.createdAt.valueOf())
          .map(async (l) => {
            const guild = await getPrimaryGuild();
            let memberName;
            try {
              memberName = (await guild.members.fetch(l.userID)).displayName;
            } catch {
              memberName = (await bot.users.fetch(l.userID)).username;
            }

            const emoji = logTypeToEmoji.get(l.type);

            return `${memberName} • ${emoji} ${l.summary}`;
          }),
      );

      const paritioned = partitionStringsByLength(formatted, 1024);

      return paritioned.map((parition, i) => ({
        name: i != 0 ? `${product} (continued)` : product,
        value: parition.join('\n'),
      }));
    }),
  ).then((fields) => fields.flat());

export const generateFinalReport = async (): Promise<void> => {
  const lastWeek = dayjs.utc().isoWeekday(-1);
  const startOfWeek = lastWeek.startOf('isoWeek');
  const endOfWeek = lastWeek.endOf('isoWeek');

  const logs = await client.progressLog.findMany({
    where: {
      createdAt: {
        gte: startOfWeek.toDate(),
        lte: endOfWeek.toDate(),
      },
    },
  });

  const grouped = groupLogs(logs);
  const fields = await generateFields(grouped);
  const embed = new EmbedBuilder()
    .addFields(fields)
    .setDescription(fields.length > 0 ? null : '*No progress this week.*');

  const announcementsChannel = await getAnnoucementsChannel();

  if (!announcementsChannel.isTextBased()) {
    throw new Error('Announcements channel is not a text channel.');
  }

  let content = `Here is the final report for the week of ${startOfWeek.format(
    'MMMM D, YYYY',
  )} to ${endOfWeek.format('MMMM D, YYYY')}. Great work everyone!`;
  if (Math.random() < 0.05)
    content = "New face filters on Instagram today. This one's my favorite so far. Nice job team!";
  await announcementsChannel.send({
    content,
    embeds: [embed.data],
  });
};

export default class Progress extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'progress',
      description: 'Track progress for Fyra projects, per week',
      dmPermission: false,
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'create',
          description: 'Create a progress log',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'product',
              description: 'The product the log is for',
              choices: enumStringsToChoice(productToString),
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: 'type',
              description: 'The type of progress log',
              choices: enumStringsToChoice(logTypeToString),
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: 'summary',
              description: 'The summary of your progress',
              required: true,
            },
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'report',
          description: 'Generate a progress report',
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'delete',
          description: 'Delete a progress log',
          options: [
            {
              type: CommandOptionType.INTEGER,
              name: 'log',
              description: 'The the log to delete',
              required: true,
              autocomplete: true,
            },
          ],
        },
      ],
    });
  }

  private async create(ctx: CommandContext): Promise<void> {
    if (!(ctx.member instanceof Member)) {
      await ctx.sendFollowUp("Sorry, I couldn't understand your request for some reason >_<");
      return;
    }

    const options = ctx.options[ctx.subcommands[0]];

    const type = parseInt(options.type, 10) as LogType;
    const product = parseInt(options.product, 10) as Product;

    const log = await client.progressLog.create({
      data: {
        userID: ctx.user.id,
        type,
        product,
        summary: options.summary,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('Progress Log Submitted')
      .setColor('#00ff00')
      .setFooter({
        text: `ID: #${log.id.toString()}`,
      })
      .setAuthor({
        name: ctx.member.displayName,
        iconURL: ctx.member.avatarURL,
      })
      .setDescription(options.summary)
      .setFields([
        { name: 'Product', value: productToString.get(product)!, inline: true },
        { name: 'Type', value: logTypeToString.get(type)!, inline: true },
      ]).data;

    await ctx.sendFollowUp({
      content:
        "Thanks for submitting your progress log! I'll add it to our weekly report :3\nFor now, here's a preview of your log:",
      embeds: [embed],
    });

    const updatesChannel = await getUpdatesChannel();

    if (!updatesChannel.isTextBased()) {
      throw new Error('Updates channel is not a text channel.');
    }

    const updateMessage = await updatesChannel.send({
      content: 'Yay, a progress log just got submitted~',
      embeds: [embed],
    });

    // we can't do this in one op, since we don't know the update message ID until it's created
    await client.progressLog.update({
      where: {
        id: log.id,
      },
      data: {
        logMessageID: updateMessage.id,
      },
    });
  }

  private async delete(ctx: CommandContext): Promise<void> {
    const options = ctx.options[ctx.subcommands[0]];

    // not atomic, don't care, error handling sucks in Prisma (and I don't want to use transactions here)

    const log = await client.progressLog.findUnique({
      where: {
        id: options.log,
      },
    });

    if (!log) {
      await ctx.sendFollowUp("You can't remove a log that doesn't exist! :P");
      return;
    }

    await client.progressLog.delete({
      where: {
        id: options.log,
      },
    });

    if (log.logMessageID !== null) {
      const updatesChannel = await getUpdatesChannel();

      if (!updatesChannel.isTextBased()) {
        throw new Error('Updates channel is not a text channel.');
      }

      try {
        await updatesChannel.messages.delete(log.logMessageID);
      } catch (e) {
        // if the error IS NOT that the message doesn't exist, throw it up
        if ((e as RESTError).code !== RESTJSONErrorCodes.UnknownMessage) {
          throw e;
        }
      }
    }

    await ctx.sendFollowUp(
      `Okie, just removed the log \`${log.summary}\`! Destroying things is fun >:3`,
    );
  }

  private async report(ctx: CommandContext): Promise<void> {
    await ctx.defer();

    const startOfWeek = dayjs().utc().startOf('isoWeek');
    const endOfWeek = dayjs().utc().endOf('isoWeek');

    const logs = await client.progressLog.findMany({
      where: {
        createdAt: {
          gte: startOfWeek.toDate(),
          lte: endOfWeek.toDate(),
        },
      },
    });

    const grouped = groupLogs(logs);
    const fields = await generateFields(grouped);
    const embed = new EmbedBuilder()
      .addFields(fields)
      .setDescription(fields.length > 0 ? null : '*No progress this week.*').data;

    await ctx.editOriginal({
      content: "Here's a summary of the current week. Great progress so far~",
      embeds: [embed],
    });
  }

  public async autocomplete(ctx: AutocompleteContext): Promise<void> {
    switch (ctx.subcommands[0]) {
      case 'delete': {
        if (ctx.focused !== 'log') return;

        const value = ctx.options.delete.log as string;

        const startOfWeek = dayjs().utc().startOf('isoWeek');
        const endOfWeek = dayjs().utc().endOf('isoWeek');

        const reminders = await client.progressLog.findMany({
          where: {
            createdAt: {
              gte: startOfWeek.toDate(),
              lte: endOfWeek.toDate(),
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        const filtered = reminders.filter((r) => r.summary.startsWith(value));
        await ctx.sendResults(filtered?.map((t) => ({ name: t.summary, value: t.id })) || []);

        break;
      }
    }
  }

  public async run(ctx: CommandContext): Promise<void> {
    switch (ctx.subcommands[0]) {
      case 'create':
        await this.create(ctx);
        break;
      case 'report':
        await this.report(ctx);
        break;
      case 'delete':
        await this.delete(ctx);
        break;
    }
  }
}
