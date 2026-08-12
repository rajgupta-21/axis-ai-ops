import { createBedrockAdapter } from "@/adapters/bedrock";
import { AnalysisRecord } from "@/domain/analysis";
import { AppError, ErrorCodes } from "@/lib/errors";
import { ImpactAnalysisSchema } from "@/lib/analysisSchema";
import {
  createComparison,
  createImpactAnalysis,
  createReleaseInformation,
  getAnalysisById,
} from "@/repositories/analysisRepository";
import { compareServerToRelease } from "./comparisonService";
import { collectServerDataWithId } from "./collectionService";
import { getLatestRelease } from "./releaseService";

const bedrockAdapter = createBedrockAdapter();

/**
 * Runs the full analysis workflow described by the architecture:
 * collect -> identify software -> release lookup -> deterministic
 * comparison -> Claude impact analysis -> validate -> persist.
 * Used by both the initial "Analyze" action and "Re-analyze".
 */
export async function analyzeServerSoftware(
  serverId: string,
  component: string
): Promise<AnalysisRecord> {
  const { snapshot, snapshotId } = await collectServerDataWithId(serverId);

  const installed = snapshot.software.find(
    (s) => s.name.toLowerCase() === component.toLowerCase()
  );
  if (!installed) {
    throw new AppError(
      ErrorCodes.SOFTWARE_NOT_FOUND,
      `Software "${component}" is not installed on this server.`,
      404
    );
  }

  const release = await getLatestRelease(installed.name, installed.version);
  const releaseId = await createReleaseInformation(release);

  const comparison = compareServerToRelease(installed.name, snapshot, release);
  const comparisonId = await createComparison(snapshotId, releaseId, comparison);

  let analysis;
  try {
    analysis = await bedrockAdapter.analyzeImpact(comparison, snapshot, release);
  } catch {
    throw new AppError(
      ErrorCodes.ANALYSIS_FAILED,
      "Impact analysis could not be completed. The collected server and release comparison remains available.",
      502
    );
  }

  const validated = ImpactAnalysisSchema.safeParse(analysis);
  if (!validated.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_FAILED,
      "Impact analysis returned an invalid structured result and could not be stored.",
      502
    );
  }

  const analysisId = await createImpactAnalysis(serverId, comparisonId, validated.data);

  const record = await getAnalysisById(analysisId);
  if (!record) {
    throw new AppError(ErrorCodes.ANALYSIS_FAILED, "Analysis could not be retrieved after creation.", 500);
  }
  return record;
}
