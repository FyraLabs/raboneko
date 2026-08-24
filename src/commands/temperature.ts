import { CommandContext, CommandOptionType, SlashCommand, SlashCreator } from 'slash-create';
import { convertFromCelsius, convertToCelsius, formatTemperatureUnit, TemperatureUnit } from '../util.ts';

const unitChoices = [
  { name: 'Celsius', value: TemperatureUnit.Celsius },
  { name: 'Fahrenheit', value: TemperatureUnit.Fahrenheit },
  { name: 'Kelvin', value: TemperatureUnit.Kelvin },
];

export class Temperature extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'temperature',
      description: 'Convert a temperature between Celsius, Fahrenheit, and Kelvin',
      deferEphemeral: true,
      options: [
        {
          type: CommandOptionType.NUMBER,
          name: 'value',
          description: 'The temperature value to convert',
          required: true,
        },
        {
          type: CommandOptionType.STRING,
          name: 'from',
          description: 'The unit to convert from',
          required: true,
          choices: unitChoices,
        },
        {
          type: CommandOptionType.STRING,
          name: 'to',
          description: 'The unit to convert to',
          required: false,
          choices: unitChoices,
        },
      ],
    });
  }

  public async run(ctx: CommandContext): Promise<void> {
    const value = ctx.options.value as number;
    const from = ctx.options.from as TemperatureUnit;

    // I wanted to make the to value optional, but I wanted Celsius to convert to Fahrenheit and Fahrenheit/Kelvin to convert to Celsius by default.
    // Is this stupid?
    let to: TemperatureUnit;
    if (ctx.options.to) {
      to = ctx.options.to as TemperatureUnit;
    } else if (from === TemperatureUnit.Celsius) {
      to = TemperatureUnit.Fahrenheit;
    } else {
      to = TemperatureUnit.Celsius;
    }

    if (to === from) {
      await ctx.sendFollowUp(
        `Nyu~ it's already in ${formatTemperatureUnit(to, true)}! Did you think I wouldn't notice? :3`,
      );
      return;
    }

    const celsius = convertToCelsius(value, from);
    if (celsius < -273.15) {
      await ctx.sendFollowUp(
        "Nyu~ that temperature is below absolute zero, which is physically impossible! :<",
      );
      return;
    }

    const result = convertFromCelsius(celsius, to);

    // Avoid floating point artifacts like 32.00000000000001
    const prettyResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(2));

    await ctx.send(`${value}${from} is ${prettyResult}${to}`);
  }
}
