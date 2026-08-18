import { Router } from "express";
import { handleApiError, ok, okWithWarning } from "@/lib/apiResponse";
import { getLogStats, listLogs, listLogsByRequestId, purgeLogs } from "@/repositories/logRepository";
import { LOG_CATEGORIES, LOG_LEVELS, type LogCategory, type LogLevel } from "@/domain/log";
import { logger } from "@/lib/logger";

export const logsRouter = Router();

/**
 * Lists audit entries, newest first.
 *
 * Answers with 200 even when the database could not be read: the repository
 * falls back to the in-memory buffer and reports `degraded`, which is surfaced
 * as a warning rather than an error. Someone opening this page during a
 * database outage needs to see the outage, not inherit it.
 */
logsRouter.get("/", async (req, res) => {
  try {
    const page = await listLogs({
      level: parseEnum(req.query.level, LOG_LEVELS),
      category: parseEnum(req.query.category, LOG_CATEGORIES),
      search: parseString(req.query.search),
      requestId: parseString(req.query.requestId),
      serverId: parseString(req.query.serverId),
      since: parseString(req.query.since),
      cursor: parseString(req.query.cursor),
      limit: Number(req.query.limit) || undefined,
    });

    if (page.degraded) {
      okWithWarning(
        res,
        page,
        "The log database could not be read, so only this process's recent in-memory entries are shown. They are not persisted."
      );
      return;
    }

    ok(res, page);
  } catch (error) {
    handleApiError(res, error);
  }
});

/** Aggregate counts for the summary cards. Kept ahead of no dynamic route, but ordered first for clarity. */
logsRouter.get("/stats", async (_req, res) => {
  try {
    ok(res, await getLogStats());
  } catch (error) {
    handleApiError(res, error);
  }
});

/**
 * Every entry sharing one requestId, oldest first.
 *
 * This is the view that turns a list of lines into an explanation: the HTTP
 * request, the collection it triggered, the model call inside that, and the
 * error that ended it, in the order they happened.
 */
logsRouter.get("/request/:requestId", async (req, res) => {
  try {
    ok(res, await listLogsByRequestId(req.params.requestId));
  } catch (error) {
    handleApiError(res, error);
  }
});

/**
 * Trims the audit trail. `olderThanDays=0` clears it entirely.
 *
 * Defaults to 30 rather than 0 on purpose: an operator who calls this with no
 * arguments almost certainly means "tidy up", and the reading of that which
 * destroys the least history is the right default.
 */
logsRouter.delete("/", async (req, res) => {
  try {
    const raw = Number(req.query.olderThanDays);
    const olderThanDays = Number.isFinite(raw) && raw >= 0 ? raw : 30;

    const deleted = await purgeLogs(olderThanDays);

    // The purge is itself an audited event — otherwise the one action that can
    // remove evidence would be the one action that leaves none.
    logger.warn("system", `Purged ${deleted} audit entries older than ${olderThanDays} day(s).`, {
      event: "logs.purged",
      context: { deleted, olderThanDays },
    });

    ok(res, { deleted, olderThanDays });
  } catch (error) {
    handleApiError(res, error);
  }
});

function parseEnum<T extends string>(value: unknown, allowed: T[]): T | undefined {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

function parseString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

// Re-exported so the route module is the single import site for log typing in
// tests and scripts.
export type { LogCategory, LogLevel };
