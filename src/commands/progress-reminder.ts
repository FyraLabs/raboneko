import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from "slash-create";
import { client as db } from "../prisma.ts";
import bot from "../client.ts";
import { formatTimeZone } from "../timezone.ts";

const defaultTimezone = "America/Chicago";

const hasStaffRole = async (
  userID: string,
  guildID: string | undefined,
): Promise<boolean> => {
  const primaryGuildID = process.env.PRIMARY_GUILD_ID;
  const staffRoleID = process.env.STAFF_ROLE_ID;
  if (!primaryGuildID || !staffRoleID || guildID !== primaryGuildID) {
    return false;
  }

  try {
    const guild = await bot.guilds.fetch(primaryGuildID);
    const member = await guild.members.fetch(userID);
    return member.roles.cache.has(staffRoleID);
  } catch {
    return false;
  }
};

const isValidGitHubUsername = (username: string): boolean =>
  username.length <= 39 &&
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username);

const isValidTimeZone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const parseReminderTime = (input: string): string | null => {
  const value = input.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;

  const match = value.match(/^([0-9]{1,2})(?::([0-5]\d))?\s*([ap])\.?m\.?$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;

  const hour24 = (hour % 12) + (match[3].toLowerCase() === "p" ? 12 : 0);
  const minute = match[2] ?? "00";
  return `${String(hour24).padStart(2, "0")}:${minute}`;
};

export default class ProgressReminder extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: "progress-reminder",
      description: "Manage progress reminders",
      dmPermission: false,
      deferEphemeral: true,
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "github",
          description:
            "Link your GitHub username for contribution-based progress reminders",
          options: [
            {
              type: CommandOptionType.STRING,
              name: "username",
              description: "Your GitHub username",
              required: true,
            },
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "opt-in",
          description:
            "Receive a progress reminder every day, regardless of contributions",
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "opt-out",
          description:
            "Stop daily progress reminders (GitHub contribution reminders still apply)",
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "time",
          description: "Set your progress reminder time and timezone",
          options: [
            {
              type: CommandOptionType.STRING,
              name: "time",
              description:
                "24-hour HH:MM or 12-hour h:mm AM/PM, e.g. 17:30 or 5:30 PM",
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: "timezone",
              description:
                "IANA timezone such as Europe/London (defaults to America/Chicago)",
              required: false,
            },
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "status",
          description: "Show your progress reminder settings",
        },
      ],
    });
  }

  public override async run(ctx: CommandContext): Promise<void> {
    if (!(await hasStaffRole(ctx.user.id, ctx.guildID))) {
      await ctx.sendFollowUp({
        content: "This command is only available to Fyra staff.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = ctx.subcommands[0];
    const options = ctx.options[subcommand] ?? {};

    switch (subcommand) {
      case "github": {
        const username = String(options.username)
          .trim()
          .replace(/^@/, "")
          .toLowerCase();
        if (!isValidGitHubUsername(username)) {
          await ctx.sendFollowUp({
            content: "That doesn't look like a valid GitHub username.",
            ephemeral: true,
          });
          return;
        }
        try {
          await db.staffDailyReminder.upsert({
            where: { userID: ctx.user.id },
            create: {
              userID: ctx.user.id,
              githubUsername: username,
              timezone: defaultTimezone,
            },
            update: { githubUsername: username, lastGithubCheckAt: null },
          });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
          ) {
            await ctx.sendFollowUp({
              content:
                "That GitHub username is already linked to another Discord account.",
              ephemeral: true,
            });
            return;
          }
          throw error;
        }
        await ctx.sendFollowUp({
          content: `Linked GitHub account **${username}**.`,
          ephemeral: true,
        });
        return;
      }
      case "opt-in": {
        const settings = await db.staffDailyReminder.upsert({
          where: { userID: ctx.user.id },
          create: {
            userID: ctx.user.id,
            optedIn: true,
            timezone: defaultTimezone,
          },
          update: { optedIn: true },
        });
        await ctx.sendFollowUp({
          content:
            `Progress reminders are on. I'll DM you every day at **${settings.time} ${
              formatTimeZone(
                settings.timezone,
              )
            }**.`,
          ephemeral: true,
        });
        return;
      }
      case "opt-out": {
        await db.staffDailyReminder.upsert({
          where: { userID: ctx.user.id },
          create: {
            userID: ctx.user.id,
            optedIn: false,
            timezone: defaultTimezone,
          },
          update: { optedIn: false },
        });
        await ctx.sendFollowUp({
          content:
            "Progress reminders are off. You will still receive one when your linked GitHub account contributes to a Fyra organization.",
          ephemeral: true,
        });
        return;
      }
      case "time": {
        const time = parseReminderTime(String(options.time));
        const currentSettings = await db.staffDailyReminder.findUnique({
          where: { userID: ctx.user.id },
        });
        const timezone = String(
          options.timezone ?? currentSettings?.timezone ?? defaultTimezone,
        );
        if (!time) {
          await ctx.sendFollowUp({
            content:
              "Use 24-hour `HH:MM` (for example `17:30`) or 12-hour time with AM/PM (for example `5:30 PM`).",
            ephemeral: true,
          });
          return;
        }
        if (!isValidTimeZone(timezone)) {
          await ctx.sendFollowUp({
            content:
              "Use a valid IANA timezone, such as `America/Los_Angeles` or `Europe/London`.",
            ephemeral: true,
          });
          return;
        }
        await db.staffDailyReminder.upsert({
          where: { userID: ctx.user.id },
          create: { userID: ctx.user.id, time, timezone },
          update: { time, timezone },
        });
        await ctx.sendFollowUp({
          content: `Your progress reminder time is now **${time} ${
            formatTimeZone(
              timezone,
            )
          }**.`,
          ephemeral: true,
        });
        return;
      }
      case "status": {
        const settings = await db.staffDailyReminder.findUnique({
          where: { userID: ctx.user.id },
        });
        await ctx.sendFollowUp({
          content: settings
            ? `GitHub: **${
              settings.githubUsername ?? "not linked"
            }**\nDaily progress opt-in: **${
              settings.optedIn ? "on" : "off"
            }**\nProgress reminder time: **${settings.time} ${
              formatTimeZone(
                settings.timezone,
              )
            }**\nOpting out does not disable reminders triggered by GitHub contributions.`
            : "No progress reminder settings yet. Use `/progress-reminder github`, `/progress-reminder opt-in`, or `/progress-reminder time` to get started.",
          ephemeral: true,
        });
      }
    }
  }
}
