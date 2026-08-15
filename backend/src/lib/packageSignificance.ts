import { ServiceInfo, SoftwareComponent } from "@/domain/server";
import { createChatModel } from "@/lib/chatModel";

/**
 * Name *shapes* that indicate a library, development artifact, or packaging
 * fragment rather than something an operator upgrades on purpose. These are
 * pulled in as dependencies and are updated by their parent.
 *
 * Note what this is not: it is not a list of packages. Every pattern here keys
 * off a naming convention (a "lib" prefix, a "-devel" suffix), so it applies
 * uniformly to packages nobody has seen before. Deciding which *specific*
 * software matters is the LLM's job below — hardcoding that list is what made
 * the previous version of this file wrong, because it could only ever recognise
 * software someone had thought to enumerate.
 */
const DEPENDENCY_NAME_PATTERNS: RegExp[] = [
  /^lib/,
  /-libs?$/,
  /-devel$/,
  /-headers$/,
  /-docs?$/,
  /-man$/,
  /-common$/,
  /-filesystem$/,
  /-fonts?$/,
  /-data$/,
  /-locale/,
  /-langpack/,
  /-selinux$/,
  /^(python3?|perl|ruby|php|nodejs)-./, // language module packages, e.g. python3-pip
  /^(kernel|systemd)-./, // kernel/systemd sub-packages; the base package represents them
];

/**
 * True when the package looks like a sub-package of something else that is also
 * installed — e.g. "openssl-libs" alongside "openssl", or "httpd-tools"
 * alongside "httpd".
 *
 * This encodes the reporting rule: only the parent is worth recommending.
 * Upgrading the parent brings its own sub-packages with it, so listing them
 * separately just multiplies one decision into many rows.
 */
function isSubPackageOfInstalled(name: string, installed: ReadonlySet<string>): boolean {
  const parts = name.split("-");
  for (let i = parts.length - 1; i > 0; i--) {
    const candidateParent = parts.slice(0, i).join("-");
    if (candidateParent !== name && installed.has(candidateParent)) {
      return true;
    }
  }
  return false;
}

function looksLikeDependency(name: string): boolean {
  return DEPENDENCY_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/** Normalizes "sshd.service" / "redis6.service" to a comparable base name. */
function serviceBaseName(serviceName: string): string {
  return serviceName
    .replace(/\.(service|socket|timer|target|mount)$/, "")
    .replace(/@.*$/, "")
    .toLowerCase();
}

/**
 * Packages that back a running service are high-impact as a matter of fact, not
 * of judgement — if it is running, restarting it has real blast radius. Matched
 * loosely in both directions because package and unit names often differ
 * slightly (httpd/apache2, sshd/openssh-server).
 */
function backsRunningService(name: string, runningServiceBases: ReadonlySet<string>): boolean {
  if (runningServiceBases.has(name)) return true;
  for (const base of runningServiceBases) {
    if (base.length >= 4 && (base.startsWith(name) || name.startsWith(base))) {
      return true;
    }
  }
  return false;
}

/**
 * How many candidate names go into one classification call. Large enough that a
 * typical host needs only one or two requests, small enough that the model
 * reliably returns a complete list rather than truncating it.
 */
const CLASSIFY_BATCH_SIZE = 120;

/** Classification is stable for a given package set, so it is cached per set. */
const CACHE_TTL_MS = 30 * 60 * 1000;
const classificationCache = new Map<string, { names: Set<string>; expiresAt: number }>();

function cacheKey(names: readonly string[]): string {
  // The candidate set fully determines the answer. Sorted so that collection
  // order cannot produce two cache entries for the same host.
  return [...names].sort().join(",");
}

const CLASSIFY_PROMPT = [
  "You are triaging installed packages on a Linux server for an upgrade-impact report.",
  "",
  'Return the packages that are "parent" software: something an operator would deliberately',
  "choose to install and upgrade as a unit, and whose upgrade needs planning. That includes",
  "services and daemons, databases and data stores, web servers and proxies, language runtimes,",
  "container and orchestration tooling, message brokers, and security-critical components.",
  "",
  "Exclude packages that only exist to support something else: shared libraries, fonts, icon or",
  "locale data, documentation, development headers, and low-level OS plumbing that is upgraded",
  "wholesale with the distribution rather than chosen. Most packages on a base OS image are",
  "plumbing and must be excluded; a typical batch yields only a handful of parents.",
  "",
  "Judge each name on what the software actually is. Do not assume a name is unimportant just",
  "because it is unfamiliar.",
  "",
  'Respond with JSON only, in the form {"parents": ["name", ...]}. Copy names exactly as given.',
  "Do not add names that are not in the list. No explanation.",
].join("\n");

/**
 * Asks the model which of these packages are parent software. Returns null when
 * no LLM is configured or the call fails, so the caller can fall back rather
 * than fail the request.
 */
async function classifyWithLlm(candidateNames: readonly string[]): Promise<Set<string> | null> {
  // Deliberately the capable model rather than the cheap extraction one. This is
  // a judgement call about what software is, not a mechanical pull of a string
  // from text: the 8B extraction model degenerates on this prompt, repeating a
  // single package name until it hits the completion-token cap and returns
  // truncated JSON.
  const model = createChatModel();
  if (!model) return null;

  const allowed = new Set(candidateNames);
  const selected = new Set<string>();

  for (let i = 0; i < candidateNames.length; i += CLASSIFY_BATCH_SIZE) {
    const batch = candidateNames.slice(i, i + CLASSIFY_BATCH_SIZE);

    let text: string;
    try {
      const response = await model.invoke([
        { role: "system", content: CLASSIFY_PROMPT },
        { role: "user", content: batch.join("\n") },
      ]);
      text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    } catch (error) {
      console.warn(
        "[packageSignificance] LLM classification failed, falling back to structural filtering:",
        error instanceof Error ? error.message : error
      );
      return null;
    }

    const names = parseParentNames(text);
    if (!names) {
      console.warn("[packageSignificance] could not parse classification response; falling back.");
      return null;
    }

    // Only names the model was actually given are accepted. Without this a
    // hallucinated or reformatted name would enter the report as installed
    // software and then get a release lookup of its own.
    for (const name of names) {
      if (allowed.has(name)) selected.add(name);
    }
  }

  return selected;
}

/** Pulls the name array out of a model response, tolerating prose or fences. */
function parseParentNames(text: string): string[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { parents?: unknown };
    if (!Array.isArray(parsed.parents)) return null;
    return parsed.parents.filter((n): n is string => typeof n === "string").map((n) => n.trim().toLowerCase());
  } catch {
    return null;
  }
}

