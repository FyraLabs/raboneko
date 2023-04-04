import dotenv from 'dotenv';
import { GatewayServer } from 'slash-create';
import { GatewayDispatchEvents } from 'discord.js';
import path from 'path';
import CatLoggr from 'cat-loggr/ts';
import client from './client';
import './scheduler';
import RaboSlashCreator from './creator';
import * as http from 'http';

let dotenvPath = path.join(process.cwd(), '.env');
if (path.parse(process.cwd()).name === 'dist') dotenvPath = path.join(process.cwd(), '..', '.env');

dotenv.config({ path: dotenvPath });

const logger = new CatLoggr().setLevel(process.env.COMMANDS_DEBUG === 'true' ? 'debug' : 'info');
const creator = new RaboSlashCreator({
  applicationID: process.env.DISCORD_APP_ID,
  publicKey: process.env.DISCORD_PUBLIC_KEY,
  token: process.env.DISCORD_BOT_TOKEN,
  client,
});

creator.on('debug', (message) => logger.log(message));
creator.on('warn', (message) => logger.warn(message));
creator.on('error', (error) => logger.error(error));
creator.on('synced', () => logger.info('Commands synced!'));
creator.on('commandRun', (command, _, ctx) =>
  logger.info(
    `${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran command ${command.commandName}`,
  ),
);
creator.on('commandRegister', (command) =>
  logger.info(`Registered command ${command.commandName}`),
);
creator.on('commandError', (command, error) =>
  logger.error(`Command ${command.commandName}:`, error),
);

creator
  .withServer(
    new GatewayServer((handler) => client.ws.on(GatewayDispatchEvents.InteractionCreate, handler)),
  )
  .registerCommandsIn(path.join(__dirname, 'commands'))
  .syncCommands();

http
  .createServer((_, res) => {
    res.writeHead(200);
    res.end();
  })
  .listen(process.env.HEALTH_PORT);

client.login(process.env.DISCORD_BOT_TOKEN);

import './modules/ping';
import './modules/guildMemberAdd';
