import { BedrockEmbeddings } from "@langchain/aws";
import { EmbeddingAdapter } from "./EmbeddingAdapter";

const DEFAULT_MODEL_ID = "amazon.titan-embed-text-v2:0";

/**
 * Calls a real Bedrock embedding model through LangChain's BedrockEmbeddings,
 * reusing the same AWS SDK credential chain as ClaudeBedrockAdapter (no
 * separate auth path). The model id and output dimensionality are read from
 * env so a different embedding model can be swapped in without code changes
 * — but the vector column width in the database migration must match
 * EMBEDDING_DIMENSIONS.
 */
export class BedrockEmbeddingAdapter implements EmbeddingAdapter {
  readonly label: string;
  readonly dimensions: number;

  private readonly embeddings: BedrockEmbeddings;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
    this.label = `${process.env.EMBEDDING_MODEL_ID ?? DEFAULT_MODEL_ID} on Amazon Bedrock`;
    const bearer = process.env.BEDROCK_API_KEY ?? process.env.AWS_BEARER_TOKEN_BEDROCK;

    this.embeddings = new BedrockEmbeddings({
      region: process.env.AWS_REGION ?? "us-east-1",
      model: process.env.EMBEDDING_MODEL_ID ?? DEFAULT_MODEL_ID,
      dimensions,
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

  // Titan does not expose an asymmetric passage/query mode, so the kind is
  // accepted for interface parity and not forwarded.
  async embed(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }
}
