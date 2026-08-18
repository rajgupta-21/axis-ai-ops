/**
 * Read-only inspector for the pgvector knowledge base.
 *
 * Prisma Studio (`npm run db:studio`) already shows every other table, and it
 * shows this one too — but not the `embedding` column, because it is declared
 * Unsupported("vector(1024)") and Prisma Client cannot read it. That hides the
 * only thing that makes this table different from a log: whether similarity
 * search actually returns the right chunk.
 *
 * So Studio answers "what is stored"; this answers "what would the agent
 * retrieve, and how close is it". Nothing here writes.
 *
 *   npm run kb                        stats by component
 *   npm run kb -- list nginx          the stored chunks for one component
 *   npm run kb -- search nginx "tls"  what retrieve_context would rank first
 */
// Must precede the db import: lib/db reads DATABASE_URL at module load to build
// the connection adapter, so loading .env afterwards is too late and every
// query fails with ECONNREFUSED against the default.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { createEmbeddingAdapter } from "@/adapters/embedding";
import { searchKnowledgeChunks } from "@/repositories/knowledgeRepository";

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

async function stats(): Promise<void> {
  const [totals] = await prisma.$queryRawUnsafe<{ chunks: number; components: number }[]>(
    `select count(*)::int as chunks, count(distinct component)::int as components from knowledge_chunks`
  );

  if (!totals || totals.chunks === 0) {
    console.log("The knowledge base is empty. It fills as analyses run — the agent ingests what it");
    console.log("finds while reasoning, so run an analysis and check back.");
    return;
  }

  console.log(`${totals.chunks} chunks across ${totals.components} components\n`);

  const rows = await prisma.$queryRawUnsafe<
    { component: string; n: number; sources: number; last: Date }[]
  >(
    `select component, count(*)::int as n, count(distinct source_url)::int as sources, max(created_at) as last
     from knowledge_chunks group by component order by n desc, component asc limit 40`
  );

  console.log("component".padEnd(28) + "chunks".padStart(7) + "sources".padStart(9) + "   last ingested");
  console.log("-".repeat(78));
  for (const r of rows) {
    console.log(
      r.component.slice(0, 27).padEnd(28) +
        String(r.n).padStart(7) +
        String(r.sources).padStart(9) +
        "   " +
        new Date(r.last).toISOString().replace("T", " ").slice(0, 16)
    );
  }
  if (totals.components > rows.length) {
    console.log(`\n… and ${totals.components - rows.length} more components.`);
  }
}

async function list(component: string): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<
    { chunk_text: string; version: string | null; source_url: string | null; created_at: Date }[]
  >(
    `select chunk_text, version, source_url, created_at from knowledge_chunks
     where component = $1 order by created_at desc`,
    component.toLowerCase()
  );

  if (rows.length === 0) {
    console.log(`No chunks stored for "${component}".`);
    return;
  }

  console.log(`${rows.length} chunk(s) for "${component}"\n`);
  rows.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(3)}. ${truncate(r.chunk_text, 150)}`);
    console.log(
      `     version=${r.version ?? "—"}  source=${r.source_url ?? "—"}  ` +
        `ingested=${new Date(r.created_at).toISOString().slice(0, 10)}`
    );
  });
}

async function search(component: string, query: string): Promise<void> {
  // Deliberately the same adapter and the same query function the agent's
  // retrieve_context node uses, so what prints here is what the agent sees —
  // not an approximation of it.
  const adapter = createEmbeddingAdapter();
  console.log(`Embedding query with ${adapter.label}…`);

  const embedding = await adapter.embed(query, "query");
  const matches = await searchKnowledgeChunks(component.toLowerCase(), embedding, 8);

  if (matches.length === 0) {
    console.log(`No chunks stored for "${component}", so retrieval would return nothing.`);
    return;
  }

  console.log(`\nTop ${matches.length} for "${query}" in "${component}":\n`);
  matches.forEach((m, i) => {
    // The repository returns cosine distance; similarity is the complement, and
    // is what the agent's prompt is given.
    const similarity = 1 - m.distance;
    const bar = "█".repeat(Math.max(0, Math.round(similarity * 20)));
    console.log(
      `${String(i + 1).padStart(2)}. ${similarity.toFixed(3)} ${bar.padEnd(20)} ${truncate(m.chunkText, 110)}`
    );
    if (m.sourceUrl) console.log(`    ${m.sourceUrl}`);
  });
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  try {
    if (!command || command === "stats") {
      await stats();
    } else if (command === "list" && rest[0]) {
      await list(rest[0]);
    } else if (command === "search" && rest.length >= 2) {
      await search(rest[0], rest.slice(1).join(" "));
    } else {
      console.log("Usage:");
      console.log("  npm run kb                          stats by component");
      console.log("  npm run kb -- list <component>      stored chunks for a component");
      console.log("  npm run kb -- search <component> <query>");
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
