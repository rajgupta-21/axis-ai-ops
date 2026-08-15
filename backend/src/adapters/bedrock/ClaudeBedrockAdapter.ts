import { BedrockAdapter } from "./BedrockAdapter";
import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";
import { AnalysisAgentResult } from "@/domain/analysis";
import { runImpactAnalysisAgent } from "./agent/graph";

/**
 * Runs the LangGraph impact-analysis agent (see ./agent/graph.ts) against
 * Amazon Bedrock. AWS credentials are read only from process.env on the
 * server and are never exposed to the frontend. This adapter performs no
 * shell execution, no SSH, and no server mutation — it only returns
 * structured impact analysis JSON plus the agent's reasoning trace.
 */
export class ClaudeBedrockAdapter implements BedrockAdapter {
  async analyzeImpact(
    comparison: ComparisonResult,
    serverSnapshot: ServerSnapshot,
    release: ReleaseInformation
  ): Promise<AnalysisAgentResult> {
    try {
      return await runImpactAnalysisAgent(comparison, serverSnapshot, release);
    } catch (error) {
      // Only the cause — impactAnalysisService adds the user-facing framing, so
      // repeating it here produced a doubled "could not be completed" message.
      throw new Error(
        `agent invocation failed (${error instanceof Error ? error.message : "unknown error"})`
      );
    }
  }
}
