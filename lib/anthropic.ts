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
  if (!client)
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Ride through brief overloads (529) / rate limits (429) / 5xx with the
      // SDK's exponential backoff before the graceful-failure path ever shows.
      // Capped at 3 so a sustained outage still fails reasonably fast.
      maxRetries: 3,
    });
  return client;
}

// Contract parsing runs on Sonnet 4.6 — faster and cheaper for the long,
// whole-contract extraction. Supports the same call shape (adaptive thinking,
// output_config effort, structured outputs).
export const PARSE_MODEL = "claude-sonnet-4-6";

// Summaries run on Haiku 4.5 — a one-line synthesis, so the cheapest tier is fine.
// NOTE: Haiku 4.5 does NOT support `effort` or adaptive `thinking` (both 400);
// it DOES support structured outputs, which is all the summarize route needs.
export const SUMMARIZE_MODEL = "claude-haiku-4-5";
