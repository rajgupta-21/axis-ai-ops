import { SoftwareComponent } from "@/domain/server";
import { findRemoteLocalBinaries, probeRemoteBinaryVersion } from "@/lib/remoteAnsible";
import { mapWithConcurrency } from "@/lib/concurrency";
import path from "node:path";

/**
 * Discovers software installed outside the package manager — built from source
 * with `make install`, or unpacked from a vendor tarball into /opt.
 *
 * The RPM database is authoritative for packaged software and knows nothing about
 * either case, so a host running a source-built nginx reports no nginx at all.
 * That is the gap this closes: without it, the most important software on a host
 * can be the one thing the impact report never mentions.
 */

/**
 * Ceiling on how many binaries are version-probed per collection. Each probe is
 * its own ansible run, so this bounds a pathological /opt tree (a bundled JDK or
 * node_modules directory can hold hundreds of executables) from turning one
 * collection into hundreds of SSH round trips.
 */
const MAX_PROBES = Number(process.env.SOURCE_PROBE_LIMIT ?? 25);

/** Probes run against the same host, so this stays low to avoid tripping sshd. */
const PROBE_CONCURRENCY = 4;

/**
 * Files that are executable but are not the program itself — wrappers, build
 * artifacts, and library shims that would each produce a meaningless row.
 * Shape-based, not a list of names, so it generalises to unfamiliar software.
 */
const NOT_A_PROGRAM = [
  /\.(so|so\.\d|a|la|o|py|pyc|sh|bash|pl|rb|js|json|conf|cfg|txt|md)$/i,
  /^(config|configure|install|uninstall|setup|activate|deactivate)$/i,
  /-config$/,
  /^lib/,
];

function looksLikeProgram(binaryPath: string): boolean {
  const base = path.basename(binaryPath);
  return !NOT_A_PROGRAM.some((pattern) => pattern.test(base));
}

/**
 * Extracts a version from a program's own `--version` output.
 *
 * Formats vary wildly — "nginx version: nginx/1.24.0", "Python 3.9.25",
 * "curl 8.17.0 (x86_64...)" — but nearly all of them contain a dotted numeric
 * token, so the first one that looks like a version is taken. Returns null
 * rather than guessing when there is none, so the caller can report the software
 * without inventing a version for it.
 */
export function extractVersion(output: string): string | null {
  // Prefer a "name/1.2.3" form when present: it is unambiguous and avoids
  // picking up an unrelated number earlier in the line.
  const slashed = output.match(/\/(\d+\.\d+(?:\.\d+)*[a-z0-9.-]*)/i);
  if (slashed) return slashed[1];

  // A lookbehind rather than \b, because \b matches *inside* a version: in
  // "node v22.23.1" it happily starts at the "23", silently reporting 23.1 for a
  // host running 22.23.1. Requiring that no digit or dot precedes the match
  // anchors it to the true start of the number.
  const dotted = output.match(/(?<![\d.])(\d+\.\d+(?:\.\d+)*[a-z0-9.-]*)/);
  return dotted ? dotted[1] : null;
}

/**
 * Derives the software name from the binary's path. Uses the /opt/<product>
 * directory name when the binary sits inside a self-contained tree, since that
 * names the product ("/opt/nginx/sbin/nginx" and "/opt/nginx/sbin/nginx-debug"
 * are both nginx), and the filename otherwise.
 */
export function deriveName(binaryPath: string): string {
  const optMatch = binaryPath.match(/^\/opt\/([^/]+)\//);
  if (optMatch) return optMatch[1].toLowerCase();
  return path.basename(binaryPath).toLowerCase();
}

export interface SourceSoftwareResult {
  software: SoftwareComponent[];
  /** Executables found before probing, for logging what was skipped. */
  discovered: number;
  probed: number;
}

/**
 * Finds and version-probes software installed outside the package manager.
 *
 * Never throws: discovery failures degrade to an empty result. This runs as one
 * part of a wider collection, and a host with an unreadable /opt should still
 * report its packaged software rather than failing the whole snapshot.
 */
export async function collectSourceInstalledSoftware(
  hostPattern: string,
  packagedNames: ReadonlySet<string>
): Promise<SourceSoftwareResult> {
  let binaries;
  try {
    binaries = await findRemoteLocalBinaries(hostPattern);
  } catch (error) {
    console.warn(
      `[sourceSoftware] discovery failed for "${hostPattern}":`,
      error instanceof Error ? error.message : error
    );
    return { software: [], discovered: 0, probed: 0 };
  }

  const candidates = binaries.map((b) => b.path).filter(looksLikeProgram);

  // One row per product, not per executable: a source install commonly drops
  // several binaries from the same project into the same prefix.
  const byName = new Map<string, string>();
  for (const binaryPath of candidates) {
    const name = deriveName(binaryPath);
    // Already reported by the RPM database — the package manager's version is
    // authoritative, and a duplicate row would double-count one decision.
    if (packagedNames.has(name)) continue;
    if (!byName.has(name)) byName.set(name, binaryPath);
  }

  const selected = [...byName.entries()].slice(0, MAX_PROBES);
  if (selected.length < byName.size) {
    console.warn(
      `[sourceSoftware] ${hostPattern}: probing ${selected.length} of ${byName.size} discovered programs ` +
        `(SOURCE_PROBE_LIMIT=${MAX_PROBES}); the rest are not reported.`
    );
  }

  const software = await mapWithConcurrency(selected, PROBE_CONCURRENCY, async ([name, binaryPath]) => {
    let output: string | null = null;
    try {
      output = await probeRemoteBinaryVersion(hostPattern, binaryPath);
    } catch (error) {
      console.warn(
        `[sourceSoftware] probe failed for ${binaryPath}:`,
        error instanceof Error ? error.message : error
      );
    }

    return {
      name,
      // "Insufficient data" is the codebase's existing marker for a version that
      // could not be established, and the comparison engine already treats it as
      // not-comparable rather than as a real version.
      version: (output && extractVersion(output)) ?? "Insufficient data",
      origin: "source" as const,
    };
  });

  return { software, discovered: binaries.length, probed: selected.length };
}
