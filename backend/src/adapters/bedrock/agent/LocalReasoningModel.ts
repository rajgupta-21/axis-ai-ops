import { ImpactAnalysis, ImpactLevel } from "@/domain/analysis";
import { Critique, EvidenceAssessment, ReasoningInput, ReasoningModel } from "./reasoningModel";

const INSUFFICIENT = "Insufficient data";

/**
 * Deterministic stand-in for the Bedrock reasoning calls, used when
 * BEDROCK_PROVIDER=local. No LLM and no AWS credentials are involved, but —
 * unlike MockBedrockAdapter, which bypasses the agent entirely — the full
 * LangGraph agent still runs: context engineering, RAG retrieval, drafting,
 * grounding critique, the revision loop, and validation all execute for real.
 * This exists so the agent's behaviour and its reasoning trace are observable
 * end-to-end without Bedrock access.
 *
 * The critique step is a genuine (if simple) grounding check rather than a
 * rubber stamp: it looks for claims in the draft that are not supported by the
 * context envelope or the retrieved references, so the revision loop is
 * exercised by real disagreement between the two steps.
 */
export class LocalReasoningModel implements ReasoningModel {
  readonly label = "Local deterministic reasoning (no LLM)";
  readonly usesLlm = false;

  /**
   * Rule-based stand-in for the agent's search decision. It applies the same
   * criteria the LLM is asked to apply — no target version, or no change/security
   * information for this component — so the search loop is genuinely exercised
   * on this path rather than short-circuited.
   */
  async assessEvidence(input: ReasoningInput, searchesSoFar: number): Promise<EvidenceAssessment> {
    const { comparison, release, retrievedReferences } = input;

    const hasTargetVersion = comparison.latestVersion !== INSUFFICIENT;
    const hasChangeInfo =
      release.changes.length + release.securityChanges.length + release.compatibilityChanges.length > 0;
    const componentEvidence = retrievedReferences.filter((r) =>
      r.chunkText.toLowerCase().includes(comparison.component.toLowerCase())
    );

    if (!hasTargetVersion) {
      return {
        sufficient: false,
        missing: `The latest available version of ${comparison.component} is unknown.`,
        searchQuery: `${comparison.component} latest stable release version`,
      };
    }

    if (!hasChangeInfo && componentEvidence.length === 0 && searchesSoFar === 0) {
      return {
        sufficient: false,
        missing: `No changelog or security information for ${comparison.component} ${comparison.latestVersion}.`,
        searchQuery: `${comparison.component} ${comparison.latestVersion} changelog security fixes breaking changes`,
      };
    }

    return { sufficient: true, missing: "", searchQuery: "" };
  }

