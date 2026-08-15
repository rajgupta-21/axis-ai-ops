export interface VersionGap {
  major: number;
  minor: number;
  patch: number;
  description: string;
  insufficientData?: boolean;
}

export interface PlaybookTargetedPackage {
  name: string;
  installedVersion?: string;
  targetVersion?: string;
  versionGap?: VersionGap;
}

export interface PlaybookServiceImpact {
  name: string;
  state?: string;
  enabled?: boolean;
  currentlyRunning?: boolean;
}

export interface PlaybookConfigImpact {
  module: string;
  path?: string;
  description: string;
}

export interface PlaybookPortImpact {
  port: number;
  protocol?: string;
  state?: string;
  currentlyOpen?: boolean;
}

/** Populated only when the analysis originates from an uploaded Ansible playbook rather than a release lookup. */
export interface PlaybookImpactContext {
  targetedPackages: PlaybookTargetedPackage[];
  serviceChanges: PlaybookServiceImpact[];
  configChanges: PlaybookConfigImpact[];
  portChanges: PlaybookPortImpact[];
  opaqueTasks: string[];
  warnings: string[];
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

  playbook?: PlaybookImpactContext;
}
