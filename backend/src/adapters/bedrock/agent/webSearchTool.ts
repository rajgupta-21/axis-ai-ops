import { TavilySearch } from "@langchain/tavily";
import { RetrievedReference } from "../prompt";

const MAX_RESULTS = 4;
const MAX_CONTENT_CHARS = 900;

/**
 * Hosts whose text may be written into the permanent knowledge base.
 *
 * Retrieved text is used two ways, and they carry very different risk. Using a
 * search result to reason about the analysis in front of you is transient — the
 * fenced prompt is what contains it. Writing it to knowledge_chunks is not: a
 * single poisoned or simply wrong page would be retrieved by every future
 * analysis of that component, indefinitely, with nothing to indicate where it
 * came from.
 *
 * So ingestion is restricted to sources that publish release information as
 * their purpose. Anything else is still read by the agent for this one run and
 * then discarded. Suffix-matched against the registrable domain, so
 * "downloads.example.redhat.com" matches "redhat.com" while
 * "redhat.com.attacker.net" does not.
 */
const INGESTIBLE_DOMAINS = [
  "github.com",
  "gitlab.com",
  "nginx.org",
  "apache.org",
  "postgresql.org",
  "mysql.com",
  "redis.io",
  "nodejs.org",
  "python.org",
  "kernel.org",
  "debian.org",
  "ubuntu.com",
  "redhat.com",
  "fedoraproject.org",
  "suse.com",
  "amazon.com",
  "amazonaws.com",
  "openssl.org",
  "openssh.com",
  "isc.org",
  "systemd.io",
  "gnu.org",
  "nist.gov",
  "mitre.org",
  "cisa.gov",
] as const;

/**
 * True when a URL's host is, or is a subdomain of, an allowlisted domain.
 * Parsed with the URL constructor rather than string matching so that
 * credentials, ports, and path tricks cannot smuggle a domain through.
 */
export function isIngestibleSource(sourceUrl: string | null): boolean {
  if (!sourceUrl) return false;

  let host: string;
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }

  return INGESTIBLE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

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
