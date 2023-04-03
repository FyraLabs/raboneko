import { SlashCommand, SlashCreator } from 'slash-create';
import { getFiles } from 'slash-create/lib/util';
import path from 'path';

export default class RaboSlashCreator extends SlashCreator {
  // Currently, the SlashCreator's implementation of loading commands takes the
  // default export of a module and no more. However, since Raboneko's legacy
  // codebase uses DiscordX, which allows for registering multiple commands on
  // a single class, we definitely don't want to create a separate module for
  // every command it has, especially considering there are three commands that
  // are just simple text responses. So, override the command loading
  // implementation to check if there is either a default export or multiple
  // exports, and load them based on that.
  public registerCommandsIn(commandPath: string, customExtensions: string[] = []): this {
    const extensions = ['.js', '.cjs', ...customExtensions];
    const paths = getFiles(commandPath).filter((file) => extensions.includes(path.extname(file)));
    const commands: any[] = [];
    for (const filePath of paths) {
      try {
        // commands.push(require(filePath));
        const mod = require(filePath);
        if (mod.prototype instanceof SlashCommand) {
          commands.push(mod);
        } else {
          for (const cmd of Object.values(mod).filter(
            (v) =>
              typeof v === 'function' && 'prototype' in v && v.prototype instanceof SlashCommand,
          )) {
            commands.push(cmd);
          }
        }
      } catch (e) {
        this.emit('error', new Error(`Failed to load command ${filePath}: ${e}`));
      }
    }
    return this.registerCommands(commands, true);
  }
}
