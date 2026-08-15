import { compareVersions } from "@/lib/version";
import { getServerDetails } from "./serverService";
import { getLatestRelease } from "./releaseService";
import { mapWithConcurrency } from "@/lib/concurrency";
import { selectHighImpactSoftware } from "@/lib/packageSignificance";
import { prisma } from "@/lib/db";
import { ImpactLevel } from "@/domain/analysis";
import { CacheKeys, CacheTtl, cached } from "@/lib/cache";

export interface SoftwareVersionInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  versionGapDescription: string;
  latestImpactLevel: ImpactLevel | null;
}

/**
 * Release lookups hit a web search and an LLM per package. Free LLM tiers
 * throttle hard, so this stays deliberately low — the release-service cache
 * absorbs repeat page loads, making raw throughput far less important than
 * staying under the provider's rate limit.
 */
const RELEASE_LOOKUP_CONCURRENCY = Number(process.env.RELEASE_LOOKUP_CONCURRENCY ?? 2);

/**
 * Identifies installed software on a server and reports the latest available
 * version for each, using deterministic version comparison only. Impact level
 * shown here comes from the most recent completed analysis, if any — it is
 * never inferred here.
 *
 * A real host reports hundreds of packages, so this deliberately avoids
 * per-package database round trips: the impact levels are fetched in a single
 * query up front, and the release lookups run with bounded concurrency.
 */
export async function listServerSoftware(serverId: string): Promise<SoftwareVersionInfo[]> {
  return cached(CacheKeys.software(serverId), CacheTtl.software, () => computeServerSoftware(serverId));
}

async function computeServerSoftware(serverId: string): Promise<SoftwareVersionInfo[]> {
  const details = await getServerDetails(serverId);
  const allSoftware = details.snapshot?.software ?? [];
  if (allSoftware.length === 0) return [];

  // Report only the packages an operator would actually choose to upgrade.
  // Libraries and sub-packages are updated by their parent, so listing them
  // separately turns one decision into hundreds of rows — and would mean a
  // release lookup per library.
  const { highImpact: software, excludedCount, classifier } = await selectHighImpactSoftware(
    allSoftware,
    details.snapshot?.services ?? []
  );
  console.info(
    `[software] ${serverId}: ${software.length} parent packages of ${allSoftware.length} ` +
      `(${excludedCount} excluded, classifier=${classifier})`
  );
  if (software.length === 0) return [];

  const latestImpactByComponent = await getLatestImpactByComponent(serverId);

  return mapWithConcurrency(software, RELEASE_LOOKUP_CONCURRENCY, async (item) => {
    const release = await getLatestRelease(item.name, item.version);
    const gap = compareVersions(release.currentVersion, release.latestVersion);

    return {
      name: item.name,
      currentVersion: item.version,
      latestVersion: release.latestVersion,
      versionGapDescription: gap.description,
      latestImpactLevel: latestImpactByComponent.get(item.name.toLowerCase()) ?? null,
    };
  });
}

/**
 * One query for the whole server, reduced to the most recent impact level per
 * component. Replaces what used to be a findFirst per installed package —
 * hundreds of concurrent queries that exhausted the connection pool.
 */
async function getLatestImpactByComponent(serverId: string): Promise<Map<string, ImpactLevel>> {
  const analyses = await prisma.impactAnalysis.findMany({
    where: { serverId },
    orderBy: { createdAt: "desc" },
    select: { impactLevel: true, comparison: { select: { component: true } } },
  });

  const latest = new Map<string, ImpactLevel>();
  for (const analysis of analyses) {
    // Ordered newest-first, so the first entry seen per component wins.
    const key = analysis.comparison.component.toLowerCase();
    if (!latest.has(key)) {
      latest.set(key, analysis.impactLevel);
    }
  }
  return latest;
}
