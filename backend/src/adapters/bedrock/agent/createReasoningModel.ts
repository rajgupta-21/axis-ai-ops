import { ReasoningModel } from "./reasoningModel";
import { BedrockReasoningModel } from "./BedrockReasoningModel";
import { GroqReasoningModel } from "./GroqReasoningModel";
import { LocalReasoningModel } from "./LocalReasoningModel";

/**
 * Chooses what performs the agent's three model calls. The LangGraph agent
 * itself is identical in every case:
 *
 *   BEDROCK_PROVIDER=groq     → real LLM on Groq (needs GROQ_API_KEY)
 *   BEDROCK_PROVIDER=bedrock  → real model on Amazon Bedrock (needs credentials
 *                               with bedrock:InvokeModel and available quota)
 *   BEDROCK_PROVIDER=local    → deterministic local reasoning, no network calls
 *
 * BEDROCK_PROVIDER=mock is handled a level up in adapters/bedrock/index.ts and
 * bypasses the agent entirely — it is the legacy rule-based path, not an agent.
 */
export function createReasoningModel(): ReasoningModel {
  switch (process.env.BEDROCK_PROVIDER) {
    case "groq":
      return new GroqReasoningModel();
    case "local":
      return new LocalReasoningModel();
    default:
      return new BedrockReasoningModel();
  }
}
