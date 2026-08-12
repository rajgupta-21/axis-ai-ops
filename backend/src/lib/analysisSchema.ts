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

/**
 * Attempts to extract a JSON object from a raw LLM text response, tolerating
 * markdown code fences or leading/trailing prose, then validates it against
 * the required structured output shape. Never repairs by inventing values —
 * only strips surrounding non-JSON text.
 */
export function parseAndValidateImpactAnalysis(raw: string): ImpactAnalysisParsed {
  const candidate = extractJsonCandidate(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error("Impact analysis response was not valid JSON.");
  }

  const result = ImpactAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Impact analysis response failed validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  return result.data;
}

function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}
