import { createReleaseAdapter } from "@/adapters/release";
import { ReleaseInformation } from "@/domain/release";
import { AppError, ErrorCodes } from "@/lib/errors";
import { ingestReleaseNotes } from "./knowledgeIngestionService";

const releaseAdapter = createReleaseAdapter();

const INSUFFICIENT_DATA_TEXT = "Insufficient data";

/**
 * How long a successful lookup is reused. A project's latest release does not
 * change minute to minute, but the software table re-reads every package on
 * every page load — without this, one page view costs one web search plus one
 * LLM call per package, which exhausts provider rate limits almost immediately.
 */
const CACHE_TTL_MS = Number(process.env.RELEASE_CACHE_TTL_MS ?? 6 * 60 * 60 * 1000);

/** Failed lookups are retried much sooner than successful ones are refreshed. */
const FAILURE_TTL_MS = Number(process.env.RELEASE_FAILURE_TTL_MS ?? 5 * 60 * 1000);

interface CacheEntry {
  release: ReleaseInformation;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
/** Collapses concurrent lookups of the same component into one request. */
const inFlight = new Map<string, Promise<ReleaseInformation>>();

function cacheKey(software: string): string {
  return software.toLowerCase();
}

function isFound(release: ReleaseInformation): boolean {
  return release.latestVersion !== INSUFFICIENT_DATA_TEXT;
}

/**
 * Retrieves LATEST RELEASE DATA for a software component, kept clearly separate
 * from CURRENT SERVER DATA supplied by the Ansible adapter.
 *
 * Results are cached and identical concurrent lookups are de-duplicated. The
 * currentVersion is not part of the cache key — it only travels through to the
 * result, while the "latest version" being looked up is a property of the
 * software itself.
 */
export async function getLatestRelease(
  software: string,
  currentVersion: string
): Promise<ReleaseInformation> {
  const key = cacheKey(software);

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.release, currentVersion };
  }

  const existing = inFlight.get(key);
  if (existing) {
    return { ...(await existing), currentVersion };
  }

  const lookup = performLookup(software, currentVersion)
    .then((release) => {
      cache.set(key, {
        release,
        expiresAt: Date.now() + (isFound(release) ? CACHE_TTL_MS : FAILURE_TTL_MS),
      });
      return release;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, lookup);
  return { ...(await lookup), currentVersion };
}

async function performLookup(software: string, currentVersion: string): Promise<ReleaseInformation> {
  let release: ReleaseInformation;
  try {
    release = await releaseAdapter.getLatestVersion(software, currentVersion);
  } catch {
    throw new AppError(
      ErrorCodes.RELEASE_LOOKUP_FAILED,
      "Latest release information could not be retrieved. Impact analysis cannot determine the version impact reliably.",
      502
    );
  }

  try {
    await ingestReleaseNotes(release);
  } catch {
    // Knowledge-base ingestion is best-effort grounding for later RAG
    // retrieval; a failure here must never block returning release data.
  }

  return release;
}

/** Clears the release cache. Exposed for tests and manual refreshes. */
export function clearReleaseCache(): void {
  cache.clear();
}
