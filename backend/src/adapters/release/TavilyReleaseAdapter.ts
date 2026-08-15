import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { ReleaseAdapter } from "./ReleaseAdapter";
import { ReleaseInformation } from "@/domain/release";
import { createExtractionChat } from "@/lib/chatModel";
import { isRateLimitError, withRateLimitRetry } from "@/lib/rateLimit";

const INSUFFICIENT_DATA_TEXT = "Insufficient data";
const MAX_RESULTS = 3;
/** Search snippets are trimmed before reaching the LLM — token budgets are the binding constraint. */
const MAX_CONTENT_CHARS = 700;

/** Rejects pre-release markers so only stable versions are reported. */
const PRERELEASE = /(rc|alpha|beta|dev|nightly|preview|snapshot|pre)\d*$/i;

/**
 * Finds version numbers stated in search results without calling an LLM.
 *
 * Titles from release pages are highly structured ("OpenSSL 3.6.3 released",
 * "nginx-1.30.4"), so most lookups resolve here for zero tokens. That matters:
 * LLM providers cap tokens per day, and spending them on mechanical string
 * extraction starves the actual impact analysis.
 */
function extractVersionDeterministically(
  software: string,
  currentVersion: string,
  hits: SearchHit[]
): string | null {
  const name = software.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates: string[] = [];

  // Titles first — far less noisy than page bodies.
  for (const source of [hits.map((h) => h.title), hits.map((h) => h.content.slice(0, MAX_CONTENT_CHARS))]) {
    for (const text of source) {
      const haystack = text.toLowerCase();
      // Only trust a version when the software name appears alongside it.
      if (!haystack.replace(/[^a-z0-9]/g, "").includes(name)) continue;

      for (const match of text.matchAll(/\b(\d+\.\d+(?:\.\d+){0,2}(?:p\d+)?)\b/g)) {
        const version = match[1];
        if (!PRERELEASE.test(version) && !looksLikeYear(version) && !looksLikeDistroRelease(version)) {
          candidates.push(version);
        }
      }
    }
    if (candidates.length > 0) break;
  }

  return pickPlausibleVersion(candidates, currentVersion);
}

/**
 * Guards against dates masquerading as versions — "2026.08", but also compact
 * forms like "20251212" that appear in changelog headings. Any component large
 * enough to be a year or a packed date is treated as a date.
 */
function looksLikeYear(version: string): boolean {
  const first = Number(version.split(/[.p]/)[0]);
  if (first >= 1990 && first <= 2100) return true;
  // 6+ digit leading component is a packed date (20251212), never a version.
  return first > 100000;
}

/**
 * Ubuntu-style release numbers (22.04, 24.10) appear constantly on pages that
 * discuss a package *on* a distro, and are a common false positive — search
 * results for "openssh latest version" readily yield "22.04".
 */
function looksLikeDistroRelease(version: string): boolean {
  return /^\d{2}\.(04|10)(\.\d+)?$/.test(version);
}

/**
 * Chooses the best candidate using the installed version as an anchor.
 *
 * Search results mix in versions belonging to other software entirely, so
 * "highest number wins" is wrong — it produced Ubuntu's 24.04 as sudo's latest
 * release. A genuine latest version almost always shares the installed major
 * version, or sits one or two majors ahead. Anything further is treated as
 * belonging to something else and discarded, since reporting nothing is better
 * than reporting a confidently wrong upgrade target.
 */
function pickPlausibleVersion(candidates: string[], currentVersion: string): string | null {
  if (candidates.length === 0) return null;

  // A latest release cannot predate the installed version. When every candidate
  // is older, the search surfaced the wrong page (an old advisory, a distro's
  // backported build) — that is a failed lookup, not an answer. Without this,
  // results like "chrony 4.3 -> 4.0" or "nss 3.112.0 -> 3.73" get reported as
  // real upgrade targets.
  const notOlder = candidates.filter((v) => compareNumericVersions(v, currentVersion) >= 0);
  if (notOlder.length === 0) return null;

  const currentMajor = Number(currentVersion.split(/[.p-]/)[0]);
  if (!Number.isFinite(currentMajor)) {
    return highestVersion(notOlder);
  }

  const majorOf = (v: string) => Number(v.split(/[.p]/)[0]);

  const sameMajor = notOlder.filter((v) => majorOf(v) === currentMajor);
  if (sameMajor.length > 0) return highestVersion(sameMajor);

  // Allow a single major bump (e.g. openssl 3.x -> 4.x) but nothing wilder;
  // a larger jump almost always means the version belongs to other software.
  const nearbyMajor = notOlder.filter((v) => {
    const major = majorOf(v);
    return major === currentMajor + 1;
  });
  if (nearbyMajor.length > 0) return highestVersion(nearbyMajor);

  return null;
}

