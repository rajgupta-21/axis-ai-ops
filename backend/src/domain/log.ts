/** Severity of an audit entry, ordered from least to most serious. */
export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

/**
 * The subsystem an entry came from.
 *
 * A closed set rather than a free string, because the Logs page turns these
 * into filter buttons: a typo'd category would silently create a bucket nobody
 * ever clicks, which is the failure mode an audit trail can least afford.
 */
export type LogCategory =
  | "system"
  | "http"
  | "database"
  | "cache"
  | "collection"
  | "analysis"
  | "llm"
  | "release"
  | "knowledge"
  | "report"
  | "ansible";

export const LOG_CATEGORIES: LogCategory[] = [
  "system",
  "http",
  "database",
  "cache",
  "collection",
  "analysis",
  "llm",
  "release",
  "knowledge",
  "report",
  "ansible",
];

/** One audit entry, as stored and as served to the UI. */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  /** Machine-readable event name, e.g. "analysis.completed". */
  event: string;
  message: string;
  requestId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  durationMs: number | null;
  serverId: string | null;
  analysisId: string | null;
  context: Record<string, unknown> | null;
  errorStack: string | null;
}

/** Aggregate counts backing the summary cards at the top of the Logs page. */
export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: { category: string; count: number }[];
  /** Requests that returned 5xx in the window, as a quick "is it healthy" signal. */
  errorsLastHour: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
}

export interface LogQuery {
  level?: LogLevel;
  category?: LogCategory;
  search?: string;
  requestId?: string;
  serverId?: string;
  since?: string;
  limit?: number;
  cursor?: string;
}

export interface LogPage {
  entries: LogEntry[];
  /** Pass back as `cursor` to fetch the next (older) page; null when exhausted. */
  nextCursor: string | null;
  /**
   * True when the entries came from the in-memory buffer because the database
   * could not be queried. The list is then short and non-durable, but it is
   * still the most useful thing to show when the database is the outage.
   */
  degraded: boolean;
}
