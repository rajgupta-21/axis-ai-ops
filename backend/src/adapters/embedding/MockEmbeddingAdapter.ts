import { EmbeddingAdapter } from "./EmbeddingAdapter";

/**
 * Deterministic, credential-free stand-in for a real Bedrock embedding
 * model. Hashes each token in the text into a fixed-size vector so that
 * semantically similar inputs (shared words) land closer together under
 * cosine distance, without ever calling out to AWS. Used when
 * EMBEDDING_PROVIDER=mock (the default), so the RAG retrieval path is fully
 * exercisable in local development without credentials.
 */
export class MockEmbeddingAdapter implements EmbeddingAdapter {
  readonly label = "deterministic hash vectors (NOT a real embedding model)";

  constructor(readonly dimensions: number) {}

  // The kind is accepted for interface parity but ignored: hash vectors have no
  // notion of asymmetric passage/query encoding.
  async embed(text: string): Promise<number[]> {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
      }
      const index = hash % this.dimensions;
      vector[index] += 1;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / magnitude);
  }
}
