import { client as db } from "../prisma.ts";
import bot from "../client.ts";
import { getConfiguredGitHubOrganizations } from "./github.ts";

let lastContributionPruneAt = 0;

const contributionEventTypes = new Set([
  "PushEvent",
  "PullRequestEvent",
  "PullRequestReviewEvent",
  "PullRequestReviewCommentEvent",
  "IssuesEvent",
  "IssueCommentEvent",
  "CommitCommentEvent",
  "CreateEvent",
  "ReleaseEvent",
]);

interface GitHubEvent {
  type: string | null;
  created_at: string;
  repo: { name: string };
}

const getLocalDateAndTime = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
};

const hasGitHubContributionToday = async (
  username: string,
  timezone: string,
  localDate: string,
): Promise<boolean> => {
  const supportedOrganizations = getConfiguredGitHubOrganizations();
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "raboneko-progress-reminders",
  });
  if (process.env.GITHUB_TOKEN) {
    headers.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  }

  for (let page = 1; page <= 3; page++) {
    const response = await fetch(
      `https://api.github.com/users/${
        encodeURIComponent(
          username,
        )
      }/events?per_page=100&page=${page}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(
        `GitHub activity request failed with HTTP ${response.status}`,
      );
    }
    const events = (await response.json()) as GitHubEvent[];
    for (const event of events) {
      const organization = event.repo?.name?.split("/")[0]?.toLowerCase();
      if (
        contributionEventTypes.has(event.type ?? "") &&
        supportedOrganizations.has(organization ?? "") &&
        getLocalDateAndTime(new Date(event.created_at), timezone).date ===
          localDate
      ) {
        return true;
      }
    }
    if (events.length < 100) break;
  }
  return false;
};

export const processProgressReminders = async (): Promise<void> => {
  const guildID = process.env.PRIMARY_GUILD_ID;
  const staffRoleID = process.env.STAFF_ROLE_ID;
  if (!guildID || !staffRoleID) {
    console.error(
      "Progress reminders require PRIMARY_GUILD_ID and STAFF_ROLE_ID.",
    );
    return;
  }

  const now = new Date();
  if (now.getTime() - lastContributionPruneAt >= 60 * 60 * 1000) {
    await db.githubContribution.deleteMany({
      where: {
        occurredAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
    });
    lastContributionPruneAt = now.getTime();
  }

  const guild = await bot.guilds.fetch(guildID);
  const settings = await db.staffDailyReminder.findMany({
    where: {
      OR: [{ optedIn: true }, { githubUsername: { not: null } }],
    },
  });
  const usernames = [
    ...new Set(
      settings.flatMap((preference) =>
        preference.githubUsername
          ? [preference.githubUsername.toLowerCase()]
          : []
      ),
    ),
  ];
  const recentContributions = usernames.length > 0
    ? await db.githubContribution.findMany({
      where: {
        githubUsername: { in: usernames },
        occurredAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
      select: { githubUsername: true, repository: true, occurredAt: true },
    })
    : [];
  const contributionsByUsername = new Map<string, typeof recentContributions>();
  for (const contribution of recentContributions) {
    const existing = contributionsByUsername.get(contribution.githubUsername) ??
      [];
    existing.push(contribution);
    contributionsByUsername.set(contribution.githubUsername, existing);
  }

  const supportedOrganizations = getConfiguredGitHubOrganizations();
  for (const preference of settings) {
    const { date: localDate, time: localTime } = getLocalDateAndTime(
      now,
      preference.timezone,
    );
    if (localTime < preference.time || preference.lastSentDate === localDate) {
      continue;
    }

    const webhookContribution = preference.githubUsername
      ? (
        contributionsByUsername.get(
          preference.githubUsername.toLowerCase(),
        ) ?? []
      ).some((contribution) => {
        const organization = contribution.repository
          .split("/")[0]
          ?.toLowerCase();
        return (
          supportedOrganizations.has(organization ?? "") &&
          getLocalDateAndTime(contribution.occurredAt, preference.timezone)
              .date === localDate
        );
      })
      : false;
    const shouldCheckGitHub = !preference.optedIn &&
      !webhookContribution &&
      preference.githubUsername !== null &&
      (!preference.lastGithubCheckAt ||
        now.getTime() - preference.lastGithubCheckAt.getTime() >=
          60 * 60 * 1000);
    if (!preference.optedIn && !webhookContribution && !shouldCheckGitHub) {
      continue;
    }

    try {
      if (shouldCheckGitHub) {
        // Also limits repeated role checks for linked users who are no longer staff.
        await db.staffDailyReminder.update({
          where: { userID: preference.userID },
          data: { lastGithubCheckAt: now },
        });
      }
      const member = await guild.members.fetch(preference.userID);
      if (!member.roles.cache.has(staffRoleID)) continue;

      let contributed = webhookContribution;
      if (!contributed && shouldCheckGitHub) {
        contributed = await hasGitHubContributionToday(
          preference.githubUsername!,
          preference.timezone,
          localDate,
        );
      }

      if (!preference.optedIn && !contributed) continue;

      const user = await bot.users.fetch(preference.userID);
      const reason = preference.optedIn && contributed
        ? "You're receiving this because you opted in and had qualifying GitHub activity today."
        : preference.optedIn
        ? "You're receiving this because you opted in to daily progress reminders."
        : "Your linked GitHub account contributed to a Fyra organization today.";
      await user.send(
        `Hi! Please submit a brief progress update using /progress create.\n\n-# ${reason}`,
      );
      await db.staffDailyReminder.update({
        where: { userID: preference.userID },
        data: { lastSentDate: localDate },
      });
    } catch (error) {
      console.error(
        `Failed to process progress reminder for Discord user ${preference.userID}:`,
        error,
      );
    }
  }
};
