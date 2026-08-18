import { z } from "zod";

export const ImpactAnalysisSchema = z.object({
  impactLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  executiveSummary: z.string().min(1),
  reasoning: z.array(z.string()),
  risks: z.array(z.string()),
  securityImpact: z.array(z.string()),
  compatibilityImpact: z.array(z.string()),
  operationalRisk: z.array(z.string()),
  performanceImpact: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  preUpgradeChecks: z.array(z.string()),
  rollbackConsiderations: z.array(z.string()),
});

export type ImpactAnalysisParsed = z.infer<typeof ImpactAnalysisSchema>;

// Removed: parseAndValidateImpactAnalysis and its extractJsonCandidate helper.
// Both were unreferenced, and duplicated the JSON-extraction logic that is
// actually used, in agent/reasoningModel.ts (extractJsonObject). Two copies of
// a parser that must tolerate exactly the same model quirks is a bug waiting to
// happen — a fix applied to one would silently miss the other.
