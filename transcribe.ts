import "@std/dotenv/load";
import { mistral, MistralTranscriptionModelOptions } from "@ai-sdk/mistral";
import { transcribe } from "ai";

const out = await transcribe({
  model: mistral.transcription("voxtral-mini-latest"),
  audio: await Deno.readFile("output-0.wav"),
  providerOptions: {
    mistral: {
      timestampGranularities: ["segment"],
    } satisfies MistralTranscriptionModelOptions,
  },
});