function highestVersion(versions: string[]): string {
  return versions.reduce((best, current) => (compareNumericVersions(current, best) > 0 ? current : best));
}

function compareNumericVersions(a: string, b: string): number {
  const pa = a.split(/[.p]/).map(Number);
  const pb = b.split(/[.p]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const ExtractionSchema = z.object({
  latestVersion: z.string(),
  releaseDate: z.string(),
  changes: z.array(z.string()),
  securityChanges: z.array(z.string()),
  configurationChanges: z.array(z.string()),
  compatibilityChanges: z.array(z.string()),
});

interface SearchHit {
  title: string;
  url: string;
  content: string;
}

function insufficientData(software: string, currentVersion: string, source = INSUFFICIENT_DATA_TEXT): ReleaseInformation {
  return {
    software,
    currentVersion,
    latestVersion: INSUFFICIENT_DATA_TEXT,
    releaseDate: INSUFFICIENT_DATA_TEXT,
    changes: [],
    securityChanges: [],
    configurationChanges: [],
    compatibilityChanges: [],
    source,
  };
}

/**
 * Looks up the latest release of a software component by searching the web with
 * Tavily and extracting a structured result from what the search actually
 * returned.
 *
 * Two anti-fabrication guarantees, because an LLM asked for "the latest
 * version" will happily invent a plausible one:
 *
 *  1. The prompt supplies only the retrieved text and forbids outside
 *     knowledge.
 *  2. More importantly, the extracted version string is mechanically verified
 *     to appear in the retrieved text. A version the search results never
 *     mentioned is discarded and reported as "Insufficient data" — prompt
 *     instructions alone are not treated as sufficient.
 *
 * Degrades to "Insufficient data" (never throws) when Tavily is unconfigured,
 * no LLM is available, the search fails, or nothing verifiable is found, so a
 * lookup failure can never block an analysis.
 */
export class TavilyReleaseAdapter implements ReleaseAdapter {
  async getLatestVersion(software: string, currentVersion: string): Promise<ReleaseInformation> {
    if (!process.env.TAVILY_API_KEY) {
      return insufficientData(software, currentVersion);
    }

    let hits: SearchHit[];
    try {
      hits = await this.search(software);
    } catch {
      return insufficientData(software, currentVersion);
    }
    if (hits.length === 0) {
      return insufficientData(software, currentVersion);
    }

    const corpus = hits
      .map((h) => `SOURCE: ${h.url}\nTITLE: ${h.title}\n${h.content.slice(0, MAX_CONTENT_CHARS)}`)
      .join("\n\n---\n\n");

    // Free path first: most release pages state the version plainly enough to
    // read without a model. Only fall back to the LLM when that fails, which
    // keeps the daily token budget available for the impact analysis itself.
    const deterministic = extractVersionDeterministically(software, currentVersion, hits);
    if (deterministic) {
      return {
        software,
        currentVersion,
        latestVersion: deterministic,
        releaseDate: INSUFFICIENT_DATA_TEXT,
        changes: [],
        securityChanges: extractSecurityMentions(corpus),
        configurationChanges: [],
        compatibilityChanges: [],
        source: hits[0].url,
      };
    }

    const model = createExtractionChat();
    if (!model) {
      return insufficientData(software, currentVersion, hits[0].url);
    }

    let extracted: z.infer<typeof ExtractionSchema>;
    try {
      extracted = await withRateLimitRetry(() =>
        model.withStructuredOutput(ExtractionSchema).invoke([
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(software, currentVersion, corpus) },
        ]) as Promise<z.infer<typeof ExtractionSchema>>,
        { label: `release extraction for ${software}`, attempts: 3 }
      );
    } catch (error) {
      // Distinguish a transient provider failure from a genuine "not found".
      // Reporting a rate limit as "Insufficient data" is actively misleading —
      // it implies the web has no answer when we simply never asked.
      const message = error instanceof Error ? error.message : String(error);
      if (isRateLimitError(message)) {
        console.warn(
          `[release] rate limited while extracting the latest version of "${software}"; reporting as unavailable rather than guessing.`
        );
      }
      return insufficientData(software, currentVersion, hits[0].url);
    }

    const version = extracted.latestVersion.trim().replace(/^v/i, "");
    // The model must clear the same bars as the deterministic path: present in
    // the sources, not a date, and plausible relative to what is installed.
    // Skipping these let results like acpid "20251212" (a changelog date)
    // through as an upgrade target.
    if (
      !version ||
      version === INSUFFICIENT_DATA_TEXT ||
      !isGroundedInCorpus(version, corpus) ||
      looksLikeYear(version) ||
      looksLikeDistroRelease(version) ||
      PRERELEASE.test(version) ||
      pickPlausibleVersion([version], currentVersion) === null
    ) {
      return insufficientData(software, currentVersion, hits[0].url);
    }

    return {
      software,
      currentVersion,
      latestVersion: version,
      releaseDate: extracted.releaseDate.trim() || INSUFFICIENT_DATA_TEXT,
      changes: clean(extracted.changes),
      securityChanges: clean(extracted.securityChanges),
      configurationChanges: clean(extracted.configurationChanges),
      compatibilityChanges: clean(extracted.compatibilityChanges),
      source: hits[0].url,
    };
  }

  private async search(software: string): Promise<SearchHit[]> {
    const tool = new TavilySearch({
      tavilyApiKey: process.env.TAVILY_API_KEY,
      maxResults: MAX_RESULTS,
      topic: "general",
    });

    const raw = await tool.invoke({
      query: `${software} latest stable release version changelog security fixes`,
    });

    return normalizeTavilyResults(raw);
  }
}

/**
 * Tavily's tool output shape varies by version — sometimes a JSON string,
 * sometimes an object with `results`. Normalizes defensively so an upstream
 * shape change degrades to "no hits" rather than a crash.
 */
function normalizeTavilyResults(raw: unknown): SearchHit[] {
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
      title: typeof item.title === "string" ? item.title : "",
      url: typeof item.url === "string" ? item.url : "",
      content: typeof item.content === "string" ? item.content : "",
    }))
    .filter((hit) => hit.url && hit.content);
}

