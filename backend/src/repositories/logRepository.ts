import { prisma } from "@/lib/db";
import { bufferedLogs, flushLogs } from "@/lib/logger";
import type { LogCategory, LogEntry, LogLevel, LogPage, LogQuery, LogStats } from "@/domain/log";
import type { ActivityLogModel } from "@/generated/prisma/models/ActivityLog";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Reads a page of audit entries, newest first.
 *
 * Flushes the write queue first so the page reflects what just happened rather
 * than what happened a second ago. Without this, clicking Refresh immediately
 * after an action showed nothing — the entry existed, but only in the pending
 * batch — which reads as "the action was not logged" and undermines the whole
 * point of the page.
 */
export async function listLogs(query: LogQuery): Promise<LogPage> {
  await flushLogs().catch(() => undefined);

  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  try {
    const rows = await prisma.activityLog.findMany({
      where: buildWhere(query),
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit + 1, // One extra row answers "is there another page?" without a second count query.
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      entries: page.map(toEntry),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      degraded: false,
    };
  } catch {
    // The database is the outage. Serve the in-memory tail instead of failing:
    // it holds the very errors that explain what is wrong. Filtering is applied
    // in memory so the UI's controls keep working, but there is no paging —
    // the buffer is small and finite by design.
    const entries = bufferedLogs().filter((entry) => matchesInMemory(entry, query)).slice(0, limit);
    return { entries, nextCursor: null, degraded: true };
  }
}

/** Every entry belonging to one request, oldest first — the trace of a single call. */
export async function listLogsByRequestId(requestId: string): Promise<LogEntry[]> {
  await flushLogs().catch(() => undefined);
  try {
    const rows = await prisma.activityLog.findMany({
      where: { requestId },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      take: MAX_LIMIT,
    });
    return rows.map(toEntry);
  } catch {
    return bufferedLogs()
      .filter((entry) => entry.requestId === requestId)
      .reverse();
  }
}

export async function getLogStats(): Promise<LogStats> {
  await flushLogs().catch(() => undefined);

  const emptyByLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [levelGroups, categoryGroups, total, errorsLastHour, oldest, newest] = await Promise.all([
      prisma.activityLog.groupBy({ by: ["level"], _count: { _all: true } }),
      prisma.activityLog.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.activityLog.count(),
      prisma.activityLog.count({ where: { level: "error", timestamp: { gte: oneHourAgo } } }),
      prisma.activityLog.findFirst({ orderBy: { timestamp: "asc" }, select: { timestamp: true } }),
      prisma.activityLog.findFirst({ orderBy: { timestamp: "desc" }, select: { timestamp: true } }),
    ]);

    const byLevel = { ...emptyByLevel };
    for (const group of levelGroups) byLevel[group.level as LogLevel] = group._count._all;

    return {
      total,
      byLevel,
      byCategory: categoryGroups
        .map((group) => ({ category: group.category, count: group._count._all }))
        .sort((a, b) => b.count - a.count),
      errorsLastHour,
      oldestTimestamp: oldest?.timestamp.toISOString() ?? null,
      newestTimestamp: newest?.timestamp.toISOString() ?? null,
    };
  } catch {
    // Same fallback as listLogs, computed over the buffer.
    const entries = bufferedLogs();
    const byLevel = { ...emptyByLevel };
    const byCategory = new Map<string, number>();
    for (const entry of entries) {
      byLevel[entry.level] += 1;
      byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + 1);
    }
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return {
      total: entries.length,
      byLevel,
      byCategory: [...byCategory.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      errorsLastHour: entries.filter((e) => e.level === "error" && Date.parse(e.timestamp) >= oneHourAgo).length,
      oldestTimestamp: entries.at(-1)?.timestamp ?? null,
      newestTimestamp: entries[0]?.timestamp ?? null,
    };
  }
}

/**
 * Deletes entries older than `olderThanDays`, or all of them when it is 0.
 *
 * An audit table only grows, and this one gains a row per HTTP request, so
 * without a way to trim it the Logs page eventually becomes the largest table
 * in the database. Retention is a manual action rather than a background job:
 * silently deleting audit history on a timer is a worse default than letting an
 * operator decide.
 */
export async function purgeLogs(olderThanDays: number): Promise<number> {
  const where =
    olderThanDays > 0
      ? { timestamp: { lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) } }
      : {};
  const result = await prisma.activityLog.deleteMany({ where });
  return result.count;
}

function buildWhere(query: LogQuery) {
  const where: Record<string, unknown> = {};

  if (query.level) where.level = query.level;
  if (query.category) where.category = query.category;
  if (query.requestId) where.requestId = query.requestId;
  if (query.serverId) where.serverId = query.serverId;

  if (query.since) {
    const since = new Date(query.since);
    if (!Number.isNaN(since.getTime())) where.timestamp = { gte: since };
  }

  if (query.search) {
    // Spans message, event and path because an operator searching "collect"
    // means any of the three, and does not know which one carries the word.
    where.OR = [
      { message: { contains: query.search, mode: "insensitive" } },
      { event: { contains: query.search, mode: "insensitive" } },
      { path: { contains: query.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function matchesInMemory(entry: LogEntry, query: LogQuery): boolean {
  if (query.level && entry.level !== query.level) return false;
  if (query.category && entry.category !== query.category) return false;
  if (query.requestId && entry.requestId !== query.requestId) return false;
  if (query.serverId && entry.serverId !== query.serverId) return false;
  if (query.since && Date.parse(entry.timestamp) < Date.parse(query.since)) return false;
  if (query.search) {
    const needle = query.search.toLowerCase();
    const haystack = `${entry.message} ${entry.event} ${entry.path ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

function toEntry(row: ActivityLogModel): LogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    level: row.level as LogLevel,
    category: row.category as LogCategory,
    event: row.event,
    message: row.message,
    requestId: row.requestId,
    method: row.method,
    path: row.path,
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    serverId: row.serverId,
    analysisId: row.analysisId,
    context: (row.context as Record<string, unknown> | null) ?? null,
    errorStack: row.errorStack,
  };
}
