import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";

const INSUFFICIENT_DATA_TEXT = "Insufficient data";

/**
 * The context-engineering step: instead of handing the LLM the raw
 * ServerSnapshot/ReleaseInformation/ComparisonResult objects, curate them
 * into a small set of labeled, bounded lists — facts that are known,
 * facts that are explicitly missing, and risk signals already computed by
 * deterministic code. This is what actually gets reasoned over downstream,
 * keeping the grounding surface small and auditable.
 */
export interface ContextEnvelope {
  mode: "release" | "playbook";
  factsKnown: string[];
  factsMissing: string[];
  riskSignals: string[];
}

export function buildContextEnvelope(
  comparison: ComparisonResult,
  serverSnapshot: ServerSnapshot,
  release: ReleaseInformation
): ContextEnvelope {
  const factsKnown: string[] = [
    `Server ${serverSnapshot.hostname} runs ${serverSnapshot.os.name} ${serverSnapshot.os.version}, kernel ${serverSnapshot.kernel}, ${serverSnapshot.architecture}.`,
    `${comparison.component} current version ${comparison.currentVersion}.`,
    `CPU usage ${serverSnapshot.cpu.usagePercent}%, memory usage ${serverSnapshot.memory.usedPercent}%, disk usage ${serverSnapshot.disk.usedPercent}%.`,
  ];
  const factsMissing: string[] = [];

  if (release.latestVersion === INSUFFICIENT_DATA_TEXT) {
    factsMissing.push("Latest release version is unknown.");
  } else {
    factsKnown.push(`Latest available ${comparison.component} version is ${release.latestVersion} (source: ${release.source}).`);
  }

  if (comparison.versionGap.insufficientData) {
    factsMissing.push("The size of the version gap could not be determined.");
  } else {
    factsKnown.push(`Version gap: ${comparison.versionGap.description}.`);
  }

  if (release.securityChanges.length === 0) {
    factsMissing.push("No security-related changes were supplied by the release source.");
  }
  if (release.compatibilityChanges.length === 0) {
    factsMissing.push("No compatibility changes were supplied by the release source.");
  }

  const riskSignals = [...comparison.riskFactors];
  if (comparison.securityChanges) riskSignals.push(`${comparison.component} release includes security-related changes.`);
  if (comparison.configurationChanges) riskSignals.push(`${comparison.component} release includes configuration behavior changes.`);

  return {
    mode: comparison.playbook ? "playbook" : "release",
    factsKnown,
    factsMissing,
    riskSignals,
  };
}
