import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

export interface KnowledgeChunkInput {
  component: string;
  version: string | null;
  sourceUrl: string | null;
  chunkText: string;
  embedding: number[];
}

export interface KnowledgeChunkMatch {
  chunkText: string;
  sourceUrl: string | null;
  distance: number;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Inserts a knowledge chunk unless an identical (component, version,
 * chunkText) row already exists — keeps re-ingesting the same release from
 * growing the table unboundedly. Uses raw SQL because the `embedding`
 * column is a pgvector `vector` type, which Prisma Client cannot read or
 * write natively (declared `Unsupported` in schema.prisma).
 */
export async function upsertKnowledgeChunk(input: KnowledgeChunkInput): Promise<void> {
  const id = randomUUID();
  const vectorLiteral = toVectorLiteral(input.embedding);

  await prisma.$executeRaw`
    INSERT INTO knowledge_chunks (id, component, version, source_url, chunk_text, embedding)
    SELECT ${id}, ${input.component}, ${input.version}, ${input.sourceUrl}, ${input.chunkText}, ${vectorLiteral}::vector
    WHERE NOT EXISTS (
      SELECT 1 FROM knowledge_chunks
      WHERE component = ${input.component}
        AND coalesce(version, '') = coalesce(${input.version}, '')
        AND chunk_text = ${input.chunkText}
    )
  `;
}

/**
 * Cosine-distance nearest-neighbor search scoped to a component, used by
 * the agent's retrieve_context node to ground reasoning in real, previously
 * ingested release text.
 */
export async function searchKnowledgeChunks(
  component: string,
  queryEmbedding: number[],
  limit: number
): Promise<KnowledgeChunkMatch[]> {
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  const rows = await prisma.$queryRaw<{ chunk_text: string; source_url: string | null; distance: number }[]>`
    SELECT chunk_text, source_url, embedding <=> ${vectorLiteral}::vector AS distance
    FROM knowledge_chunks
    WHERE component = ${component}
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    chunkText: row.chunk_text,
    sourceUrl: row.source_url,
    distance: row.distance,
  }));
}
