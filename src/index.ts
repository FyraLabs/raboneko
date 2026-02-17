import path from 'path';
import './sentry';
import { GatewayServer } from 'slash-create';
import { GatewayDispatchEvents } from 'discord.js';
import CatLoggr from 'cat-loggr/ts';
import client from './client';
import './scheduler';
import RaboSlashCreator from './creator';
import * as http from 'http';

const logger = new CatLoggr().setLevel(process.env.COMMANDS_DEBUG === 'true' ? 'debug' : 'info');
const creator = new RaboSlashCreator({
  applicationID: process.env.DISCORD_APP_ID!,
  publicKey: process.env.DISCORD_PUBLIC_KEY!,
  token: process.env.DISCORD_BOT_TOKEN!,
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

http
  .createServer((_, res) => {
    res.writeHead(200);
    res.end();
  })
  .listen(process.env.HEALTH_PORT);

(async () => {
  await creator
    .withServer(
      new GatewayServer((handler) =>
        client.ws.on(GatewayDispatchEvents.InteractionCreate, handler),
      ),
    )
    .registerCommandsIn(path.join(__dirname, 'commands'));

  await creator.syncCommands();

  await client.login(process.env.DISCORD_BOT_TOKEN);
})();

import './modules/ping';
import './modules/guildMemberAdd';
import './modules/funAI';
import './modules/cutefishInfo';
import './modules/support';
import './modules/logger';
// import './modules/tex'; disabled for now
import './modules/wraps';
