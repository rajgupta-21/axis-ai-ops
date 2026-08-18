import { ChatGroq } from "@langchain/groq";
import { ChatBedrockConverse } from "@langchain/aws";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_BEDROCK_MODEL = "eu.amazon.nova-lite-v1:0";

export function groqModelId(): string {
  return process.env.GROQ_MODEL_ID ?? DEFAULT_GROQ_MODEL;
}

export function bedrockModelId(): string {
  return process.env.BEDROCK_MODEL_ID ?? DEFAULT_BEDROCK_MODEL;
}

export function createGroqChat(): BaseChatModel {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No Groq API key is configured. Set GROQ_API_KEY in backend/.env.");
  }

  return new ChatGroq({
    apiKey,
    model: groqModelId(),
    temperature: 0,
    // Groq rate-limits per minute on free tiers; a couple of retries smooths
    // over a burst without stalling for long.
    maxRetries: 2,
  });
}

export function createBedrockChat(): BaseChatModel {
  const bearer = process.env.BEDROCK_API_KEY ?? process.env.AWS_BEARER_TOKEN_BEDROCK;

  return new ChatBedrockConverse({
    region: process.env.AWS_REGION ?? "us-east-1",
    model: bedrockModelId(),
    temperature: 0,
    ...(bearer
      ? { bedrockBearerToken: bearer }
      : process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              sessionToken: process.env.AWS_SESSION_TOKEN,
            },
          }
        : {}),
  });
}

/**
 * A general-purpose chat model for callers outside the agent (currently the
 * Tavily release adapter, which needs to extract a version from search
 * results). Returns null when no LLM provider is configured, so callers can
 * degrade to "Insufficient data" rather than throwing.
 */
export function createChatModel(): BaseChatModel | null {
  switch (process.env.BEDROCK_PROVIDER) {
    case "groq":
      return process.env.GROQ_API_KEY ? createGroqChat() : null;
    case "bedrock":
      return createBedrockChat();
    default:
      // local / mock run without any LLM.
      return process.env.GROQ_API_KEY ? createGroqChat() : null;
  }
}

/**
 * A deliberately small, cheap model for mechanical extraction work (pulling a
 * version string out of search results). Kept separate from the agent's
 * reasoning model because token-per-day quotas are per-model: burning the
 * capable model on extraction starves the actual analysis. Extraction accuracy
 * is also guarded mechanically downstream, so a small model is sufficient.
 */
export function createExtractionChat(): BaseChatModel | null {
  if (!process.env.GROQ_API_KEY) return createChatModel();

  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.RELEASE_EXTRACTION_MODEL_ID ?? "openai/gpt-oss-20b",
    temperature: 0,
    maxRetries: 1,
  });
}

/** Label describing the active chat model, for traces and logs. */
export function describeChatModel(): string {
  switch (process.env.BEDROCK_PROVIDER) {
    case "groq":
      return `${groqModelId()} on Groq`;
    case "bedrock":
      return `${bedrockModelId()} on Amazon Bedrock`;
    default:
      return process.env.GROQ_API_KEY ? `${groqModelId()} on Groq` : "no LLM configured";
  }
}
