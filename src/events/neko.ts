import { ChannelType } from "discord.js";
import type { ArgsOf } from "discordx";
import { Discord, Guard, On } from "discordx";
import { getGeneralChannel, MentionsBot } from "../util.js";

const mentionedResponses = [
  "nyes?",
  "hewwo~",
  "oww, that was loud >_<",
  "your friendly robot neko, at your service :3",
  "nya?!",
  "huh?",
  "*runs with toast in mouth*",
  "how are nyu?",
  "hai!",
  "gmeow~",
];

@Discord()
class Neko {
  @On({
    event: "messageCreate",
  })
  @Guard(MentionsBot)
  async onMention([message]: ArgsOf<"messageCreate">) {
    message.reply(
      mentionedResponses[Math.floor(Math.random() * mentionedResponses.length)]
    );
  }

  @On({
    event: "guildMemberAdd",
  })
  async onJoin([member]: ArgsOf<"guildMemberAdd">) {
    const generalChannel = await getGeneralChannel();

    if (generalChannel?.type !== ChannelType.GuildText) {
      throw new Error("General channel is not a text channel.");
    }

    await generalChannel.send(
      `Heya~ ${member.displayName}! Welcome to the Fyra Discord, we're the home of products such as tauOS: the next generation, friendly, and private operating system. Our server is also a chill place to talk tech and hangout. If you have any questions, feel free to ask! :3`
    );
    await generalChannel.send(
      `By the way, my name is Raboneko, Fyra's virtual neko assistant, *nya~* It's a pleasure to meet nyu, and I hope you have a great time here as well ^_^`
    );
  }
}
