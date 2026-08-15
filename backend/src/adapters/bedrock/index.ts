import { BedrockAdapter } from "./BedrockAdapter";
import { ClaudeBedrockAdapter } from "./ClaudeBedrockAdapter";
import { MockBedrockAdapter } from "./MockBedrockAdapter";

let cached: BedrockAdapter | null = null;

/**
 * True when some form of Bedrock credential is present — a Bedrock API key
 * (bearer auth) or a SigV4 access-key pair.
 */
export function hasBedrockCredentials(): boolean {
  return Boolean(
    process.env.BEDROCK_API_KEY ||
      process.env.AWS_BEARER_TOKEN_BEDROCK ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  );
}

/**
 * Provider used when BEDROCK_PROVIDER is unset. Groq is preferred over Bedrock
 * when its key is present because it needs no region/model pairing to be right,
 * and falls back to the local deterministic agent so the app always runs.
 */
function defaultProvider(): string {
  if (process.env.GROQ_API_KEY) return "groq";
  if (hasBedrockCredentials()) return "bedrock";
  return "local";
}

export function createBedrockAdapter(): BedrockAdapter {
  if (cached) return cached;

  const provider = process.env.BEDROCK_PROVIDER ?? defaultProvider();

  switch (provider) {
    // All three run the LangGraph agent in adapters/bedrock/agent/graph.ts.
    // They differ only in what performs the three model calls — see
    // agent/createReasoningModel.ts.
    case "groq":
    case "bedrock":
    case "local":
      cached = new ClaudeBedrockAdapter();
      break;
    // Legacy rule-based path that bypasses the agent entirely.
    case "mock":
    default:
      cached = new MockBedrockAdapter();
      break;
  }

  return cached;
}

export type { BedrockAdapter };
