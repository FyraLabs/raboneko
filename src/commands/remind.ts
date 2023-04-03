import { CommandContext, CommandOptionType, SlashCommand, SlashCreator } from 'slash-create';
import parse from 'parse-duration';
import { client as raboneko } from '../';
import { client } from '../prisma';
import { Message, TextChannel } from 'discord.js';

export default class Remind extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'remind',
      description: 'All in one command to manager your reminders!',
      dmPermission: false,
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'create',
          description: 'Create a reminder',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'time',
              description: 'The time to remind you in',
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: 'reminder',
              description: 'What to remind you of',
              required: false,
            },
          ],
        },
      ],
    });
  }

  public async run(ctx: CommandContext): Promise<void> {
    // Good grief, what a terrible way to do this.
    switch (ctx.subcommands[0]) {
      case 'create': {
        let options = ctx.options[ctx.subcommands[0]];
        let reminder = options.reminder ?? '...';
        let time = new Date(Date.now() + parse(options.time));
        ctx.sendFollowUp('Creating reminder...').then(async (msg) => {
          let channel = await raboneko.channels.cache.get(msg.channelID).fetch();
          let message: Message;
          if (channel instanceof TextChannel) {
            message = await channel.messages.fetch(msg.id);
          }

          client.reminder
            .create({
              data: {
                userID: ctx.user.id,
                content: reminder,
                time,
                link: message.url,
              },
            })
            .then(() => {
              msg.edit(
                `Alright ${ctx.member.mention}, <t:${(time.getTime() / 1000) | 0}:R>: ${reminder}`,
              );
            });
        });
      }
    }
  }
}
