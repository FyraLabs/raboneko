import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from "slash-create";
import client from "../client.ts";

const headpatResponses = [
  "nya!",
  "*purrrr*",
  "mew~",
  "Hehe, thanks!",
  "more headpats, pwease~",
];
const headpatFailThreshold = 0.1;

export class Ping extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: "ping",
      description: "Ping me!",
    });
  }

  public async run(ctx: CommandContext): Promise<void> {
    await ctx.sendFollowUp(
      `Pong! ^._.^, my latency to Discord is \`${client.ws.ping}ms\`!`,
    );
  }
}

export class Headpat extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: "headpat",
      description: "Give me headpats!",
      options: [
        {
          type: CommandOptionType.USER,
          name: "user",
          description: "The user to headpat",
          required: false,
        },
      ],
    });
  }

  public async run(ctx: CommandContext): Promise<void> {
    if (!ctx.options.user) {
      await ctx.sendFollowUp(
        headpatResponses[Math.floor(Math.random() * headpatResponses.length)],
      );
    } else {
      if (Math.random() < headpatFailThreshold) {
        await ctx.sendFollowUp(
          `nyoo, <@${ctx.options.user}> doesn't need headpat nyow~`,
        );
      } else {
        await ctx.send(
          `<@${ctx.options.user}>, *${
            "pat".padStart(Math.floor(Math.random() * 3) * 3, "pat")
          }*`,
        );
      }
    }
  }
}

export class Hr extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: "hr",
      description: "The issue you're reporting",
      options: [
        {
          type: CommandOptionType.STRING,
          name: "report",
          description: "The issue you're reporting",
          required: true,
        },
      ],
    });
  }

  public async run(ctx: CommandContext): Promise<void> {
    await ctx.sendFollowUp(
      "Thank nyu for reporting this issue! After extensive investigation, we've detewminyed that you should go seek thewapy. nya~",
    );
  }
}
