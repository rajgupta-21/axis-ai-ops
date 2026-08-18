/**
 * The API URL as the *browser* must see it. Used for links the browser follows
 * itself — the PDF download hrefs — and as the fallback for server-side fetches.
 *
 * NEXT_PUBLIC_ variables are inlined into the client bundle at build time, so
 * this value is fixed when the image is built, not when the container starts.
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

/**
 * The API URL this process should fetch from, which is not always the one above.
 *
 * Server Components and Client Components run the same `apiFetch` code in two
 * different places, and under Docker those two places reach the backend by
 * different names. The browser can only use the published host port
 * (http://localhost:4000); a Server Component running inside the frontend
 * container must use the compose service name (http://backend:4000), because
 * its own localhost is that container, where nothing is listening.
 *
 * Outside Docker, INTERNAL_API_BASE_URL is unset and both paths collapse to the
 * public URL — the existing local-development behaviour, unchanged.
 */
function getFetchBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_BASE_URL ?? getApiBaseUrl();
  }
  return getApiBaseUrl();
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Calls the Express backend REST API and unwraps the { success, data }
 * envelope. The browser and Next.js server components both call the
 * backend directly (fully decoupled, CORS-enabled) rather than going
 * through any Next.js API layer.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await apiFetchSafe<T>(path, init);
  if (!result.ok) throw result.error;
  return result.data;
}

/**
 * The outcome of a request as a value: either the data, or the reason it could
 * not be fetched. Never a thrown exception.
 */
export type FetchResult<T> =
  | { ok: true; data: T; warning: string | null }
  | { ok: false; error: ApiError };

/**
 * Like apiFetch, but returns failure instead of throwing it.
 *
 * Server Components render by awaiting these calls, so a throw is not a
 * recoverable error — it aborts the whole render. That is why an unreachable
 * Ansible control node, or a stopped database, replaced the entire dashboard
 * with a runtime error screen: one failed request took down the server table,
 * the analysis history, and the risk charts together, even though only the
 * first needed the thing that was broken.
 *
 * Returning a result instead lets each page decide per-section what to do, so a
 * partial outage degrades to a banner over the sections that still work.
 *
 * `warning` carries the backend's `warning` field: the request succeeded, but
 * from a fallback (last known state from the database rather than live
 * inventory). Data is present and valid; it is just not current.
 */
export async function apiFetchSafe<T>(path: string, init?: RequestInit): Promise<FetchResult<T>> {
  const baseUrl = getFetchBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    // No HTTP status at all — the API is not listening, DNS failed, or the
    // connection was refused. Distinguished from a 5xx because the fix is
    // different: start the backend, rather than look at its logs.
    return {
      ok: false,
      error: new ApiError(
        "API_UNREACHABLE",
        `The backend API at ${baseUrl} is not responding. Start it with "npm run dev" in backend/.`,
        0
      ),
    };
  }

  let body: {
    success?: boolean;
    data?: unknown;
    warning?: string;
    error?: { code?: string; message?: string };
  };
  try {
    body = await response.json();
  } catch {
    // A non-JSON body means something other than this API answered — a proxy
    // error page, or an HTML 502. Reporting a JSON parse error would point at
    // the wrong problem.
    return {
      ok: false,
      error: new ApiError(
        "INVALID_RESPONSE",
        `The backend returned a non-JSON response (HTTP ${response.status}).`,
        response.status
      ),
    };
  }

  if (!response.ok || !body.success) {
    return {
      ok: false,
      error: new ApiError(
        body?.error?.code ?? "UNKNOWN_ERROR",
        body?.error?.message ?? "The request could not be completed.",
        response.status
      ),
    };
  }

  return { ok: true, data: body.data as T, warning: body.warning ?? null };
}
