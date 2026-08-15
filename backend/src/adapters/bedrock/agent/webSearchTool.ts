import { TavilySearch } from "@langchain/tavily";
import { RetrievedReference } from "../prompt";

const MAX_RESULTS = 4;
const MAX_CONTENT_CHARS = 900;

export interface WebSearchResult {
  query: string;
  references: RetrievedReference[];
  error?: string;
}

/**
 * The agent's web-search capability.
 *
 * Distinct from the release adapter's use of Tavily: that runs once, on a fixed
 * query, before the agent starts. This is invoked *by* the agent, mid-reasoning,
 * with a query the agent composed itself — so it can go and find what it decided
 * was missing rather than only consuming what the pipeline happened to fetch.
 *
 * Returns results rather than throwing: a failed search should make the agent
 * proceed on the evidence it already has, never abort the analysis.
 */
export async function searchWeb(query: string): Promise<WebSearchResult> {
  if (!process.env.TAVILY_API_KEY) {
    return { query, references: [], error: "No Tavily API key is configured (TAVILY_API_KEY)." };
  }

  try {
    const tool = new TavilySearch({
      tavilyApiKey: process.env.TAVILY_API_KEY,
      maxResults: MAX_RESULTS,
      topic: "general",
    });

    const raw = await tool.invoke({ query });
    return { query, references: toReferences(raw) };
  } catch (error) {
    return {
      query,
      references: [],
      error: error instanceof Error ? error.message : "Web search failed.",
    };
  }
}

/**
 * Tavily's tool output shape varies by version — sometimes a JSON string,
 * sometimes an object with `results`. Normalized defensively so an upstream
 * shape change degrades to "no results" rather than crashing the agent.
 *
 * Similarity is reported as null: these come from a keyword search, not a
 * vector comparison, and inventing a score would misrepresent how they were
 * found.
 */
function toReferences(raw: unknown): RetrievedReference[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  const container = value as { results?: unknown } | unknown[];
  const list = Array.isArray(container) ? container : Array.isArray(container?.results) ? container.results : [];

  return (list as Record<string, unknown>[])
    .map((item) => ({
      chunkText: typeof item.content === "string" ? item.content.slice(0, MAX_CONTENT_CHARS) : "",
      sourceUrl: typeof item.url === "string" ? item.url : null,
      similarity: null,
      origin: "web_search" as const,
    }))
    .filter((ref) => ref.chunkText.length > 0);
}
