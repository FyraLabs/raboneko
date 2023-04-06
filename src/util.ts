import { Channel, Guild } from 'discord.js';
import client from './client';
import { ConnectionOptions } from 'bullmq';
import { ApplicationCommandOptionChoice } from 'slash-create';

export const enumStringsToChoice = (e: Map<number, string>): ApplicationCommandOptionChoice[] =>
  Array.from(e.entries())
    .sort((a, b) => a[0] - b[0])
    .map((e) => ({ name: e[1], value: e[0].toString() }));

export const getPrimaryGuild = (): Promise<Guild> =>
  client.guilds.fetch(process.env.PRIMARY_GUILD_ID!);

export const getAnnoucementsChannel = (): Promise<Channel> =>
  client.channels.fetch(process.env.ANNOUNCEMENTS_CHANNEL_ID!);

export const getUpdatesChannel = (): Promise<Channel> =>
  client.channels.fetch(process.env.UPDATES_CHANNEL_ID!);

export const getGeneralChannel = (): Promise<Channel> =>
  client.channels.fetch(process.env.GENERAL_CHANNEL_ID!);

export const getRedisConnection = (): ConnectionOptions => ({
  host: process.env.REDIS_HOST!,
  port: Number.parseInt(process.env.REDIS_PORT!, 10),
  db: process.env.REDIS_DB ? Number.parseInt(process.env.REDIS_DB!, 10) : 0,
  password: process.env.REDIS_PASSWORD,
});
