import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";

const headpatResponses = ["nya!", "*purrrr*", "mew~", "Hehe, thanks!"];

@Discord()
export class Neko {
  @Slash()
  ping(interaction: CommandInteraction): void {
    interaction.reply("Pong! ^._.^");
  }

  @Slash()
  headpat(interaction: CommandInteraction): void {
    interaction.reply(
      headpatResponses[Math.floor(Math.random() * headpatResponses.length)]
    );
  }
}
