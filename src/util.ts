import { Channel, Guild } from "discord.js";
import client from "./client.ts";
import { ConnectionOptions } from "bullmq";
import { ApplicationCommandOptionChoice } from "slash-create";
import { Message } from "discord.js";

// Why? Because throw expressions don't exist yet. One can wish... https://github.com/tc39/proposal-throw-expressions
export const throwError = (message: string): never => {
  throw new Error(message);
};

export const enumStringsToChoice = (
  e: Map<number, string>,
): ApplicationCommandOptionChoice[] =>
  Array.from(e.entries())
    .sort((a, b) => a[0] - b[0])
    .map((e) => ({ name: e[1], value: e[0].toString() }));

export const getPrimaryGuild = (): Promise<Guild> =>
  client.guilds.fetch(process.env.PRIMARY_GUILD_ID!);

export const getAnnoucementsChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.ANNOUNCEMENTS_CHANNEL_ID!)) ??
    throwError("Announcements channel not found");

export const getUpdatesChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.UPDATES_CHANNEL_ID!)) ??
    throwError("Updates channel not found");

export const getGeneralChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.GENERAL_CHANNEL_ID!)) ??
    throwError("General channel not found");

export const getLoggingChannel = async (): Promise<Channel> =>
  (await client.channels.fetch(process.env.LOGGING_CHANNEL_ID!)) ??
    throwError("Logging channel not found");

export const getRedisConnection = (): ConnectionOptions => ({
  host: process.env.REDIS_HOST!,
  port: Number.parseInt(process.env.REDIS_PORT!, 10),
  db: process.env.REDIS_DB ? Number.parseInt(process.env.REDIS_DB!, 10) : 0,
  password: process.env.REDIS_PASSWORD,
});

export const containsWord = (msg: Message, word: string): boolean => {
  const matches = msg.content.match(new RegExp(`\\b${word}\\b`, "i"));
  return matches != null && matches.length > 0;
};

export const userURL = (id: string) => `https://discord.com/users/${id}`;

export const enum TemperatureUnit {
  Celsius = 'ºC',
  Fahrenheit = 'ºF',
  Kelvin = 'K',
}

export const formatTemperatureUnit = (unit: TemperatureUnit, long = false): string => {
  if (!long) return unit;
  switch (unit) {
    case TemperatureUnit.Celsius:
      return 'Celsius';
    case TemperatureUnit.Fahrenheit:
      return 'Fahrenheit';
    case TemperatureUnit.Kelvin:
      return 'Kelvin';
  }
};

export const convertFromCelsius = (celsius: number, to: TemperatureUnit): number => {
  switch (to) {
    case TemperatureUnit.Celsius:
      return celsius;
    case TemperatureUnit.Fahrenheit:
      return celsius * (9 / 5) + 32;
    case TemperatureUnit.Kelvin:
      return celsius + 273.15;
  }
};

export const convertToCelsius = (value: number, from: TemperatureUnit): number => {
  switch (from) {
    case TemperatureUnit.Celsius:
      return value;
    case TemperatureUnit.Fahrenheit:
      return (value - 32) * (5 / 9);
    case TemperatureUnit.Kelvin:
      return value - 273.15;
  }
};
