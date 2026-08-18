export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
export type AnalysisSource = "RELEASE_LOOKUP" | "PLAYBOOK";

export interface ImpactAnalysis {
  impactLevel: ImpactLevel;
  confidence: ConfidenceLevel;

  executiveSummary: string;

  reasoning: string[];

  risks: string[];

  securityImpact: string[];

  compatibilityImpact: string[];

  operationalRisk: string[];

  performanceImpact: string[];

  recommendedActions: string[];

  preUpgradeChecks: string[];

  rollbackConsiderations: string[];
}

/**
 * "warning" marks a step that completed but produced a result the reader should
 * not take at face value — currently, finalizing over a reviewer objection the
 * revision budget could not resolve.
 */
export type ReasoningTraceNodeStatus = "ok" | "looped" | "simulated" | "warning";

export interface ReasoningTraceStep {
  node: string;
  label: string;
  status: ReasoningTraceNodeStatus;
  startedAt: string;
  endedAt: string;
  summary: string;
  detail?: Record<string, unknown>;
}

export interface AnalysisAgentResult {
  analysis: ImpactAnalysis;
  trace: ReasoningTraceStep[];
}

export type AnalysisStage =
  | "idle"
  | "collecting"
  | "checking-release"
  | "comparing"
  | "analyzing"
  | "generating-report"
  | "completed"
  | "failed";

export interface AnalysisRecord {
  id: string;
  serverId: string;
  hostname: string;
  component: string;
  currentVersion: string;
  latestVersion: string;
  impactLevel: ImpactLevel;
  confidence: ConfidenceLevel;
  source: AnalysisSource;
  analysis: ImpactAnalysis;
  comparison: import("./comparison").ComparisonResult;
  release: import("./release").ReleaseInformation;
  reasoningTrace: ReasoningTraceStep[];
  createdAt: string;
}
