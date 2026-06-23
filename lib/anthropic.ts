import Anthropic from "@anthropic-ai/sdk";

// Server-only. The key lives in .env.local and is never sent to the client —
// all model calls go through /api routes (the "thin backend" the README asks for).

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const MODEL = "claude-opus-4-8";
