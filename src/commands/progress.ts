import { CommandInteraction, EmbedBuilder, GuildMember } from "discord.js";
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import isoWeek from "dayjs/plugin/isoWeek.js";
import { CronJob } from "cron";

new CronJob("0 0 * * 0", () => generateFinalReport(), null, true, "UTC");

import { client } from "../prisma.js";
import {
  enumStringsToChoice,
  getAnnoucementsChannel,
  getPrimaryGuild,
} from "../util.js";
import { ProgressLog } from "@prisma/client";
import { bot } from "../main.js";

dayjs.extend(isoWeek);
dayjs.extend(utc);

enum Product {
  TAUOS,
  HOMEPAGE,
  PHOTON_BROWSER,
  INTERNAL,
  RABONEKO,
}

const productToString: Map<Product, string> = new Map([
  [Product.TAUOS, "tauOS"],
  [Product.HOMEPAGE, "Homepage"],
  [Product.PHOTON_BROWSER, "photonBrowser"],
  [Product.INTERNAL, "InternalTools"],
  [Product.RABONEKO, "Raboneko (me :3)"],
]);

enum LogType {
  MILESTONE,
  BLOCKER,
  RELEASE,
  FEATURE,
  BUG_FIX,
  OTHER,
  IMPROVEMENT,
}

const logTypeToString: Map<LogType, string> = new Map([
  [LogType.MILESTONE, "Milestone"],
  [LogType.BLOCKER, "Blocker"],
  [LogType.RELEASE, "Release"],
  [LogType.FEATURE, "Feature"],
  [LogType.IMPROVEMENT, "Improvement"],
  [LogType.BUG_FIX, "Bug Fix"],
  [LogType.OTHER, "Other"],
]);

const logTypeToEmoji: Map<LogType, string> = new Map([
  [LogType.MILESTONE, ":bookmark:"],
  [LogType.BLOCKER, ":octagonal_sign:"],
  [LogType.RELEASE, ":rocket:"],
  [LogType.FEATURE, ":sparkles:"],
  [LogType.IMPROVEMENT, ":hammer:"],
  [LogType.BUG_FIX, ":bug:"],
  [LogType.OTHER, ":notepad_spiral:"],
]);

const groupLogs = (logs: ProgressLog[]) =>
  logs.reduce((prev, l) => {
    const productString = productToString.get(l.product)!;

    if (!(productString in prev)) {
      prev[productString] = [];
    }

    prev[productString].push(l);

    return prev;
  }, {} as Record<string, ProgressLog[]>);

const generateFields = (grouped: Record<string, ProgressLog[]>) =>
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

            return `${memberName} • ${l.id.toString()} • ${emoji} ${l.summary}`;
          })
      );

      return {
        name: product,
        value: formatted.join("\n"),
      };
    })
  );

const generateFinalReport = async () => {
  const lastWeek = dayjs.utc().isoWeekday(-1);
  const startOfWeek = lastWeek.startOf("isoWeek");
  const endOfWeek = lastWeek.endOf("isoWeek");

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
    .setDescription(fields.length > 0 ? null : "*No progress this week.*");

  const announcementsChannel = await getAnnoucementsChannel();

  if (!announcementsChannel?.isTextBased()) {
    throw new Error("Announcements channel is not a text channel.");
  }

  await announcementsChannel.send({
    content: `Here is the final report for the week of ${startOfWeek.format(
      "MMMM D, YYYY"
    )} to ${endOfWeek.format("MMMM D, YYYY")}. Great work everyone!`,
    embeds: [embed.data],
  });
};

@Discord()
@SlashGroup({
  name: "progress",
  description: "Track progress for Fyra projects, per week",
})
@SlashGroup("progress")
class Progress {
  @Slash()
  async log(
    @SlashChoice(...enumStringsToChoice(productToString))
    @SlashOption("product", { description: "The product the log is for" })
    product: Product,
    @SlashChoice(...enumStringsToChoice(logTypeToString))
    @SlashOption("type", { description: "The type of progress log" })
    type: LogType,
    @SlashOption("summary", { description: "The summary of your progress" })
    summary: string,
    interaction: CommandInteraction
  ) {
    if (!(interaction.member instanceof GuildMember)) {
      await interaction.reply(
        "Sorry, I couldn't understand your request for some reason >_<"
      );
      return;
    }

    const log = await client.progressLog.create({
      data: {
        userID: interaction.user.id,
        type,
        product,
        summary,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle("Progress Log Submitted")
      .setColor("#00ff00")
      .setFooter({
        text: "ID: #" + log.id.toString(),
      })
      .setAuthor({
        name: interaction.member.displayName,
        iconURL: interaction.member.displayAvatarURL(),
      })
      .setDescription(summary)
      .setFields([
        { name: "Product", value: productToString.get(product)!, inline: true },
        { name: "Type", value: logTypeToString.get(type)!, inline: true },
      ]);

    await interaction.reply({
      content:
        "Thanks for submitting your progress log! I'll add it to our weekly report :3\nFor now, here's a preview of your log:",
      embeds: [embed],
    });
  }

  @Slash()
  async report(interaction: CommandInteraction) {
    const guild = interaction.guild;
    if (guild === null) {
      await interaction.reply(
        "Sorry, I couldn't understand your request for some reason >_<"
      );
      return;
    }

    const startOfWeek = dayjs().utc().startOf("isoWeek");
    const endOfWeek = dayjs().utc().endOf("isoWeek");

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
      .setDescription(fields.length > 0 ? null : "*No progress this week.*");

    await interaction.reply({
      content: "Here's a summary of the current week. Great progress so far~",
      embeds: [embed],
    });
  }
}
