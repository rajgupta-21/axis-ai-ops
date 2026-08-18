import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { LOG_LEVELS, type LogCategory, type LogEntry, type LogLevel } from "@/domain/log";

/**
 * Structured, persisted logging.
 *
 * The point of this module is that an operator can answer "is everything
 * working?" from the Logs page instead of from a terminal that scrolled away.
 * That means every notable event has to land in Postgres — but an audit trail
 * must never be able to break the thing it audits, so writing one obeys three
 * rules that shape everything below:
 *
 *   1. It never throws. Every path is wrapped; a logging bug degrades to a
 *      missing line, never a failed request.
 *   2. It never blocks. Entries are queued in memory and flushed in batches on
 *      a timer, so an analysis is never held up waiting on an INSERT.
 *   3. It never recurses. The flush path reports its own failures with
 *      console.error only — logging a database outage into the database would
 *      queue another failing write for every failure.
 *
 * Console output is kept alongside the database write rather than replaced by
 * it: `docker logs` and `npm run dev` are still where you look when the
 * database is the thing that is down.
 */

/** Fields a caller may attach to an entry. All optional. */
export interface LogFields {
  event?: string;
  serverId?: string | null;
  analysisId?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
  context?: Record<string, unknown> | null;
  error?: unknown;
}

interface RequestContext {
  requestId: string;
  method: string;
  path: string;
}

const requestStore = new AsyncLocalStorage<RequestContext>();

/**
 * Runs `fn` with an ambient request identity, so any log written anywhere
 * beneath it is automatically tagged with the request that caused it.
 *
 * This is what makes the trail traceable without threading a logger through
 * every service signature: a failed analysis and the HTTP request that started
 * it share a requestId, and the UI can pull up the whole chain from either end.
 */
export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestStore.run(context, fn);
}

export function currentRequestId(): string | null {
  return requestStore.getStore()?.requestId ?? null;
}

export function newRequestId(): string {
  return randomUUID();
}

/** Entries below this level are neither printed nor stored. */
const MIN_LEVEL: LogLevel = normaliseLevel(process.env.LOG_LEVEL) ?? "info";

/** Set LOG_PERSIST=false to keep console output but stop writing to Postgres. */
const PERSIST = process.env.LOG_PERSIST !== "false";

function normaliseLevel(value: string | undefined): LogLevel | null {
  const candidate = value?.trim().toLowerCase();
  return LOG_LEVELS.includes(candidate as LogLevel) ? (candidate as LogLevel) : null;
}

function meetsThreshold(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(MIN_LEVEL);
}

/**
 * The most recent entries, kept in memory regardless of whether the database
 * write succeeds.
 *
 * This is the answer to the worst case: Postgres is down, so nothing is being
 * persisted, and that outage is precisely when someone opens the Logs page. The
 * buffer lets the page still show what just happened — including the database
 * errors themselves — rather than an empty table that looks like "nothing is
 * running" when the truth is "nothing can be recorded".
 */
const BUFFER_LIMIT = 500;
const buffer: LogEntry[] = [];

/** Entries awaiting their batched INSERT. */
const pending: LogEntry[] = [];
const FLUSH_INTERVAL_MS = 1_000;
const FLUSH_BATCH_SIZE = 50;
/** Bounds memory if the database stays unreachable; oldest queued entries lose. */
const PENDING_LIMIT = 1_000;

let flushTimer: NodeJS.Timeout | null = null;
let flushing = false;
/** Suppresses repeated "could not write logs" noise during a sustained outage. */
let flushFailureReported = false;

export function log(level: LogLevel, category: LogCategory, message: string, fields: LogFields = {}): void {
  try {
    if (!meetsThreshold(level)) return;

    const request = requestStore.getStore();
    const error = fields.error;

    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      event: fields.event ?? `${category}.${level}`,
      message: truncate(message, 4_000),
      requestId: request?.requestId ?? null,
      method: request?.method ?? null,
      path: request?.path ?? null,
      statusCode: fields.statusCode ?? null,
      durationMs: fields.durationMs ?? null,
      serverId: fields.serverId ?? null,
      analysisId: fields.analysisId ?? null,
      context: fields.context ?? null,
      errorStack: error ? truncate(describeError(error), 8_000) : null,
    };

    writeToConsole(entry);

    buffer.push(entry);
    if (buffer.length > BUFFER_LIMIT) buffer.splice(0, buffer.length - BUFFER_LIMIT);

    if (!PERSIST) return;
    pending.push(entry);
    if (pending.length > PENDING_LIMIT) pending.splice(0, pending.length - PENDING_LIMIT);

    if (pending.length >= FLUSH_BATCH_SIZE) {
      void flushLogs();
    } else {
      scheduleFlush();
    }
  } catch {
    // Rule 1. A logger that throws would turn a cosmetic problem into an outage.
  }
}

export const logger = {
  debug: (category: LogCategory, message: string, fields?: LogFields) => log("debug", category, message, fields),
  info: (category: LogCategory, message: string, fields?: LogFields) => log("info", category, message, fields),
  warn: (category: LogCategory, message: string, fields?: LogFields) => log("warn", category, message, fields),
  error: (category: LogCategory, message: string, fields?: LogFields) => log("error", category, message, fields),
};

/** The in-memory tail, newest first — the fallback source for the Logs API. */
export function bufferedLogs(): LogEntry[] {
  return [...buffer].reverse();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushLogs();
  }, FLUSH_INTERVAL_MS);
  // The timer must not be a reason for the process to stay alive on shutdown.
  flushTimer.unref?.();
}

/**
 * Writes everything queued. Safe to call concurrently and safe to await during
 * shutdown, which is the one place the caller genuinely wants to wait.
 */
export async function flushLogs(): Promise<void> {
  if (flushing || pending.length === 0) return;
  flushing = true;

  const batch = pending.splice(0, pending.length);
  try {
    await prisma.activityLog.createMany({
      data: batch.map((entry) => ({
        id: entry.id,
        timestamp: new Date(entry.timestamp),
        level: entry.level,
        category: entry.category,
        event: entry.event,
        message: entry.message,
        requestId: entry.requestId,
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        serverId: entry.serverId,
        analysisId: entry.analysisId,
        context: (entry.context as object) ?? undefined,
        errorStack: entry.errorStack,
      })),
    });
    flushFailureReported = false;
  } catch (error) {
    // Rule 3: console only. The batch is dropped rather than requeued — a
    // database that rejected it once will reject it again, and retrying
    // forever would grow the queue until the process ran out of memory. The
    // entries survive in the ring buffer, which is what the Logs page falls
    // back to in exactly this situation.
    if (!flushFailureReported) {
      flushFailureReported = true;
      const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.error(`[logger] cannot persist activity logs (${batch.length} dropped): ${detail}`);
      console.error("[logger] further failures will be silent until a write succeeds.");
    }
  } finally {
    flushing = false;
    // More arrived while this batch was in flight.
    if (pending.length > 0) scheduleFlush();
  }
}

const LEVEL_TAG: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

function writeToConsole(entry: LogEntry): void {
  const parts = [`[${LEVEL_TAG[entry.level]}]`, `[${entry.category}]`, entry.message];
  if (entry.durationMs !== null) parts.push(`(${entry.durationMs}ms)`);
  const line = parts.join(" ");

  if (entry.level === "error") {
    console.error(line);
    if (entry.errorStack) console.error(entry.errorStack);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}… [truncated]` : value;
}
