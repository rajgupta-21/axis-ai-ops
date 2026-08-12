export interface SoftwareVersionInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  versionGapDescription: string;
  latestImpactLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}
