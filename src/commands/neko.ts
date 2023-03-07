import { ApplicationCommandOptionType, CommandInteraction } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

const headpatResponses = [
  "nya!",
  "*purrrr*",
  "mew~",
  "Hehe, thanks!",
  "more headpats, pwease~",
];

@Discord()
export class Neko {
  @Slash({
    description: "Ping me!",
  })
  ping(interaction: CommandInteraction): void {
    interaction.reply("Pong! ^._.^");
  }

  @Slash({
    description: "Shameless plug ;)",
  })
  onegrid(interaction: CommandInteraction): void {
    interaction.reply("The one in the grid. https://onegr.id");
  }

  @Slash({
    description: "Give me headpats!",
  })
  headpat(interaction: CommandInteraction): void {
    interaction.reply(
      headpatResponses[Math.floor(Math.random() * headpatResponses.length)]
    );
  }

  @Slash({
    description: "Report an HR issue",
  })
  hr(
    @SlashOption({
      name: "report",
      description: "The issue you're reporting",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    _report: string,
    interaction: CommandInteraction
  ): void {
    interaction.reply(
      "Thank nyu for reporting this issue! After extensive investigation, we've detewminyed that you should go seek thewapy. nya~"
    );
  }
}
