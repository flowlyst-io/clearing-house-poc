import { getAnthropic, PARSE_MODEL, SUMMARIZE_MODEL } from "./anthropic";

// Provider-agnostic JSON completion. Both API routes call `completeJSON` and get
// back a parsed object matching their schema — the provider (Anthropic direct, or
// OpenRouter's auto-router) is chosen by the LLM_PROVIDER env var. This keeps the
// known-good Anthropic path intact while letting us A/B OpenRouter by flipping one
// env var. Server-only: imported exclusively by app/api routes (keys stay server-side).

export type LlmProvider = "anthropic" | "openrouter";

export function llmProvider(): LlmProvider {
  return process.env.LLM_PROVIDER === "openrouter" ? "openrouter" : "anthropic";
}

/** Fetch-based providers surface HTTP failures as this so classifyError can map them. */
export class LlmHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "LlmHttpError";
    this.status = status;
  }
}

export interface CompleteJSONOptions {
  /** Selects the Anthropic model + whether reasoning is used. */
  kind: "parse" | "summarize";
  system: string;
  user: string;
  /** JSON Schema name (OpenRouter requires one; Anthropic ignores it). */
  schemaName: string;
  /** The JSON Schema object (identical for both providers). */
  schema: Record<string, unknown>;
  maxTokens: number;
  /** Reasoning effort — only sent when present (parse uses "medium"). */
  effort?: "low" | "medium" | "high";
}

export async function completeJSON<T>(opts: CompleteJSONOptions): Promise<T> {
  return llmProvider() === "openrouter"
    ? completeViaOpenRouter<T>(opts)
    : completeViaAnthropic<T>(opts);
}

// ---- Anthropic (direct SDK) — preserves the original call shape ----
async function completeViaAnthropic<T>(opts: CompleteJSONOptions): Promise<T> {
  const { kind, system, user, schema, maxTokens, effort } = opts;
  const client = getAnthropic();
  const model = kind === "parse" ? PARSE_MODEL : SUMMARIZE_MODEL;

  const params: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: {
      format: { type: "json_schema", schema },
      ...(effort ? { effort } : {}),
    },
  };
  // Adaptive thinking pairs with effort (parse); Haiku/summarize supports neither.
  if (effort) params.thinking = { type: "adaptive" };

  const stream = client.messages.stream(
    params as unknown as Parameters<typeof client.messages.stream>[0],
  );
  const message = await stream.finalMessage();
  const block = message.content.find((b) => b.type === "text");
  const raw = block && "text" in block ? block.text : "{}";
  return JSON.parse(raw) as T;
}

// ---- OpenRouter (OpenAI-compatible; auto-router) ----
async function completeViaOpenRouter<T>(opts: CompleteJSONOptions): Promise<T> {
  const { system, user, schemaName, schema, maxTokens, effort } = opts;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (you set LLM_PROVIDER=openrouter).",
    );
  }
  const model = process.env.OPENROUTER_MODEL || "openrouter/auto";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Optional ranking headers (harmless if unused).
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": "Contract Clearinghouse",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
      ...(effort ? { reasoning: { effort } } : {}),
      // With the auto-router this keeps selection to models that actually honor the
      // strict JSON schema — otherwise a routed model could reject response_format.
      provider: { require_parameters: true },
    }),
  });

  if (!res.ok) {
    let msg = `OpenRouter request failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: { message?: string } | string };
      msg =
        (typeof body.error === "string" ? body.error : body.error?.message) || msg;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new LlmHttpError(res.status, msg);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LlmHttpError(502, "OpenRouter returned no content.");
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    // Belt-and-suspenders: if a model fenced the JSON despite response_format,
    // pull the outermost object out and parse that.
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new LlmHttpError(502, "OpenRouter response was not valid JSON.");
  }
}