/**
 * Verifies the version actually appears in the retrieved text. Compared with
 * separators normalized so "1.2.3" still matches "1_2_3" or "v1.2.3", but a
 * version the sources never mentioned cannot pass.
 */
function isGroundedInCorpus(version: string, corpus: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/^v/, "").replace(/[_-]/g, ".");
  const needle = normalize(version);
  if (needle.length < 2) return false;
  return normalize(corpus).includes(needle);
}

function clean(items: string[]): string[] {
  return items.map((i) => i.trim()).filter((i) => i.length > 0 && i !== INSUFFICIENT_DATA_TEXT);
}

/**
 * Pulls CVE identifiers and security sentences straight from the retrieved
 * text. Used on the deterministic path so a no-LLM lookup still reports real
 * security signal — every item is copied from a source, never inferred.
 */
function extractSecurityMentions(corpus: string): string[] {
  const found = new Set<string>();

  for (const match of corpus.matchAll(/\bCVE-\d{4}-\d{4,7}\b/gi)) {
    found.add(match[0].toUpperCase());
  }

  for (const sentence of corpus.split(/(?<=[.!?])\s+|\n/)) {
    const trimmed = sentence.trim();
    if (trimmed.length > 25 && trimmed.length < 220 && /\b(security fix|vulnerabilit|security release|security update)/i.test(trimmed)) {
      found.add(trimmed);
      if (found.size >= 6) break;
    }
  }

  return Array.from(found).slice(0, 6);
}

const SYSTEM_PROMPT = `You extract software release facts from supplied web search results.

Use ONLY the supplied search results. You must not use any knowledge of your own about version numbers, release dates, or changelogs.

If the search results do not clearly state the latest stable version, set "latestVersion" to exactly "Insufficient data". Never guess, never extrapolate a version number, and never assemble one from partial information. An honest "Insufficient data" is always preferable to a plausible-looking wrong version.

Rules:
- "latestVersion": the latest STABLE release version, copied verbatim as written in the sources. Ignore release candidates, betas, alphas, and nightly builds.
- "releaseDate": the release date of that version if stated, else "Insufficient data".
- "changes", "securityChanges", "configurationChanges", "compatibilityChanges": short bullet points quoted or closely paraphrased from the sources. Put CVE identifiers and security fixes under securityChanges. Put breaking changes, removals, and deprecations under compatibilityChanges. Use empty arrays when the sources say nothing.

Respond with a single JSON object matching the requested schema.`;

function buildPrompt(software: string, currentVersion: string, corpus: string): string {
  return `Software: ${software}
Currently installed version: ${currentVersion}

Web search results below are your ONLY source of truth.

${corpus}

Extract the latest stable version of "${software}" and its release details from the results above.`;
}
