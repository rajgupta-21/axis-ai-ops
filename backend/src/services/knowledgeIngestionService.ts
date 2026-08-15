import { ReleaseInformation } from "@/domain/release";
import { createEmbeddingAdapter } from "@/adapters/embedding";
import { upsertKnowledgeChunk } from "@/repositories/knowledgeRepository";

const embeddingAdapter = createEmbeddingAdapter();

const INSUFFICIENT_DATA_TEXT = "Insufficient data";

/**
 * Chunks and embeds a release's already-fetched, real changelog lines
 * (changes/securityChanges/configurationChanges/compatibilityChanges) into
 * the knowledge_chunks table, so future analyses of the same component can
 * retrieve them by similarity even if the deterministic regex bucketing
 * (OfficialReleaseAdapter) missed a relevant passage. No separate scraping
 * pipeline — this only re-embeds data the app already fetched and trusts.
 * Skipped for releases with no real data (SimulatedReleaseAdapter or a
 * failed lookup), so the knowledge base never fills with fabricated text.
 */
/**
 * Persists findings the agent fetched mid-reasoning so the next analysis of the
 * same component can retrieve them from the knowledge base instead of paying for
 * another search. Best-effort: callers ignore failures.
 */
export async function ingestWebFindings(
  component: string,
  findings: readonly { chunkText: string; sourceUrl: string | null }[]
): Promise<void> {
  const unique = new Map<string, { chunkText: string; sourceUrl: string | null }>();
  for (const finding of findings) {
    const text = finding.chunkText.trim();
    if (text.length > 0) unique.set(text, finding);
  }

  await Promise.all(
    Array.from(unique.values()).map(async (finding) => {
      const embedding = await embeddingAdapter.embed(finding.chunkText, "passage");
      await upsertKnowledgeChunk({
        component: component.toLowerCase(),
        version: null,
        sourceUrl: finding.sourceUrl,
        chunkText: finding.chunkText,
        embedding,
      });
    })
  );
}

export async function ingestReleaseNotes(release: ReleaseInformation): Promise<void> {
  if (release.latestVersion === INSUFFICIENT_DATA_TEXT || release.source === INSUFFICIENT_DATA_TEXT) {
    return;
  }

  const lines = [
    ...release.changes,
    ...release.securityChanges,
    ...release.configurationChanges,
    ...release.compatibilityChanges,
  ].filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return;
  }

  await Promise.all(
    lines.map(async (line) => {
      const embedding = await embeddingAdapter.embed(line, "passage");
      await upsertKnowledgeChunk({
        component: release.software.toLowerCase(),
        version: release.latestVersion,
        sourceUrl: release.source,
        chunkText: line,
        embedding,
      });
    })
  );
}
