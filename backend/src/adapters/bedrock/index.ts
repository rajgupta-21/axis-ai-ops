import { BedrockAdapter } from "./BedrockAdapter";
import { ClaudeBedrockAdapter } from "./ClaudeBedrockAdapter";
import { MockBedrockAdapter } from "./MockBedrockAdapter";

let cached: BedrockAdapter | null = null;

export function createBedrockAdapter(): BedrockAdapter {
  if (cached) return cached;

  const provider =
    process.env.BEDROCK_PROVIDER ??
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? "bedrock" : "mock");

  switch (provider) {
    case "bedrock":
      cached = new ClaudeBedrockAdapter();
      break;
    case "mock":
    default:
      cached = new MockBedrockAdapter();
      break;
  }

  return cached;
}

export type { BedrockAdapter };
