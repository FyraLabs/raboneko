import { CommandContext, CommandOptionType, SlashCommand, SlashCreator } from 'slash-create';
import { client } from '../index';

const headpatResponses = ['nya!', '*purrrr*', 'mew~', 'Hehe, thanks!', 'more headpats, pwease~'];

export class Ping extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'ping',
      description: 'Ping me!'
    });
  }

  public async run(ctx: CommandContext) {
    await ctx.sendFollowUp(`Pong! ^._.^, my latency to Discord is \`${client.ws.ping}ms\`!`);
  }
}

export class Headpat extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'headpat',
      description: 'Give me headpats!'
    });
  }

  public async run(ctx: CommandContext) {
    await ctx.sendFollowUp(headpatResponses[Math.floor(Math.random() * headpatResponses.length)]);
  }
}

export class Hr extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'hr',
      description: "The issue you're reporting",
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'report',
          description: "The issue you're reporting",
          required: true
        }
      ]
    });
  }

  public async run(ctx: CommandContext) {
    await ctx.sendFollowUp(
      "Thank nyu for reporting this issue! After extensive investigation, we've detewminyed that you should go seek thewapy. nya~"
    );
  }
}
