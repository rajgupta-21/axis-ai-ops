import type { Response } from "express";
import { AppError } from "./errors";
import { logger } from "./logger";

export function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
}

/**
 * A successful response that is nevertheless incomplete — the request was
 * served, but from a fallback rather than the intended source.
 *
 * This exists so a partial outage does not have to be reported as a failure.
 * When the Ansible control node is unreachable the fleet is still known from
 * Postgres, and answering 200 with the last known state plus an explanation is
 * far more useful than a 500 that renders no dashboard at all. Clients that
 * ignore `warning` still get valid data, so adding it breaks nothing.
 */
export function okWithWarning<T>(res: Response, data: T, warning: string, status = 200) {
  res.status(status).json({ success: true, data, warning });
}

export function fail(res: Response, code: string, message: string, status = 500) {
  res.status(status).json({ success: false, error: { code, message } });
}

/**
 * Converts any error thrown by a service into a controlled API response.
 * Never leaks internal stack traces or credentials.
 */
export function handleApiError(res: Response, error: unknown) {
  if (error instanceof AppError) {
    // An AppError is a known, described failure — a missing server, a refused
    // collection. Audited at warn: it is the expected shape of something going
    // wrong, not evidence of a defect.
    logger.warn("http", error.message, {
      event: `error.${error.code.toLowerCase()}`,
      statusCode: error.status,
      context: { code: error.code },
      error,
    });
    fail(res, error.code, error.message, error.status);
    return;
  }

  // Anything else is unhandled, and the response deliberately says nothing
  // about it. The stack has to be recorded somewhere or the only account of the
  // failure is a generic 500 — which is exactly the gap the Logs page closes.
  logger.error("http", "Unhandled error while serving a request.", {
    event: "error.unhandled",
    statusCode: 500,
    error,
  });
  fail(res, "INTERNAL_ERROR", "An unexpected error occurred.", 500);
}
