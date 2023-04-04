import { Client, IntentsBitField } from 'discord.js';

const { Flags } = IntentsBitField;
export default new Client({
  intents: [
    Flags.Guilds,
    Flags.GuildMembers,
    Flags.GuildModeration,
    Flags.GuildEmojisAndStickers,
    Flags.GuildIntegrations,
    Flags.GuildWebhooks,
    Flags.GuildInvites,
    Flags.GuildVoiceStates,
    Flags.GuildPresences,
    Flags.GuildMessages,
    Flags.GuildMessageReactions,
    Flags.GuildMessageTyping,
    Flags.DirectMessages,
    Flags.DirectMessageReactions,
    Flags.DirectMessageTyping,
    Flags.MessageContent,
    Flags.GuildScheduledEvents,
    Flags.AutoModerationConfiguration,
    Flags.AutoModerationExecution,
  ],
});
