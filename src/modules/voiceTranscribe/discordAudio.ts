// The Azure OpenAI transcription endpoint rejects uploads above 25 MiB.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function fetchAttachment(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download attachment (${res.status})`);
  }

  return new Uint8Array(await res.arrayBuffer());
}
