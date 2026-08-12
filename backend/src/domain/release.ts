export interface ReleaseInformation {
  software: string;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  changes: string[];
  securityChanges: string[];
  configurationChanges: string[];
  compatibilityChanges: string[];
  source: string;
}
