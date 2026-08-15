import { ReleaseAdapter } from "./ReleaseAdapter";
import { ReleaseInformation } from "@/domain/release";

interface GitHubRepoMapping {
  owner: string;
  repo: string;
}

/**
 * Maps a software name to the public GitHub repository whose Releases API
 * is treated as the authoritative source for its latest version and
 * changelog. This is the "web search" step of the pipeline — a real,
 * unauthenticated HTTPS call to a public API, never a scrape of arbitrary
 * third-party pages.
 */
const GITHUB_SOURCES: Record<string, GitHubRepoMapping> = {
  postgresql: { owner: "postgres", repo: "postgres" },
  redis: { owner: "redis", repo: "redis" },
  node: { owner: "nodejs", repo: "node" },
  nginx: { owner: "nginx", repo: "nginx" },
};

const INSUFFICIENT_DATA_TEXT = "Insufficient data";

function insufficientData(software: string, currentVersion: string): ReleaseInformation {
  return {
    software,
    currentVersion,
    latestVersion: INSUFFICIENT_DATA_TEXT,
    releaseDate: INSUFFICIENT_DATA_TEXT,
    changes: [],
    securityChanges: [],
    configurationChanges: [],
    compatibilityChanges: [],
    source: INSUFFICIENT_DATA_TEXT,
  };
}

function bucketChangelogLines(body: string): {
  changes: string[];
  securityChanges: string[];
  configurationChanges: string[];
  compatibilityChanges: string[];
} {
  const changes: string[] = [];
  const securityChanges: string[] = [];
  const configurationChanges: string[] = [];
  const compatibilityChanges: string[] = [];

  const lines = body
    .split("\n")
    .map((line) => line.replace(/^[-*\s]+/, "").trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("security") || lower.includes("cve")) {
      securityChanges.push(line);
    } else if (lower.includes("config")) {
      configurationChanges.push(line);
    } else if (lower.includes("deprecat") || lower.includes("breaking")) {
      compatibilityChanges.push(line);
    } else {
      changes.push(line);
    }
  }

  return { changes, securityChanges, configurationChanges, compatibilityChanges };
}

interface GitHubReleaseResponse {
  tag_name?: string;
  published_at?: string;
  body?: string;
  html_url?: string;
}

/**
 * Production release adapter. Queries the public GitHub Releases API for
 * software with a known repository mapping and normalizes the result into
 * ReleaseInformation. Never invents data: unmapped software or any request
 * failure (network error, rate limit, missing release) degrades to the
 * same "Insufficient data" shape used by SimulatedReleaseAdapter, rather
 * than throwing or guessing.
 */
export class OfficialReleaseAdapter implements ReleaseAdapter {
  async getLatestVersion(software: string, currentVersion: string): Promise<ReleaseInformation> {
    const mapping = GITHUB_SOURCES[software.toLowerCase()];
    if (!mapping) {
      return insufficientData(software, currentVersion);
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${mapping.owner}/${mapping.repo}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } }
      );

      if (!response.ok) {
        return insufficientData(software, currentVersion);
      }

      const data = (await response.json()) as GitHubReleaseResponse;
      if (!data.tag_name) {
        return insufficientData(software, currentVersion);
      }

      const latestVersion = data.tag_name.replace(/^v/i, "");
      const buckets = bucketChangelogLines(data.body ?? "");

      return {
        software,
        currentVersion,
        latestVersion,
        releaseDate: data.published_at ?? INSUFFICIENT_DATA_TEXT,
        changes: buckets.changes,
        securityChanges: buckets.securityChanges,
        configurationChanges: buckets.configurationChanges,
        compatibilityChanges: buckets.compatibilityChanges,
        source: data.html_url ?? `https://github.com/${mapping.owner}/${mapping.repo}/releases/latest`,
      };
    } catch {
      return insufficientData(software, currentVersion);
    }
  }
}
