import "@std/dotenv/load";
import { createAzure } from "@ai-sdk/azure";
import { transcribe } from "ai";

const azure = createAzure({
  useDeploymentBasedUrls: true,
  apiVersion: "2025-04-01-preview",
});

const out = await transcribe({
  model: azure.transcription("whisper"),
  audio: await Deno.readFile("output-0.webm"),
  providerOptions: {
    openai: {
      timestampGranularities: ["segment"],
    },
  },
});

console.log(out);
