export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

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
  analysis: ImpactAnalysis;
  comparison: import("./comparison").ComparisonResult;
  release: import("./release").ReleaseInformation;
  createdAt: string;
}
