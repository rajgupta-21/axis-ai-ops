import { EmbeddingAdapter, EmbeddingKind } from "./EmbeddingAdapter";

const EMBED_URL = "https://api.pinecone.io/embed";
const API_VERSION = "2025-04";
const DEFAULT_MODEL = "llama-text-embed-v2";
const TIMEOUT_MS = 20_000;

interface EmbedResponseItem {
  values?: number[];
}

/**
 * Real embeddings from Pinecone's hosted inference API (llama-text-embed-v2 by
 * default). Uses the same API key as the vector index, so no separate embedding
 * provider or credential is needed.
 *
 * Passages and queries are embedded with different input types, as the model
 * expects — see EmbeddingKind.
 */
export class PineconeEmbeddingAdapter implements EmbeddingAdapter {
  readonly label: string;
  readonly dimensions: number;

  private readonly model: string;
  private readonly apiKey: string;

  constructor(dimensions: number) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("No Pinecone API key is configured. Set PINECONE_API_KEY in backend/.env.");
    }
    this.apiKey = apiKey;
    this.model = process.env.EMBEDDING_MODEL_ID || DEFAULT_MODEL;
    this.dimensions = dimensions;
    this.label = `${this.model} on Pinecone`;
  }

  async embed(text: string, kind: EmbeddingKind = "passage"): Promise<number[]> {
    const response = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "Api-Key": this.apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        // "truncate: END" keeps long release notes from failing outright.
        parameters: { input_type: kind, truncate: "END" },
        inputs: [{ text }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Pinecone embedding failed (HTTP ${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as { data?: EmbedResponseItem[]; embeddings?: EmbedResponseItem[] };
    const values = (payload.data ?? payload.embeddings ?? [])[0]?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("Pinecone embedding response contained no vector.");
    }
    if (values.length !== this.dimensions) {
      // A silent dimension mismatch corrupts the vector store, so fail loudly.
      throw new Error(
        `Pinecone returned a ${values.length}-dimension vector but EMBEDDING_DIMENSIONS is ${this.dimensions}.`
      );
    }

    return values;
  }
}
