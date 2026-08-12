import { ReleaseAdapter } from "./ReleaseAdapter";
import { ReleaseInformation } from "@/domain/release";

interface KnownReleaseDefinition {
  latestVersion: string;
  releaseDate: string;
  changes: string[];
  securityChanges: string[];
  configurationChanges: string[];
  compatibilityChanges: string[];
  source: string;
}

/**
 * The only location in the system responsible for simulated release data.
 * Modeled after the kind of information an official source (project release
 * pages, changelogs, GitHub releases, vendor APIs) would provide.
 */
const KNOWN_RELEASES: Record<string, KnownReleaseDefinition> = {
  nginx: {
    latestVersion: "1.26.2",
    releaseDate: "2026-01-01",
    changes: [
      "Security improvements",
      "HTTP/2 behavior changes",
      "Configuration directive changes",
    ],
    securityChanges: ["Security fixes for HTTP/2 request handling"],
    configurationChanges: ["HTTP/2 configuration behavior changed"],
    compatibilityChanges: [],
    source: "official nginx release notes (nginx.org/en/CHANGES)",
  },
  postgresql: {
    latestVersion: "15.7",
    releaseDate: "2026-02-13",
    changes: ["Cumulative bug fixes", "Security patches", "Planner reliability fixes"],
    securityChanges: ["Security patches included in cumulative update"],
    configurationChanges: [],
    compatibilityChanges: [],
    source: "official PostgreSQL release notes (postgresql.org/support/versioning)",
  },
  node: {
    latestVersion: "20.19.0",
    releaseDate: "2026-02-01",
    changes: ["V8 engine update", "npm updates", "Security fixes"],
    securityChanges: ["OpenSSL security update bundled with runtime"],
    configurationChanges: [],
    compatibilityChanges: ["Minimum supported OpenSSL version updated"],
    source: "official Node.js release notes (nodejs.org/en/blog/release)",
  },
  redis: {
    latestVersion: "7.4.2",
    releaseDate: "2026-01-20",
    changes: ["Performance improvements", "New commands", "Bug fixes"],
    securityChanges: ["Security patch for RESP3 protocol parsing"],
    configurationChanges: ["maxmemory-policy default behavior reviewed"],
    compatibilityChanges: [],
    source: "official Redis release notes (redis.io/docs/latest/operate/release-notes)",
  },
};

export class SimulatedReleaseAdapter implements ReleaseAdapter {
  async getLatestVersion(
    software: string,
    currentVersion: string
  ): Promise<ReleaseInformation> {
    const key = software.toLowerCase();
    const known = KNOWN_RELEASES[key];

    if (!known) {
      return {
        software,
        currentVersion,
        latestVersion: "Insufficient data",
        releaseDate: "Insufficient data",
        changes: [],
        securityChanges: [],
        configurationChanges: [],
        compatibilityChanges: [],
        source: "Insufficient data",
      };
    }

    return {
      software,
      currentVersion,
      latestVersion: known.latestVersion,
      releaseDate: known.releaseDate,
      changes: [...known.changes],
      securityChanges: [...known.securityChanges],
      configurationChanges: [...known.configurationChanges],
      compatibilityChanges: [...known.compatibilityChanges],
      source: known.source,
    };
  }
}
