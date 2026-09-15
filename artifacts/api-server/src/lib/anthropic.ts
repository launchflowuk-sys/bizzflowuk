/**
 * The one place this app talks to Claude.
 *
 * Extracted from the Flo route when a second feature needed it. The key
 * handling, the workspace header and — most of all — the honest error
 * messages took a real outage to get right, and a copy-paste of them would
 * have drifted the first time one was fixed.
 */

export const CLAUDE_MODEL = "claude-sonnet-5";

/** Thrown when the model cannot be reached. `permanent` means retrying is pointless. */
export class ClaudeError extends Error {
  readonly status: number;
  readonly permanent: boolean;
  constructor(message: string, status: number, permanent: boolean) {
    super(message);
    this.name = "ClaudeError";
    this.status = status;
    this.permanent = permanent;
  }
}

export function claudeConfigured(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

export type ClaudeCall = {
  system: string;
  user: string;
  maxTokens?: number;
  /** Puts words in Claude's mouth to force the shape of the reply, e.g. "[". */
  prefill?: string;
};

export type ClaudeResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
};

export async function callClaude(call: ClaudeCall): Promise<ClaudeResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new ClaudeError("This feature is not switched on yet.", 503, true);
  }

  const messages: Array<{ role: string; content: string }> = [{ role: "user", content: call.user }];
  if (call.prefill) messages.push({ role: "assistant", content: call.prefill });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      /**
       * An organisation-level key is not tied to a workspace, and Anthropic
       * rejects it with a 400 unless the workspace is named explicitly:
       *
       *   "This API key is not scoped to a workspace, so this request must
       *    include the anthropic-workspace-id header"
       *
       * A key created inside a workspace needs none of this, which is the
       * simpler setup. This header exists so an org-level key also works
       * rather than the feature being dead until somebody reissues the key.
       */
      ...(process.env["ANTHROPIC_WORKSPACE_ID"]
        ? { "anthropic-workspace-id": process.env["ANTHROPIC_WORKSPACE_ID"] }
        : {}),
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: call.maxTokens ?? 1500,
      system: call.system,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    /**
     * "Try again" is the wrong thing to say about a 4xx.
     *
     * A bad key, an unscoped key or a disabled model fails identically on
     * every retry, so telling the owner to try again sends them round a loop
     * we know cannot end — and makes a fault at our end look like one at
     * theirs. 429 is the exception: rate limiting genuinely does clear.
     */
    const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
    throw new ClaudeError(
      permanent
        ? "This is not set up correctly on our side yet. Nothing is wrong with your account, and retrying will not help — we have been told about it."
        : "Could not reach the assistant just now. Please try again.",
      response.status,
      permanent,
    );
  }

  const payload = await response.json() as any;
  const text = (payload?.content ?? [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");

  return {
    text: call.prefill ? call.prefill + text : text,
    inputTokens: payload?.usage?.input_tokens,
    outputTokens: payload?.usage?.output_tokens,
  };
}

/**
 * Pull JSON out of a reply that may be wrapped in a code fence or prose.
 *
 * The model is asked for bare JSON and usually obliges. A stray fence should
 * degrade to a working answer rather than an error page.
 */
export function parseJsonReply<T>(text: string): T | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned) as T; } catch { /* fall through */ }

  const first = cleaned.search(/[[{]/);
  const last = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (first >= 0 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)) as T; } catch { /* give up */ }
  }
  return null;
}
