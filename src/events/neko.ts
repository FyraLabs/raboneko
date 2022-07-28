import { ArgsOf, Discord, Guard, On } from "discordx";
import { MentionsBot } from "../util.js";

const mentionedResponses = [
  "nyes?",
  "hewwo~",
  "oww, that was loud >_<",
  "your friendly robot neko, at your service :3",
  "nya?!",
  "huh?",
  "*runs with toast in mouth*",
  "how are nyu?",
];

@Discord()
class Neko {
  @On("messageCreate")
  @Guard(MentionsBot)
  async onMention([message]: ArgsOf<"messageCreate">) {
    message.reply(
      mentionedResponses[Math.floor(Math.random() * mentionedResponses.length)]
    );
  }
}
