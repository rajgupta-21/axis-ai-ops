import { BedrockAdapter } from "./BedrockAdapter";
import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";
import { ImpactAnalysis, ImpactLevel } from "@/domain/analysis";

/**
 * Deterministic, rule-based stand-in for ClaudeBedrockAdapter, used when no
 * AWS credentials are configured (BEDROCK_PROVIDER=mock, the default). It
 * performs the same reasoning duties described in the system prompt but
 * without calling Bedrock, so the full workflow is runnable in local
 * development. It never fabricates facts beyond what the comparison and
 * release information already contain, and production deployments should
 * switch to BEDROCK_PROVIDER=bedrock to use Claude Sonnet 5.
 */
export class MockBedrockAdapter implements BedrockAdapter {
  async analyzeImpact(
    comparison: ComparisonResult,
    serverSnapshot: ServerSnapshot,
    release: ReleaseInformation
  ): Promise<ImpactAnalysis> {
    const hasVersionData = !comparison.versionGap.insufficientData;
    const impactLevel = this.deriveImpactLevel(comparison, serverSnapshot);
    const confidence = hasVersionData && release.latestVersion !== "Insufficient data" ? "HIGH" : "LOW";

    const reasoning: string[] = [];
    if (hasVersionData) {
      reasoning.push(
        `${comparison.component} is ${comparison.versionGap.description.toLowerCase()} (current ${comparison.currentVersion}, latest ${comparison.latestVersion}).`
      );
    } else {
      reasoning.push("Insufficient data to determine the exact version gap.");
    }
    if (comparison.securityChanges) {
      reasoning.push("The release information includes security-related changes.");
    }
    if (comparison.riskFactors.length > 0) {
      reasoning.push(`Server-side risk factors detected: ${comparison.riskFactors.join(", ")}.`);
    }

    const securityImpact = comparison.securityChanges
      ? [...release.securityChanges]
      : ["Insufficient data: no security changes were supplied by the release source."];

    const compatibilityImpact =
      release.compatibilityChanges.length > 0
        ? [...release.compatibilityChanges]
        : ["No compatibility changes were reported by the release source."];

    const operationalRisk: string[] = [];
    if (comparison.configurationChanges) {
      operationalRisk.push(
        "The release includes configuration behavior changes; a service restart may be required to apply the upgrade."
      );
    }
    if (serverSnapshot.services.some((s) => s.status === "running")) {
      operationalRisk.push(
        `${comparison.component} is currently running on this server; upgrading may require a brief service interruption.`
      );
    }
    if (operationalRisk.length === 0) {
      operationalRisk.push("No specific operational risk indicators were identified from the supplied data.");
    }

    const performanceImpact =
      release.changes.filter((c) => /performance/i.test(c)).length > 0
        ? release.changes.filter((c) => /performance/i.test(c))
        : ["Insufficient data: the release source did not report performance-specific changes."];

    const recommendedActions = [
      `Review the ${comparison.component} release notes for version ${release.latestVersion}.`,
      "Validate the upgrade in a staging environment before applying to production.",
    ];
    if (comparison.configurationChanges) {
      recommendedActions.push("Confirm current configuration remains compatible with the new release.");
    }
    if (comparison.securityChanges) {
      recommendedActions.push("Prioritize this upgrade given the presence of security-related changes.");
    }
    recommendedActions.push("Schedule a maintenance window if a service restart is required.");

    const preUpgradeChecks = [
      `Confirm a recent backup or snapshot exists before upgrading ${comparison.component}.`,
      "Verify current resource utilization allows for a safe upgrade window.",
      "Confirm dependent services and modules are compatible with the target version.",
    ];

    const rollbackConsiderations = [
      `Retain the current ${comparison.component} package/binary (${comparison.currentVersion}) for rollback.`,
      "Document current configuration before making changes so it can be restored if needed.",
    ];

    return {
      impactLevel,
      confidence,
      executiveSummary: this.buildExecutiveSummary(comparison, serverSnapshot, impactLevel),
      reasoning,
      risks: comparison.riskFactors.length > 0 ? [...comparison.riskFactors] : ["No elevated risk factors were identified."],
      securityImpact,
      compatibilityImpact,
      operationalRisk,
      performanceImpact,
      recommendedActions,
      preUpgradeChecks,
      rollbackConsiderations,
    };
  }

  private deriveImpactLevel(comparison: ComparisonResult, snapshot: ServerSnapshot): ImpactLevel {
    let score = 0;
    if (comparison.versionGap.major > 0) score += 3;
    else if (comparison.versionGap.minor > 0) score += 2;
    else if (comparison.versionGap.patch > 0) score += 1;

    if (comparison.securityChanges) score += 2;
    if (comparison.configurationChanges) score += 1;
    if (snapshot.cpu.usagePercent >= 75) score += 1;
    if (snapshot.memory.usedPercent >= 75) score += 1;
    if (snapshot.disk.usedPercent >= 80) score += 1;

    if (score >= 6) return "CRITICAL";
    if (score >= 4) return "HIGH";
    if (score >= 2) return "MEDIUM";
    return "LOW";
  }

  private buildExecutiveSummary(
    comparison: ComparisonResult,
    snapshot: ServerSnapshot,
    impactLevel: ImpactLevel
  ): string {
    return `Upgrading ${comparison.component} on ${snapshot.hostname} from ${comparison.currentVersion} to ${comparison.latestVersion} carries ${impactLevel} impact based on the version gap (${comparison.versionGap.description}), ${comparison.securityChanges ? "the presence of" : "the absence of"} security-related changes, and current resource utilization (CPU ${snapshot.cpu.usagePercent}%, memory ${snapshot.memory.usedPercent}%, disk ${snapshot.disk.usedPercent}%).`;
  }
}
