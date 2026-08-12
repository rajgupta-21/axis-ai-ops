import { ComparisonResult } from "@/domain/comparison";
import { ReleaseInformation } from "@/domain/release";
import { ServerSnapshot } from "@/domain/server";
import { compareVersions } from "@/lib/version";

const CPU_HIGH_THRESHOLD = 75;
const MEMORY_HIGH_THRESHOLD = 75;
const DISK_HIGH_THRESHOLD = 80;

const DATABASE_SOFTWARE = ["postgresql", "mysql", "mariadb", "mongodb", "redis"];
const WEB_SOFTWARE = ["nginx", "apache", "httpd", "caddy"];

function textMentions(texts: string[], keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return texts.some((t) => t.toLowerCase().includes(lower));
}

/**
 * Deterministic comparison engine. Performs all numeric/version/config
 * calculations before the LLM is invoked so Claude never has to compute
 * facts that code can reliably compute.
 */
export function compareServerToRelease(
  component: string,
  snapshot: ServerSnapshot,
  release: ReleaseInformation
): ComparisonResult {
  const versionGap = compareVersions(release.currentVersion, release.latestVersion);

  const securityChanges = release.securityChanges.length > 0;
  const configurationChanges = release.configurationChanges.length > 0;

  const allReleaseText = [
    ...release.changes,
    ...release.securityChanges,
    ...release.configurationChanges,
    ...release.compatibilityChanges,
  ];

  const serverDependencies: string[] = [];
  const riskFactors: string[] = [];

  if (snapshot.modules.includes("http_v2") && textMentions(allReleaseText, "HTTP/2")) {
    serverDependencies.push("http_v2");
    riskFactors.push("HTTP/2 enabled");
  }

  if (snapshot.modules.includes("ssl") && textMentions(allReleaseText, "SSL")) {
    serverDependencies.push("ssl");
    riskFactors.push("SSL module enabled");
  } else if (snapshot.modules.includes("ssl")) {
    serverDependencies.push("ssl");
  }

  if (snapshot.modules.includes("gzip")) {
    serverDependencies.push("gzip");
  }

  const hasCustomConfig = Object.keys(snapshot.configuration.importantValues).length > 0;
  if (hasCustomConfig && configurationChanges) {
    riskFactors.push("Custom configuration detected");
  }

  if (snapshot.cpu.usagePercent >= CPU_HIGH_THRESHOLD) {
    riskFactors.push(`High CPU utilization (${snapshot.cpu.usagePercent}%)`);
  }

  if (snapshot.memory.usedPercent >= MEMORY_HIGH_THRESHOLD) {
    riskFactors.push(`High memory utilization (${snapshot.memory.usedPercent}%)`);
  }

  if (snapshot.disk.usedPercent >= DISK_HIGH_THRESHOLD) {
    riskFactors.push(`High disk utilization (${snapshot.disk.usedPercent}%)`);
  }

  const componentLower = component.toLowerCase();
  if (DATABASE_SOFTWARE.includes(componentLower)) {
    riskFactors.push("Database service running");
  }
  if (WEB_SOFTWARE.includes(componentLower)) {
    riskFactors.push("Production-facing web service");
  }

  return {
    component,
    currentVersion: release.currentVersion,
    latestVersion: release.latestVersion,
    versionGap,
    securityChanges,
    configurationChanges,
    serverDependencies,
    riskFactors,
  };
}
