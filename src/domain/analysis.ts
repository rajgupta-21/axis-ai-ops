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

export type ReasoningTraceNodeStatus = "ok" | "looped" | "simulated";

export interface ReasoningTraceStep {
  node: string;
  label: string;
  status: ReasoningTraceNodeStatus;
  startedAt: string;
  endedAt: string;
  summary: string;
  detail?: Record<string, unknown>;
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
