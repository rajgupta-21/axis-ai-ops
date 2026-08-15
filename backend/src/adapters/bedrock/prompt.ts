import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";

export const SYSTEM_PROMPT = `You are a server patch impact analysis system.

Analyze only the supplied server state, release information, and deterministic comparison.

Do not invent:
- vulnerabilities
- compatibility issues
- configuration changes
- downtime requirements
- dependencies
- release behavior

If information is missing or was not supplied to you, explicitly say "Insufficient data" for that item rather than guessing.

Your responsibility is to determine the likely impact of upgrading the specified software on the specified server. You must distinguish between a "Known fact" (explicitly present in the supplied data), a "Retrieved reference" (real text retrieved from a knowledge base of previously ingested release notes, supplied under "retrievedReferences" — cite it as supporting context, but it is still someone else's text about a possibly different version, not automatically true of this exact upgrade), and a "Potential impact" (a reasonable inference you are drawing from either of the above) — do not present inferences as facts, and do not present retrieved references as if they were confirmed facts about this specific comparison.

Consider, using only the supplied data:
- Compatibility: OS, modules, services, configuration, dependencies.
- Security: security fixes and known security changes supplied by the release information; do not fabricate CVE identifiers or vulnerability details that were not supplied.
- Operational risk: possible downtime, restart requirements, configuration changes, dependency risk.
- Performance: potential performance improvements, resource utilization and considerations.

You are analysis-only. You must never recommend or imply that you (the AI) will execute commands, SSH into servers, modify configuration, install packages, restart services, apply patches, or launch Ansible jobs. Only ever produce human-actionable recommendations for engineers to review and apply manually.

Some analyses include a "deterministicComparison.playbook" object. When it is present, the input is an uploaded Ansible playbook that has NOT been executed — you are assessing what would happen if a human ran it against this server. Treat "playbook.opaqueTasks" as raw shell/command/script/raw tasks that could not be statically analyzed: you must report "Insufficient data" for the effect of each such task rather than guessing what it does, even though its text may hint at intent. Every other field under "playbook" (targetedPackages, serviceChanges, configChanges, portChanges) was derived by deterministic code from the playbook's declared tasks, not executed — treat it as a "Known fact" about what the playbook declares, while the consequences of applying it remain "Potential impact" unless already stated as risk factors.

Respond with a single JSON object only, matching exactly this shape, with no markdown fences and no prose outside the JSON:
{
  "impactLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "executiveSummary": string,
  "reasoning": string[],
  "risks": string[],
  "securityImpact": string[],
  "compatibilityImpact": string[],
  "operationalRisk": string[],
  "performanceImpact": string[],
  "recommendedActions": string[],
  "preUpgradeChecks": string[],
  "rollbackConsiderations": string[]
}`;

export interface RetrievedReference {
  chunkText: string;
  sourceUrl: string | null;
  /** Cosine similarity for knowledge-base hits; null for live web results, which are keyword-ranked. */
  similarity: number | null;
  /** Where this evidence came from, so the report can attribute it honestly. */
  origin: "knowledge_base" | "web_search";
}

/** Caps on list fields, to keep the prompt focused and within token budgets. */
const MAX_RELATED_PACKAGES = 25;
const MAX_RUNNING_SERVICES = 40;
const MAX_REFERENCES = 8;
const MAX_REFERENCE_CHARS = 600;

/**
 * Packages in the component's own family — its sub-packages and anything sharing
 * its name prefix. A real host reports hundreds of packages; only these are
 * relevant to upgrading this one component, and they are what actually move
 * together when it is upgraded.
 */
function relatedPackages(component: string, installedPackages: readonly string[]): string[] {
  const needle = component.toLowerCase();
  return installedPackages.filter((name) => name.toLowerCase().startsWith(needle)).slice(0, MAX_RELATED_PACKAGES);
}

export function buildUserPrompt(
  comparison: ComparisonResult,
  serverSnapshot: ServerSnapshot,
  release: ReleaseInformation,
  retrievedReferences: RetrievedReference[] = []
): string {
  const installedPackages = serverSnapshot.configuration.installedPackages;
  const running = serverSnapshot.services.filter((s) => s.status === "running");

  // Deliberately NOT the whole snapshot. Sending every installed package and
  // service costs thousands of tokens per call — enough to exceed a provider's
  // per-minute budget on its own — and buries the handful of facts that bear on
  // this one component. Counts preserve the scale without the noise.
  const payload = {
    server: {
      hostname: serverSnapshot.hostname,
      os: serverSnapshot.os,
      kernel: serverSnapshot.kernel,
      architecture: serverSnapshot.architecture,
      cpu: serverSnapshot.cpu,
      memory: serverSnapshot.memory,
      disk: serverSnapshot.disk,
      network: serverSnapshot.network ?? null,
      modules: serverSnapshot.modules,
      runningServiceCount: running.length,
      runningServices: running.slice(0, MAX_RUNNING_SERVICES).map((s) => s.name),
      configuration: {
        ports: serverSnapshot.configuration.ports,
        importantValues: serverSnapshot.configuration.importantValues,
        timezone: serverSnapshot.configuration.timezone,
        installedPackageCount: installedPackages.length,
        packagesRelatedToComponent: relatedPackages(comparison.component, installedPackages),
      },
      collectedAt: serverSnapshot.collectedAt,
    },
    releaseInformation: release,
    deterministicComparison: comparison,
    retrievedReferences: retrievedReferences.slice(0, MAX_REFERENCES).map((reference) => ({
      ...reference,
      chunkText: reference.chunkText.slice(0, MAX_REFERENCE_CHARS),
    })),
  };

  const intro = comparison.playbook
    ? "CURRENT SERVER DATA and the deterministic correlation of an uploaded (never executed) Ansible playbook against that server are provided below as JSON. Use them as your only source of truth. Assess the impact of applying this playbook, not a version-upgrade recommendation."
    : "CURRENT SERVER DATA, LATEST RELEASE DATA, and the deterministic comparison already computed by code are provided below as JSON. Use them as your only source of truth.";

  return `${intro}

${JSON.stringify(payload, null, 2)}

Return only the JSON object described in the system prompt.`;
}
