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
import { logger } from "@/lib/logger";

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
  const startedAt = Date.now();
  logger.info("analysis", `Analysing "${component}" on server "${serverId}".`, {
    event: "analysis.started",
    serverId,
    context: { component },
  });

  const { snapshot, snapshotId } = await collectServerDataWithId(serverId);

  const installed = snapshot.software.find(
    (s) => s.name.toLowerCase() === component.toLowerCase()
  );
  if (!installed) {
    const error = new AppError(
      ErrorCodes.SOFTWARE_NOT_FOUND,
      `Software "${component}" is not installed on this server.`,
      404
    );
    logger.warn("analysis", error.message, {
      event: "analysis.software_not_found",
      serverId,
      durationMs: Date.now() - startedAt,
      context: { component, installedPackages: snapshot.software.length },
    });
    throw error;
  }

  const release = await getLatestRelease(installed.name, installed.version);
  const releaseId = await createReleaseInformation(release);

  // The version pair is the single most useful line in the trail: it is what
  // every later step reasons about, and "analysed the wrong version" is
  // otherwise invisible once the result is stored.
  logger.info("release", `Resolved ${installed.name} ${installed.version} → ${release.latestVersion}.`, {
    event: "release.resolved",
    serverId,
    context: {
      component: installed.name,
      currentVersion: installed.version,
      latestVersion: release.latestVersion,
      source: release.source,
    },
  });

  const comparison = compareServerToRelease(installed.name, snapshot, release);
  const comparisonId = await createComparison(snapshotId, releaseId, comparison);

  const modelStartedAt = Date.now();
  let agentResult;
  try {
    agentResult = await bedrockAdapter.analyzeImpact(comparison, snapshot, release);
  } catch (error) {
    // Surface the provider's own diagnosis. A rate limit, an expired key and a
    // malformed response are very different problems, and collapsing them into
    // one generic string makes a misconfigured or throttled model impossible to
    // diagnose from the UI.
    const detail = error instanceof Error ? error.message : "";
    logger.error("llm", `The model call failed while analysing "${component}".`, {
      event: "llm.failed",
      serverId,
      durationMs: Date.now() - modelStartedAt,
      context: { component, provider: process.env.BEDROCK_PROVIDER ?? "auto" },
      error,
    });
    throw new AppError(
      ErrorCodes.ANALYSIS_FAILED,
      detail
        ? `Impact analysis could not be completed: ${detail} The collected server and release comparison remains available.`
        : "Impact analysis could not be completed. The collected server and release comparison remains available.",
      502
    );
  }

  logger.info("llm", `Model returned an impact assessment for "${component}".`, {
    event: "llm.completed",
    serverId,
    durationMs: Date.now() - modelStartedAt,
    context: { component, reasoningSteps: agentResult.trace?.length ?? 0 },
  });

  const validated = ImpactAnalysisSchema.safeParse(agentResult.analysis);
  if (!validated.success) {
    // The schema issues are recorded because this failure is otherwise the
    // hardest kind to diagnose: the model answered, the API returned 502, and
    // nothing anywhere said which field was wrong.
    logger.error("analysis", "The model's structured result failed schema validation.", {
      event: "analysis.validation_failed",
      serverId,
      durationMs: Date.now() - startedAt,
      context: {
        component,
        issues: validated.error.issues.slice(0, 10).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    throw new AppError(
      ErrorCodes.VALIDATION_FAILED,
      "Impact analysis returned an invalid structured result and could not be stored.",
      502
    );
  }

  const analysisId = await createImpactAnalysis(serverId, comparisonId, validated.data, {
    reasoningTrace: agentResult.trace,
  });

  const record = await getAnalysisById(analysisId);
  if (!record) {
    logger.error("analysis", `Analysis ${analysisId} could not be read back after being created.`, {
      event: "analysis.readback_failed",
      serverId,
      analysisId,
      durationMs: Date.now() - startedAt,
    });
    throw new AppError(ErrorCodes.ANALYSIS_FAILED, "Analysis could not be retrieved after creation.", 500);
  }

  logger.info("analysis", `Analysis complete for "${component}": ${validated.data.impactLevel} impact.`, {
    event: "analysis.completed",
    serverId,
    analysisId,
    durationMs: Date.now() - startedAt,
    context: {
      component,
      impactLevel: validated.data.impactLevel,
      confidence: validated.data.confidence,
      currentVersion: installed.version,
      latestVersion: release.latestVersion,
    },
  });

  return record;
}
