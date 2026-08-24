import { EmbedBuilder, Events, MessageFlags } from "discord.js";
import client from "../../client.ts";
import { fetchAttachment, MAX_AUDIO_BYTES } from "./discordAudio.ts";
import { isTranscriberConfigured, transcribeAudio } from "./azure.ts";

if (!isTranscriberConfigured()) {
  console.warn(
    "[voiceTranscribe] AZURE_RESOURCE_NAME/AZURE_API_KEY are unset, voice transcription is disabled.",
  );
}

client.on(Events.MessageCreate, async (message) => {
  if (!isTranscriberConfigured()) {
    return;
  }
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
  if (attachment.size > MAX_AUDIO_BYTES) {
    return;
  }

  try {
    const audio = await fetchAttachment(attachment.url);
    const raw = (await transcribeAudio(audio)).trim();
    const text = raw.length > 0 ? raw : "_(empty transcript)_";
    const description = text.length > 4096 ? `${text.slice(0, 4093)}...` : text;
    const embed = new EmbedBuilder().setDescription(description).setFooter({
      text:
        "This is an automated transcription. It may not 100% reflect the original intent.",
    }).data;
    await message.reply({
      embeds: [embed],
      allowedMentions: { repliedUser: false },
    });
  } catch (err) {
    console.error("[voiceTranscribe]", err);
    await message.reply({
      content: "Could not transcribe this voice message.",
      allowedMentions: { repliedUser: false },
    });
  }
});
