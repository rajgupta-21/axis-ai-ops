import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";
import { AnalysisAgentResult } from "@/domain/analysis";

export interface BedrockAdapter {
  analyzeImpact(
    comparison: ComparisonResult,
    serverSnapshot: ServerSnapshot,
    release: ReleaseInformation
  ): Promise<AnalysisAgentResult>;
}
