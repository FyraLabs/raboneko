import { bot } from "./main.js";

export const enumStringsToChoice = (e: Map<number, string>) =>
  Array.from(e.entries()).map(([key, value]) => ({
    name: value,
    value: key,
  }));

export const getPrimaryGuild = () =>
  bot.guilds.fetch(process.env.PRIMARY_GUILD_ID!);

export const getAnnoucementsChannel = () =>
  bot.channels.fetch(process.env.ANNOUNCEMENTS_CHANNEL_ID!);
