import { ComparisonResult, PlaybookImpactContext } from "@/domain/comparison";
import { ParsedPlaybook } from "@/domain/playbook";
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

/**
 * Deterministic comparison for a playbook-driven analysis. Correlates what
 * an uploaded Ansible playbook declares it would do against the server's
 * current state — the playbook is never executed; this only compares its
 * declared intent to facts already collected from the server.
 */
export function compareServerToPlaybook(
  snapshot: ServerSnapshot,
  playbook: ParsedPlaybook,
  releaseByPackage: Map<string, ReleaseInformation>
): ComparisonResult {
  const riskFactors: string[] = [];
  const serverDependencies: string[] = [];

  const targetedPackages = playbook.packageChanges.map((change) => {
    const installed = snapshot.software.find(
      (s) => s.name.toLowerCase() === change.name.toLowerCase()
    );
    const release = releaseByPackage.get(change.name.toLowerCase());
    const targetVersion = change.version ?? release?.latestVersion;
    const versionGap =
      installed && targetVersion ? compareVersions(installed.version, targetVersion) : undefined;

    if (installed && targetVersion) {
      serverDependencies.push(change.name);
      if (versionGap && !versionGap.insufficientData && versionGap.major + versionGap.minor + versionGap.patch < 0) {
        riskFactors.push(
          `Playbook targets ${change.name} ${targetVersion}, which is older than the currently installed ${installed.version}`
        );
      }
    } else if (!installed) {
      riskFactors.push(`Playbook targets "${change.name}", which is not currently installed on this server`);
    }

    return {
      name: change.name,
      installedVersion: installed?.version,
      targetVersion,
      versionGap,
    };
  });

  const serviceChanges = playbook.serviceChanges.map((change) => {
    const current = snapshot.services.find((s) => s.name.toLowerCase() === change.name.toLowerCase());
    const currentlyRunning = current ? current.status === "running" : undefined;
    if (currentlyRunning && (change.state === "stopped" || change.enabled === false)) {
      riskFactors.push(`Playbook would stop or disable "${change.name}", which is currently running`);
    }
    return { ...change, currentlyRunning };
  });

  const portChanges = playbook.portChanges.map((change) => {
    const currentlyOpen = snapshot.configuration.ports.includes(change.port);
    if (!currentlyOpen && change.state && !/deny|closed|absent/i.test(change.state)) {
      riskFactors.push(`Playbook would open port ${change.port}, which is not currently open on this server`);
    }
    return { ...change, currentlyOpen };
  });

  if (playbook.configChanges.length > 0) {
    riskFactors.push(`Playbook modifies ${playbook.configChanges.length} configuration file(s)`);
  }

  if (playbook.opaqueTasks.length > 0) {
    riskFactors.push(
      `Playbook contains ${playbook.opaqueTasks.length} raw command/shell task(s) whose effect cannot be statically determined — Insufficient data`
    );
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

  const playbookContext: PlaybookImpactContext = {
    targetedPackages,
    serviceChanges,
    configChanges: playbook.configChanges,
    portChanges,
    opaqueTasks: playbook.opaqueTasks,
    warnings: playbook.warnings,
  };

  const firstResolved = targetedPackages.find((p) => p.versionGap && !p.versionGap.insufficientData);
  const anySecurityChanges = Array.from(releaseByPackage.values()).some((r) => r.securityChanges.length > 0);

  return {
    component: targetedPackages.map((p) => p.name).join(", ") || "Ansible Playbook",
    currentVersion: firstResolved?.installedVersion ?? "Insufficient data",
    latestVersion: firstResolved?.targetVersion ?? "Insufficient data",
    versionGap: firstResolved?.versionGap ?? {
      major: 0,
      minor: 0,
      patch: 0,
      description: "Insufficient data",
      insufficientData: true,
    },
    securityChanges: anySecurityChanges,
    configurationChanges: playbook.configChanges.length > 0,
    serverDependencies,
    riskFactors,
    playbook: playbookContext,
  };
}
