import { compareVersions } from "@/lib/version";
import { getServerDetails } from "./serverService";
import { getLatestRelease } from "./releaseService";
import { prisma } from "@/lib/db";

export interface SoftwareVersionInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  versionGapDescription: string;
  latestImpactLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}

/**
 * Identifies installed software on a server and reports the latest
 * available version for each, using deterministic version comparison
 * only. Impact level shown here comes from the most recent completed
 * analysis, if any — it is never inferred here.
 */
export async function listServerSoftware(serverId: string): Promise<SoftwareVersionInfo[]> {
  const details = await getServerDetails(serverId);
  const software = details.snapshot?.software ?? [];

  return Promise.all(
    software.map(async (item) => {
      const release = await getLatestRelease(item.name, item.version);
      const gap = compareVersions(release.currentVersion, release.latestVersion);

      const latestAnalysis = await prisma.impactAnalysis.findFirst({
        where: {
          serverId,
          comparison: { component: { equals: item.name, mode: "insensitive" } },
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        name: item.name,
        currentVersion: item.version,
        latestVersion: release.latestVersion,
        versionGapDescription: gap.description,
        latestImpactLevel: latestAnalysis?.impactLevel ?? null,
      };
    })
  );
}
