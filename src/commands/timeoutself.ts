import parse from 'parse-duration';
import { CommandContext, CommandOptionType, SlashCommand, SlashCreator } from 'slash-create';
import client from '../client';

export class TimeoutSelf extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'timeoutself',
      description: 'Timeout yourself for a specified amount of time',
      dmPermission: false,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'duration',
          description: 'The duration to timeout yourself for (e.g. 10m, 1h, 2d)',
          required: true,
        },
      ],
    });
  }

  public async run(ctx: CommandContext): Promise<void> {
    const delay = parse(ctx.options.duration);
    if (typeof delay !== 'number') {
      await ctx.sendFollowUp(
        'The time you input is invalid! The format must be something along the lines of `1h30m25s`.',
      );
      return;
    }

    const guild = await client.guilds.fetch(ctx.guildID!);
    const member = await guild.members.fetch(ctx.member!.id);

    const time = new Date(Date.now() + delay);

    await member.timeout(delay, 'Self-timeout via Raboneko');
    await ctx.sendFollowUp(
      `You have been self-timedout for <t:${Math.trunc(time.getTime() / 1000)}:R> `,
    );
  }
}
