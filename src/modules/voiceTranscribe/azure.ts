import { createAzure } from "@ai-sdk/azure";
import { transcribe } from "ai";

const azure = createAzure({
  useDeploymentBasedUrls: true,
  apiVersion: '2025-04-01-preview',
})

// Azure deployment name, which does not have to match the underlying model id.
const DEPLOYMENT = process.env.AZURE_TRANSCRIPTION_DEPLOYMENT ??
  "gpt-4o-transcribe";

export function isTranscriberConfigured(): boolean {
  return !!(process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY);
}

export async function transcribeAudio(audio: Uint8Array): Promise<string> {
  const { text } = await transcribe({
    model: azure.transcription(DEPLOYMENT),
    audio,
  });

  return text;
}
