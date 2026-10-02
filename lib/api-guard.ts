/**
 * Request-level abuse protection for /api/chat (issue #13).
 *
 * Client-provided history is untrusted input: roles are validated (no
 * `system` smuggling), lengths are capped before any embedding/LLM spend,
 * and a sliding-window rate limiter bounds provider burn per client.
 *
 * NOTE: the limiter is in-memory and per-instance. Behind serverless or
 * multi-instance deployments, move it to shared storage (Redis/Upstash).
 */

export interface GuardedMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GuardReject {
  status: number;
  error: string;
}

export interface GuardLimits {
  maxMessageChars: number;
  maxMessages: number;
  maxHistoryChars: number;
}

export function validateChatBody(
  body: unknown,
  limits: GuardLimits
): { messages: GuardedMessage[] } | { reject: GuardReject } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { reject: { status: 400, error: "Request body must be a JSON object." } };
  }
  const { messages, category } = body as { messages?: unknown; category?: unknown };

  if (category !== undefined && (typeof category !== "string" || category.length > 64)) {
    return { reject: { status: 400, error: "Invalid category filter." } };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { reject: { status: 400, error: "No messages provided." } };
  }
  if (messages.length > limits.maxMessages) {
    return {
      reject: {
        status: 413,
        error: `Conversation too long: at most ${limits.maxMessages} messages per request.`,
      },
    };
  }

  const clean: GuardedMessage[] = [];
  let totalChars = 0;
  for (const m of messages) {
    if (!m || typeof m !== "object" || Array.isArray(m)) {
      return { reject: { status: 400, error: "Each message must be an object." } };
    }
    const { role, content } = m as { role?: unknown; content?: unknown };
    // Only user/assistant survive: a client-supplied `system` role (or any
    // other role) must never reach the model as privileged instructions.
    if (role !== "user" && role !== "assistant") {
      return {
        reject: { status: 400, error: "Message role must be 'user' or 'assistant'." },
      };
    }
    if (typeof content !== "string" || content.trim() === "") {
      return { reject: { status: 400, error: "Message content must be a non-empty string." } };
    }
    if (content.length > limits.maxMessageChars) {
      return {
        reject: {
          status: 413,
          error: `Message too long: at most ${limits.maxMessageChars} characters.`,
        },
      };
    }
    totalChars += content.length;
    clean.push({ role, content });
  }

  if (totalChars > limits.maxHistoryChars) {
    return {
      reject: {
        status: 413,
        error: `Conversation too long: at most ${limits.maxHistoryChars} characters of history.`,
      },
    };
  }
  if (!clean.some((m) => m.role === "user")) {
    return { reject: { status: 400, error: "Conversation must contain a user message." } };
  }

  return { messages: clean };
}

export interface RateLimiter {
  check: (key: string, now?: number) => boolean;
}

/** Sliding-window limiter: at most `max` hits per `windowMs` per key. */
export function createRateLimiter(windowMs: number, max: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      // Opportunistic cleanup so the map cannot grow unboundedly.
      if (hits.size > 10000) {
        for (const [k, v] of hits) {
          if (v.length === 0 || v[v.length - 1] <= cutoff) hits.delete(k);
        }
      }
      return true;
    },
  };
}
