import { createBedrockAdapter } from "@/adapters/bedrock";
import { AnalysisRecord } from "@/domain/analysis";
import { ReleaseInformation } from "@/domain/release";
import { AppError, ErrorCodes } from "@/lib/errors";
import { ImpactAnalysisSchema } from "@/lib/analysisSchema";
import {
  createComparison,
  createImpactAnalysis,
  createPlaybookInput,
  createReleaseInformation,
  getAnalysisById,
} from "@/repositories/analysisRepository";
import { compareServerToPlaybook } from "./comparisonService";
import { collectServerDataWithId } from "./collectionService";
import { getLatestRelease } from "./releaseService";
import { parsePlaybook } from "./playbookParserService";

const bedrockAdapter = createBedrockAdapter();

const INSUFFICIENT_DATA_RELEASE: ReleaseInformation = {
  software: "playbook",
  currentVersion: "Insufficient data",
  latestVersion: "Insufficient data",
  releaseDate: "Insufficient data",
  changes: [],
  securityChanges: [],
  configurationChanges: [],
  compatibilityChanges: [],
  source: "Insufficient data",
};

/**
 * Runs the impact-analysis pipeline for an uploaded Ansible playbook. The
 * playbook is parsed statically and never executed — this determines what
 * it would do to the server's current state, not what upgrading to a
 * latest release would do.
 */
export async function analyzeServerFromPlaybook(
  serverId: string,
  playbookYaml: string
): Promise<AnalysisRecord> {
  const parsed = parsePlaybook(playbookYaml);

  const { snapshot, snapshotId } = await collectServerDataWithId(serverId);

  const releaseByPackage = new Map<string, ReleaseInformation>();
  for (const change of parsed.packageChanges) {
    const key = change.name.toLowerCase();
    if (releaseByPackage.has(key)) continue;
    const installed = snapshot.software.find((s) => s.name.toLowerCase() === key);
    const release = await getLatestRelease(change.name, installed?.version ?? "Insufficient data");
    releaseByPackage.set(key, release);
  }

  const comparison = compareServerToPlaybook(snapshot, parsed, releaseByPackage);

  const primaryRelease =
    Array.from(releaseByPackage.values()).find((r) => r.latestVersion !== "Insufficient data") ??
    releaseByPackage.values().next().value ??
    INSUFFICIENT_DATA_RELEASE;

  const releaseId = await createReleaseInformation(primaryRelease);
  const comparisonId = await createComparison(snapshotId, releaseId, comparison);
  const playbookInputId = await createPlaybookInput(playbookYaml);

  let agentResult;
  try {
    agentResult = await bedrockAdapter.analyzeImpact(comparison, snapshot, primaryRelease);
  } catch {
    throw new AppError(
      ErrorCodes.ANALYSIS_FAILED,
      "Impact analysis could not be completed. The parsed playbook and server comparison remains available.",
      502
    );
  }

  const validated = ImpactAnalysisSchema.safeParse(agentResult.analysis);
  if (!validated.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_FAILED,
      "Impact analysis returned an invalid structured result and could not be stored.",
      502
    );
  }

  const analysisId = await createImpactAnalysis(serverId, comparisonId, validated.data, {
    source: "PLAYBOOK",
    playbookInputId,
    reasoningTrace: agentResult.trace,
  });

  const record = await getAnalysisById(analysisId);
  if (!record) {
    throw new AppError(ErrorCodes.ANALYSIS_FAILED, "Analysis could not be retrieved after creation.", 500);
  }
  return record;
}
