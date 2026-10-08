import { CommandContext, SlashCommand, SlashCreator } from "slash-create/web";
import { CommandOptionType } from "slash-create";
import { getModeratorsChannel } from "../util.ts";
import { EmbedBuilder } from "discord.js";

export class Modmail extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: "modmail",
      description: "Send a private message to the moderators",
      deferEphemeral: true,
      options: [
        {
          type: CommandOptionType.STRING,
          name: "message",
          description: "The message to send",
          max_length: 1000,
          required: true,
        },
      ],
    });
  }

  public override async run(ctx: CommandContext): Promise<void> {
    const moderatorsChannel = await getModeratorsChannel();
    if (!moderatorsChannel.isSendable()) {
      throw new Error("Moderators channel is not sendable");
    }

    const embed = new EmbedBuilder().setTitle("New Modmail~")
      .setDescription(ctx.options.message)
      .setAuthor({
        name: ctx.member?.displayName ?? ctx.user.globalName ??
          ctx.user.username,
        iconURL: ctx.member?.avatarURL ?? ctx.user.avatarURL,
        url: `https://discord.com/users/${ctx.user.id}`,
      });
    await moderatorsChannel.send({
      embeds: [embed],
      allowedMentions: {
        parse: [],
      },
    });

    await ctx.sendFollowUp(
      "Thank nyu! I ran over to the moderators and delivered your message~",
    );
  }
}
