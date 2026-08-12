import { prisma } from "@/lib/db";
import type { ImpactAnalysisGetPayload } from "@/generated/prisma/models/ImpactAnalysis";
import { ReleaseInformation } from "@/domain/release";
import { ComparisonResult } from "@/domain/comparison";
import { ImpactAnalysis, AnalysisRecord } from "@/domain/analysis";

export async function createReleaseInformation(release: ReleaseInformation): Promise<string> {
  const created = await prisma.releaseInformation.create({
    data: {
      software: release.software,
      currentVersion: release.currentVersion,
      latestVersion: release.latestVersion,
      releaseDate: release.releaseDate,
      changes: release.changes,
      securityChanges: release.securityChanges,
      configurationChanges: release.configurationChanges,
      compatibilityChanges: release.compatibilityChanges,
      source: release.source,
    },
  });
  return created.id;
}

export async function createComparison(
  snapshotId: string,
  releaseInformationId: string,
  comparison: ComparisonResult
): Promise<string> {
  const created = await prisma.comparison.create({
    data: {
      serverSnapshotId: snapshotId,
      releaseInformationId,
      component: comparison.component,
      versionGap: comparison.versionGap as unknown as object,
      securityChangesDetected: comparison.securityChanges,
      configurationChangesDetected: comparison.configurationChanges,
      serverDependencies: comparison.serverDependencies,
      riskFactors: comparison.riskFactors,
    },
  });
  return created.id;
}

export async function createImpactAnalysis(
  serverId: string,
  comparisonId: string,
  analysis: ImpactAnalysis
): Promise<string> {
  const created = await prisma.impactAnalysis.create({
    data: {
      serverId,
      comparisonId,
      impactLevel: analysis.impactLevel,
      confidence: analysis.confidence,
      executiveSummary: analysis.executiveSummary,
      reasoning: analysis.reasoning,
      risks: analysis.risks,
      securityImpact: analysis.securityImpact,
      compatibilityImpact: analysis.compatibilityImpact,
      operationalRisk: analysis.operationalRisk,
      performanceImpact: analysis.performanceImpact,
      recommendedActions: analysis.recommendedActions,
      preUpgradeChecks: analysis.preUpgradeChecks,
      rollbackConsiderations: analysis.rollbackConsiderations,
    },
  });
  return created.id;
}

const analysisInclude = {
  comparison: {
    include: { releaseInformation: true },
  },
  server: true,
} as const;

type AnalysisRow = ImpactAnalysisGetPayload<{ include: typeof analysisInclude }>;

function rowToRecord(row: AnalysisRow): AnalysisRecord {
  const release = row.comparison.releaseInformation;
  return {
    id: row.id,
    serverId: row.serverId,
    hostname: row.server.hostname,
    component: row.comparison.component,
    currentVersion: release.currentVersion,
    latestVersion: release.latestVersion,
    impactLevel: row.impactLevel,
    confidence: row.confidence,
    analysis: {
      impactLevel: row.impactLevel,
      confidence: row.confidence,
      executiveSummary: row.executiveSummary,
      reasoning: row.reasoning as string[],
      risks: row.risks as string[],
      securityImpact: row.securityImpact as string[],
      compatibilityImpact: row.compatibilityImpact as string[],
      operationalRisk: row.operationalRisk as string[],
      performanceImpact: row.performanceImpact as string[],
      recommendedActions: row.recommendedActions as string[],
      preUpgradeChecks: row.preUpgradeChecks as string[],
      rollbackConsiderations: row.rollbackConsiderations as string[],
    },
    comparison: {
      component: row.comparison.component,
      currentVersion: release.currentVersion,
      latestVersion: release.latestVersion,
      versionGap: row.comparison.versionGap as unknown as ComparisonResult["versionGap"],
      securityChanges: row.comparison.securityChangesDetected,
      configurationChanges: row.comparison.configurationChangesDetected,
      serverDependencies: row.comparison.serverDependencies as string[],
      riskFactors: row.comparison.riskFactors as string[],
    },
    release: {
      software: release.software,
      currentVersion: release.currentVersion,
      latestVersion: release.latestVersion,
      releaseDate: release.releaseDate,
      changes: release.changes as string[],
      securityChanges: release.securityChanges as string[],
      configurationChanges: release.configurationChanges as string[],
      compatibilityChanges: release.compatibilityChanges as string[],
      source: release.source,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAnalysisById(id: string): Promise<AnalysisRecord | null> {
  const row = await prisma.impactAnalysis.findUnique({
    where: { id },
    include: analysisInclude,
  });
  if (!row) return null;
  return rowToRecord(row);
}

export async function listAnalysesForServer(serverId: string): Promise<AnalysisRecord[]> {
  const rows = await prisma.impactAnalysis.findMany({
    where: { serverId },
    include: analysisInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(rowToRecord);
}

export async function listRecentAnalyses(limit: number): Promise<AnalysisRecord[]> {
  const rows = await prisma.impactAnalysis.findMany({
    include: analysisInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(rowToRecord);
}
