export function isRateLimitError(message: string): boolean {
  return /\b429\b|rate limit|too many requests|rate_limit_exceeded/i.test(message);
}

/**
 * Providers often state exactly how long to wait ("Please try again in 4.2s").
 * Honouring that is far better than a blind backoff: it avoids both retrying
 * too early (wasting an attempt and more quota) and waiting far longer than
 * necessary.
 */
function retryAfterMs(message: string): number | null {
  const seconds = /try again in ([\d.]+)\s*s/i.exec(message);
  if (seconds) return Math.ceil(Number(seconds[1]) * 1000);

  const ms = /try again in ([\d.]+)\s*ms/i.exec(message);
  if (ms) return Math.ceil(Number(ms[1]));

  return null;
}

export interface RateLimitRetryOptions {
  /** Shown in the warning log so it is clear which call is being throttled. */
  label: string;
  attempts?: number;
  /** Never wait longer than this for a single retry. */
  maxDelayMs?: number;
  onRetry?: (delayMs: number, attempt: number) => void;
}

/**
 * Retries a call only when it fails due to rate limiting.
 *
 * Free LLM tiers cap tokens per minute, and this agent makes several model
 * calls per analysis — one analysis can approach the whole per-minute budget,
 * so brief throttling is expected rather than exceptional. Other errors fail
 * fast: retrying a malformed request just burns quota.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, options: RateLimitRetryOptions): Promise<T> {
  const { label, attempts = 4, maxDelayMs = 30_000, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!isRateLimitError(message) || attempt === attempts - 1) throw error;

      const suggested = retryAfterMs(message);
      const backoff = 2000 * 2 ** attempt;
      // Jitter keeps concurrent callers from retrying in lockstep.
      const delayMs = Math.min(suggested ?? backoff, maxDelayMs) + Math.floor(Math.random() * 400);

      onRetry?.(delayMs, attempt + 1);
      console.warn(`[rate-limit] ${label}: throttled, retrying in ${delayMs}ms (attempt ${attempt + 2}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
