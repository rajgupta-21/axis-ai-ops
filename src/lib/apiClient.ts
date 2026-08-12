export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
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
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await response.json();

  if (!response.ok || !body.success) {
    throw new ApiError(
      body?.error?.code ?? "UNKNOWN_ERROR",
      body?.error?.message ?? "The request could not be completed.",
      response.status
    );
  }

  return body.data as T;
}
