import { client } from './index.js';

export const enumStringsToChoice = (e: Map<number, string>) =>
  Array.from(e.entries())
    .sort((a, b) => a[0] - b[0])
    .map((e) => ({ name: e[1], value: e[0].toString() }));

export const getPrimaryGuild = () => client.guilds.fetch(process.env.PRIMARY_GUILD_ID!);

export const getAnnoucementsChannel = () => client.channels.fetch(process.env.ANNOUNCEMENTS_CHANNEL_ID!);

export const getUpdatesChannel = () => client.channels.fetch(process.env.UPDATES_CHANNEL_ID!);

export const getGeneralChannel = () => client.channels.fetch(process.env.GENERAL_CHANNEL_ID!);
