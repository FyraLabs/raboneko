// `/cute` - Generates a password
//
// funnily enough, this is a real password generator,
// we just called it /cute because bottoms tend to be very
// good human password generators IRL
import { CommandContext, CommandOptionType, SlashCommand, SlashCreator } from 'slash-create';
import Crypto from 'crypto';
function pwgen(length = 32, special_chars = true, numerals = true, capitals = true): string {
  let chars = 'abcdefghijklmnopqrstuvwxyz';
  if (capitals) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numerals) chars += '0123456789';
  if (special_chars) chars += '!@#$%^&*()-_=+[]{}|;:,.<>?';

  let password = '';

  password = Array.from(Crypto.randomBytes(length))
    .map((byte) => chars[byte % chars.length])
    .join('');
  return password;
}

export class Pwgen extends SlashCommand {
  public constructor(creator: SlashCreator) {
    super(creator, {
      name: 'cute',
      description: 'Generates a password',
      deferEphemeral: true,
      options: [
        {
          type: CommandOptionType.INTEGER,
          name: 'length',
          description: 'Length of the password',
          required: false,
          min_value: 4,
          max_value: 128,
        },
        {
          type: CommandOptionType.BOOLEAN,
          name: 'special_chars',
          description: 'Include special characters',
          required: false,
        },
        {
          type: CommandOptionType.BOOLEAN,
          name: 'numerals',
          description: 'Include numerals',
          required: false,
        },
        {
          type: CommandOptionType.BOOLEAN,
          name: 'capitals',
          description: 'Include capital letters',
          required: false,
        },
      ],
    });
  }
  public async run(ctx: CommandContext): Promise<void> {
    const length = ctx.options.length ?? 32;
    const special_chars = ctx.options.special_chars ?? true;
    const numerals = ctx.options.numerals ?? true;
    const capitals = ctx.options.capitals ?? true;

    const password = pwgen(length, special_chars, numerals, capitals);

    await ctx.sendFollowUp(`awawawa! >///<\n\`${password}\``);
  }
}