export interface SignificanceResult {
  highImpact: SoftwareComponent[];
  /** Everything filtered out, kept for reporting counts rather than display. */
  excludedCount: number;
  /**
   * Which stage decided the final list. Surfaced so a degraded run is visible
   * as degraded instead of looking like a host that simply has less software.
   */
  classifier: "llm" | "structural";
}

/**
 * Reduces a full installed-package list to the software actually worth
 * analyzing for upgrade impact.
 *
 * A real host reports hundreds of packages, the vast majority of which are
 * libraries and sub-packages pulled in as dependencies. Reporting each one
 * separately would bury the handful of decisions that matter, and would mean a
 * web lookup per library. Since this system only produces reports and never
 * applies updates, the correct unit of reporting is the parent package an
 * operator would actually choose to upgrade.
 *
 * Two stages, in order of cost:
 *
 *  1. Structural filtering removes sub-packages and dependency-shaped names.
 *     Cheap, deterministic, and independent of which software exists.
 *  2. The remaining candidates are classified by an LLM, which decides what is
 *     parent software without needing a curated list of package names.
 *
 * Packages backing a running service bypass stage 2 — that is an observed fact
 * about the host, so it does not need a model's opinion. If no LLM is
 * configured, or the call fails, the stage-1 candidates are returned: a longer
 * list than ideal, never an empty or failed one.
 */
export async function selectHighImpactSoftware(
  software: readonly SoftwareComponent[],
  services: readonly ServiceInfo[] = []
): Promise<SignificanceResult> {
  const installed = new Set(software.map((s) => s.name.toLowerCase()));
  const runningServiceBases = new Set(
    services.filter((s) => s.status === "running").map((s) => serviceBaseName(s.name))
  );

  const candidates: SoftwareComponent[] = [];
  const alwaysInclude = new Set<string>();

  for (const item of software) {
    const name = item.name.toLowerCase();

    // Software installed outside the package manager was put there by hand, so
    // someone already made the "this matters" decision. It is also the software
    // most likely to be missed by an upgrade process, which makes it exactly
    // what the report should surface.
    if (item.origin === "source") {
      candidates.push(item);
      alwaysInclude.add(name);
      continue;
    }

    if (backsRunningService(name, runningServiceBases)) {
      candidates.push(item);
      alwaysInclude.add(name);
      continue;
    }

    // A dependency of something else installed is represented by its parent.
    if (isSubPackageOfInstalled(name, installed)) continue;
    if (looksLikeDependency(name)) continue;

    candidates.push(item);
  }

  const toClassify = candidates.map((c) => c.name.toLowerCase()).filter((n) => !alwaysInclude.has(n));

  let selectedNames: Set<string> | null = null;
  if (toClassify.length > 0) {
    const key = cacheKey(toClassify);
    const cached = classificationCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      selectedNames = cached.names;
    } else {
      selectedNames = await classifyWithLlm(toClassify);
      if (selectedNames) {
        classificationCache.set(key, { names: selectedNames, expiresAt: Date.now() + CACHE_TTL_MS });
      }
    }
  } else {
    selectedNames = new Set();
  }

  if (!selectedNames) {
    return {
      highImpact: candidates,
      excludedCount: software.length - candidates.length,
      classifier: "structural",
    };
  }

  const chosen = selectedNames;
  const highImpact = candidates.filter((item) => {
    const name = item.name.toLowerCase();
    return alwaysInclude.has(name) || chosen.has(name);
  });

  return {
    highImpact,
    excludedCount: software.length - highImpact.length,
    classifier: "llm",
  };
}
