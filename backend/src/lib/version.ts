import { VersionGap } from "@/domain/comparison";

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  wildcardPatch: boolean;
}

/**
 * Parses versions such as 1.24.0, 20.11.1, 15.4, 20.19.x.
 * Returns null when the string cannot be safely parsed rather than guessing.
 */
export function parseVersion(input: string): ParsedVersion | null {
  if (!input || typeof input !== "string") return null;
  const cleaned = input.trim().replace(/^v/i, "");
  const match = /^(\d+)\.(\d+)(?:\.(\d+|[xX]))?$/.exec(cleaned);
  if (!match) return null;

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patchRaw = match[3];

  if (patchRaw === undefined) {
    return { major, minor, patch: 0, wildcardPatch: false };
  }
  if (/^[xX]$/.test(patchRaw)) {
    return { major, minor, patch: 0, wildcardPatch: true };
  }
  return { major, minor, patch: Number.parseInt(patchRaw, 10), wildcardPatch: false };
}

export function compareVersions(currentVersion: string, latestVersion: string): VersionGap {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);

  if (!current || !latest) {
    return {
      major: 0,
      minor: 0,
      patch: 0,
      description: "Insufficient data",
      insufficientData: true,
    };
  }

  const major = latest.major - current.major;
  const minor = latest.minor - current.minor;
  const patch = latest.patch - current.patch;

  let description: string;
  if (major > 0) {
    description = `${major} major release${major === 1 ? "" : "s"} behind`;
  } else if (minor > 0) {
    description = `${minor} minor release${minor === 1 ? "" : "s"} behind`;
  } else if (patch > 0) {
    description = `${patch} patch release${patch === 1 ? "" : "s"} behind`;
  } else if (major === 0 && minor === 0 && patch === 0) {
    description = "Up to date";
  } else {
    description = "Current version is newer than the discovered release";
  }

  if (latest.wildcardPatch) {
    description += " (approximate — exact latest patch version unspecified)";
  }

  return { major, minor, patch, description };
}
