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

// Default model (used by the summarize route).
export const MODEL = "claude-opus-4-8";

// Contract parsing runs on Sonnet 4.6 — faster and cheaper for the long,
// whole-contract extraction. Supports the same call shape (adaptive thinking,
// output_config effort, structured outputs).
export const PARSE_MODEL = "claude-sonnet-4-6";