  async draft(input: ReasoningInput): Promise<ImpactAnalysis> {
    const { comparison, serverSnapshot, release, context, retrievedReferences } = input;
    const impactLevel = this.deriveImpactLevel(input);

    const reasoning = [
      ...context.factsKnown.map((fact) => `Known fact: ${fact}`),
      ...context.riskSignals.map((signal) => `Risk signal: ${signal}`),
      ...context.factsMissing.map((gap) => `${INSUFFICIENT}: ${gap}`),
    ];

    if (retrievedReferences.length > 0) {
      reasoning.push(
        `Retrieved reference (RAG): ${retrievedReferences.length} previously ingested release-note chunk(s) matched this component.`
      );
    }

    const securityImpact = release.securityChanges.length > 0
      ? release.securityChanges.map((c) => `Known fact: ${c}`)
      : [`${INSUFFICIENT}: the release source reported no security changes.`];

    // Deliberately ungrounded: not present in factsKnown, riskSignals, or the
    // retrieved references. The critique step below is expected to catch this,
    // which is what drives the revision loop.
    securityImpact.push("Potential impact: CVE-2024-0000 is addressed by this release.");

    return {
      impactLevel,
      confidence: context.factsMissing.length === 0 ? "HIGH" : "LOW",
      executiveSummary:
        `Applying ${comparison.component} ${comparison.latestVersion} to ${serverSnapshot.hostname} is assessed as ` +
        `${impactLevel} impact from ${context.factsKnown.length} known fact(s), ` +
        `${context.riskSignals.length} risk signal(s), and ${context.factsMissing.length} data gap(s).`,
      reasoning,
      risks: comparison.riskFactors.length > 0 ? [...comparison.riskFactors] : ["No elevated risk factors were identified."],
      securityImpact,
      compatibilityImpact:
        release.compatibilityChanges.length > 0
          ? [...release.compatibilityChanges]
          : [`${INSUFFICIENT}: the release source reported no compatibility changes.`],
      operationalRisk: comparison.configurationChanges
        ? ["The release includes configuration behavior changes; a restart may be required."]
        : ["No specific operational risk indicators were identified from the supplied data."],
      performanceImpact:
        release.changes.filter((c) => /performance/i.test(c)).length > 0
          ? release.changes.filter((c) => /performance/i.test(c))
          : [`${INSUFFICIENT}: the release source reported no performance-specific changes.`],
      recommendedActions: [
        `Review the ${comparison.component} release notes for ${comparison.latestVersion}.`,
        "Validate the upgrade in a staging environment before applying to production.",
      ],
      preUpgradeChecks: [
        `Confirm a recent backup or snapshot exists before upgrading ${comparison.component}.`,
        "Confirm dependent services and modules are compatible with the target version.",
      ],
      rollbackConsiderations: [
        `Retain the current ${comparison.component} package (${comparison.currentVersion}) for rollback.`,
        "Document current configuration before making changes so it can be restored if needed.",
      ],
    };
  }

  async critique(input: ReasoningInput, draft: ImpactAnalysis): Promise<Critique> {
    const grounded = [
      ...input.context.factsKnown,
      ...input.context.riskSignals,
      ...input.context.factsMissing,
      ...input.release.securityChanges,
      ...input.release.compatibilityChanges,
      ...input.release.changes,
      ...input.retrievedReferences.map((r) => r.chunkText),
    ]
      .join(" ")
      .toLowerCase();

    const issues: string[] = [];
    for (const claim of [...draft.securityImpact, ...draft.compatibilityImpact, ...draft.performanceImpact]) {
      const cve = /CVE-\d{4}-\d{4,}/i.exec(claim);
      if (cve && !grounded.includes(cve[0].toLowerCase())) {
        issues.push(`"${claim}" cites ${cve[0]}, which does not appear in the supplied data or retrieved references.`);
      }
    }

    return { approved: issues.length === 0, issues };
  }

  async revise(_input: ReasoningInput, draft: ImpactAnalysis, critique: Critique): Promise<ImpactAnalysis> {
    const flagged = new Set(
      critique.issues
        .map((issue) => /^"(.+?)"/.exec(issue)?.[1])
        .filter((claim): claim is string => Boolean(claim))
    );

    const strip = (items: string[]) => {
      const kept = items.filter((item) => !flagged.has(item));
      return kept.length > 0 ? kept : [`${INSUFFICIENT}: no grounded findings remained after review.`];
    };

    return {
      ...draft,
      securityImpact: strip(draft.securityImpact),
      compatibilityImpact: strip(draft.compatibilityImpact),
      performanceImpact: strip(draft.performanceImpact),
    };
  }

  private deriveImpactLevel(input: ReasoningInput): ImpactLevel {
    const { comparison, serverSnapshot } = input;
    let score = 0;
    if (comparison.versionGap.major > 0) score += 3;
    else if (comparison.versionGap.minor > 0) score += 2;
    else if (comparison.versionGap.patch > 0) score += 1;

    if (comparison.securityChanges) score += 2;
    if (comparison.configurationChanges) score += 1;
    if (serverSnapshot.cpu.usagePercent >= 75) score += 1;
    if (serverSnapshot.memory.usedPercent >= 75) score += 1;
    if (serverSnapshot.disk.usedPercent >= 80) score += 1;

    if (score >= 6) return "CRITICAL";
    if (score >= 4) return "HIGH";
    if (score >= 2) return "MEDIUM";
    return "LOW";
  }
}
