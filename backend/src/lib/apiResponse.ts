import type { Response } from "express";
import { AppError } from "./errors";

export function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
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
    fail(res, error.code, error.message, error.status);
    return;
  }

  console.error(error);
  fail(res, "INTERNAL_ERROR", "An unexpected error occurred.", 500);
}
