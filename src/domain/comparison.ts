export interface VersionGap {
  major: number;
  minor: number;
  patch: number;
  description: string;
  insufficientData?: boolean;
}

export interface ComparisonResult {
  component: string;

  currentVersion: string;
  latestVersion: string;

  versionGap: VersionGap;

  securityChanges: boolean;
  configurationChanges: boolean;

  serverDependencies: string[];

  riskFactors: string[];
}
