import { EmbedBuilder, Events, MessageFlags } from 'discord.js';
import client from '../../client';
import { fetchAttachmentToPcm16k } from './discordAudio';
import { transcribePcm16k } from './moonshine';

let queue: Promise<void> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) {
    return;
  }
  if (!message.flags.has(MessageFlags.IsVoiceMessage)) {
    return;
  }
  const attachment = message.attachments.first();
  if (!attachment) {
    return;
  }

  void runSerialized(async () => {
    try {
      const pcm = await fetchAttachmentToPcm16k(attachment.url);
      const raw = (await transcribePcm16k(pcm)).trim();
      const text = raw.length > 0 ? raw : '_(empty transcript)_';
      const description = text.length > 4096 ? `${text.slice(0, 4093)}...` : text;
      const embed = new EmbedBuilder().setDescription(description).setFooter({
        text: 'This is an automated transcription. It may not 100% reflect the original intent.',
      }).data;
      await message.reply({
        embeds: [embed],
        allowedMentions: { repliedUser: false },
      });
    } catch (err) {
      console.error('[voiceTranscribe]', err);
      try {
        await message.reply({
          content: 'Could not transcribe this voice message.',
          allowedMentions: { repliedUser: false },
        });
      } catch {
        /* ignore */
      }
    }
  });
});
