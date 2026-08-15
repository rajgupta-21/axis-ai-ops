import { EmbeddingAdapter } from "./EmbeddingAdapter";
import { MockEmbeddingAdapter } from "./MockEmbeddingAdapter";
import { BedrockEmbeddingAdapter } from "./BedrockEmbeddingAdapter";
import { PineconeEmbeddingAdapter } from "./PineconeEmbeddingAdapter";

export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 1024);

let cached: EmbeddingAdapter | null = null;

/**
 * Selects the embedding model, via EMBEDDING_PROVIDER:
 *
 *   pinecone — Pinecone hosted inference (llama-text-embed-v2). Real model,
 *              reuses the vector index's API key.
 *   bedrock  — Amazon Titan / Cohere on Bedrock.
 *   mock     — deterministic hash vectors. NOT a real model; retrieval ranking
 *              is meaningless. Only for running without any credential.
 *
 * Defaults to whichever real provider has a key before falling back to mock, so
 * a configured deployment never silently embeds with hash vectors.
 */
export function createEmbeddingAdapter(): EmbeddingAdapter {
  if (cached) return cached;

  const provider = process.env.EMBEDDING_PROVIDER ?? defaultProvider();

  switch (provider) {
    case "pinecone":
      cached = new PineconeEmbeddingAdapter(EMBEDDING_DIMENSIONS);
      break;
    case "bedrock":
      cached = new BedrockEmbeddingAdapter(EMBEDDING_DIMENSIONS);
      break;
    case "mock":
    default:
      cached = new MockEmbeddingAdapter(EMBEDDING_DIMENSIONS);
      break;
  }

  return cached;
}

function defaultProvider(): string {
  if (process.env.PINECONE_API_KEY) return "pinecone";
  if (process.env.BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK) return "bedrock";
  return "mock";
}

export type { EmbeddingAdapter };
export type { EmbeddingKind } from "./EmbeddingAdapter";
