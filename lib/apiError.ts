import Anthropic from "@anthropic-ai/sdk";

// Turn any thrown error into a clean HTTP response the UI can act on.
// `retryable` tells the client whether to offer a Retry button instead of just
// showing a dead-end message. The messages are written for a non-technical user
// watching the screen — no stack traces, no raw "Overloaded".

export interface ApiErrorBody {
  error: string;
  retryable: boolean;
  code?: string;
}

export function classifyError(err: unknown): {
  status: number;
  body: ApiErrorBody;
} {
  // Network/connection problems reaching Anthropic — worth a retry.
  // Checked before APIError because APIConnectionError extends it.
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      status: 503,
      body: {
        error: "Couldn't reach the AI service. Check the connection and try again.",
        retryable: true,
        code: "connection",
      },
    };
  }

  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 500;

    if (status === 529) {
      return {
        status: 529,
        body: {
          error: "The AI service is briefly busy. Please try again in a moment.",
          retryable: true,
          code: "overloaded",
        },
      };
    }
    if (status === 429) {
      return {
        status: 429,
        body: {
          error: "Too many requests right now. Wait a few seconds and try again.",
          retryable: true,
          code: "rate_limited",
        },
      };
    }
    if (status >= 500) {
      return {
        status,
        body: {
          error: "The AI service had a temporary hiccup. Please try again.",
          retryable: true,
          code: "server_error",
        },
      };
    }
    // 4xx that isn't 429 (bad request, auth, etc.) — retrying won't help.
    return {
      status,
      body: {
        error: err.message || "The request was rejected.",
        retryable: false,
        code: "request_error",
      },
    };
  }

  // OpenRouter (fetch-based) failures arrive as LlmHttpError with an HTTP status.
  // Duck-typed by name to avoid importing lib/llm here.
  if (
    err instanceof Error &&
    err.name === "LlmHttpError" &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    const status = (err as unknown as { status: number }).status;
    const retryable = status === 429 || status >= 500;
    return {
      status,
      body: {
        error: err.message,
        retryable,
        code: retryable ? "server_error" : "request_error",
      },
    };
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  return { status: 500, body: { error: message, retryable: false } };
}
