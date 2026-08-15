/**
 * Retrieval models are asymmetric: a stored document and a search query are
 * embedded differently by design. llama-text-embed-v2 (and most modern
 * retrieval models) expect this distinction, and ignoring it measurably
 * degrades ranking quality.
 */
export type EmbeddingKind = "passage" | "query";

export interface EmbeddingAdapter {
  /** Human-readable model description, for logs and system info. */
  readonly label: string;
  readonly dimensions: number;

  embed(text: string, kind?: EmbeddingKind): Promise<number[]>;
}
