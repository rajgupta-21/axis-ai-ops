import Redis from "ioredis";
import { logger } from "./logger";

/**
 * Redis-backed response cache.
 *
 * The expensive work in this system is remote: collecting facts is several SSH
 * round trips to an Ansible control node, and a release lookup is a web search
 * plus an LLM call per package. A server-detail page can take minutes on a cold
 * cache, which is why the UI appeared to hang. None of that data changes between
 * one page load and the next, so it is cached here rather than recomputed.
 *
 * The cache is strictly an optimisation. Every function degrades to calling
 * through when Redis is unavailable: a missing or broken cache must make the app
 * slow, never broken.
 */

const DEFAULT_URL = "redis://127.0.0.1:6379";

/** Namespace on every key, so flushing this app cannot disturb another user of the same Redis. */
const PREFIX = "ias";

export const CacheTtl = {
  /** Server list: cheap to rebuild, and the first thing a user looks at. */
  serverList: Number(process.env.CACHE_TTL_SERVER_LIST ?? 60),
  /** A single server's details and snapshot. */
  serverDetails: Number(process.env.CACHE_TTL_SERVER_DETAILS ?? 120),
  /**
   * Parent packages plus a release lookup each — by far the most expensive
   * response, and the one that made the page feel stuck. Latest-version data
   * moves on the order of days, so minutes of staleness costs nothing.
   */
  software: Number(process.env.CACHE_TTL_SOFTWARE ?? 900),
} as const;

let client: Redis | null = null;
let clientUnavailable = false;

/**
 * Lazily connects. `lazyConnect` keeps construction from throwing when Redis is
 * down, so a missing cache cannot prevent the process from starting.
 *
 * Reconnection is deliberately unbounded, with a capped backoff. An earlier
 * version gave up after three attempts to keep the log quiet, which meant that
 * restarting the Redis container left the backend permanently uncached until the
 * API itself was restarted — the cache silently stopped working at exactly the
 * moment it looked like it should recover. Log noise is handled by warning once
 * instead, which is the right tool for that problem.
 */
function getClient(): Redis | null {
  if (clientUnavailable) return null;
  if (client) return client;

  if (process.env.CACHE_ENABLED === "false") {
    clientUnavailable = true;
    logger.info("cache", "Cache disabled by CACHE_ENABLED=false; every request is computed fresh.", {
      event: "cache.disabled",
    });
    return null;
  }

  client = new Redis(process.env.REDIS_URL ?? DEFAULT_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });

  client.on("error", (error: Error & { code?: string }) => {
    // One warning, then silence. Without this guard a down Redis emits an error
    // per reconnect attempt and drowns out everything else in the log.
    if (!clientUnavailable) {
      clientUnavailable = true;
      logger.warn(
        "cache",
        `Redis unavailable (${error.code ?? error.message}); serving uncached. Start it with "docker compose up -d".`,
        { event: "cache.unavailable", context: { code: error.code ?? null } }
      );
    }
  });

  client.on("ready", () => {
    clientUnavailable = false;
    logger.info("cache", "Connected to Redis.", { event: "cache.connected" });
  });

  client.connect().catch(() => {
    // Already reported by the error handler above.
  });

  return client;
}

function namespaced(key: string): string {
  return `${PREFIX}:${key}`;
}

/**
 * Read-through cache. Returns the cached value when present, otherwise runs
 * `compute`, stores the result, and returns it.
 *
 * A rejected `compute` is never cached — an unreachable host must be retried on
 * the next request rather than remembered as a failure for the whole TTL.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
  options?: {
    /**
     * Decides whether a freshly computed value is worth storing. Defaults to
     * always. Used to keep *degraded* results out of the cache: when the Ansible
     * control node is unreachable the server list falls back to the last known
     * state from Postgres, and caching that would keep serving the stale fleet
     * for the full TTL after SSH recovered — the app would look broken for a
     * minute after it was fixed. Recomputing a degraded response is cheap
     * precisely because the expensive remote call is the thing that failed.
     */
    shouldCache?: (value: T) => boolean;
  }
): Promise<T> {
  const redis = getClient();
  if (!redis) return compute();

  try {
    const hit = await redis.get(namespaced(key));
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // Treat any read failure as a miss and carry on.
  }

  const value = await compute();

  if (options?.shouldCache && !options.shouldCache(value)) return value;

  try {
    await redis.set(namespaced(key), JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // A failed write costs a recompute next time, which is acceptable.
  }

  return value;
}

/**
 * Drops every key under a prefix. Called after a collection or analysis, where
 * the point of the request is that the cached view is now wrong.
 *
 * Uses SCAN rather than KEYS: KEYS blocks the Redis event loop for the whole
 * keyspace, which is precisely the kind of stall this cache exists to avoid.
 */
export async function invalidate(keyPrefix: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  const match = `${namespaced(keyPrefix)}*`;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", match, "COUNT", 200);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (error) {
    logger.warn("cache", `Could not invalidate cache keys matching "${match}".`, {
      event: "cache.invalidate_failed",
      context: { match },
      error,
    });
  }
}

/** Cache keys, in one place so invalidation prefixes cannot drift from writes. */
export const CacheKeys = {
  serverList: () => "servers:list",
  serverDetails: (serverId: string) => `servers:${serverId}:details`,
  software: (serverId: string) => `servers:${serverId}:software`,
  /** Everything derived from one server's state. */
  serverScope: (serverId: string) => `servers:${serverId}`,
} as const;

/**
 * Invalidates everything affected by a change to one server, including the list
 * — its row carries that server's metrics and collection time.
 */
export async function invalidateServer(serverId: string): Promise<void> {
  await Promise.all([invalidate(CacheKeys.serverScope(serverId)), invalidate(CacheKeys.serverList())]);
}

/** Non-secret cache status for /api/system/info. */
export function describeCache(): { enabled: boolean; connected: boolean } {
  if (process.env.CACHE_ENABLED === "false") return { enabled: false, connected: false };
  return { enabled: true, connected: client?.status === "ready" };
}

/** Closes the connection so a dev-server restart does not leak sockets. */
export async function closeCache(): Promise<void> {
  if (!client) return;
  const c = client;
  client = null;
  try {
    await c.quit();
  } catch {
    c.disconnect();
  }
}
