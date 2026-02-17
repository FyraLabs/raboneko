import { $ } from 'bun';
import client from '../client';
import { Events } from 'discord.js';

client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === message.client.user.id) return;

  const matches = await Promise.all(
    Array.from(message.content.matchAll(/```tex\n([^]+)\n```/gm)).map(([, m]) =>
      $`utftex < ${new TextEncoder().encode(m)}`.text(),
    ),
  );

  if (matches.length === 0) return;

  await message.reply({
    content: matches.map((m) => '```\n' + m + '\n```').join('\n'),
    allowedMentions: { repliedUser: false, parse: [] },
  });
});
