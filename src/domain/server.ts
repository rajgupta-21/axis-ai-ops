export type ServerStatus = "healthy" | "warning" | "critical" | "unknown";

export interface Server {
  id: string;
  hostname: string;
  ipAddress: string;
  os: {
    name: string;
    version: string;
  };
  status: ServerStatus;
  lastCollectedAt: string | null;
}

export interface SoftwareComponent {
  name: string;
  version: string;
}

export interface ServiceInfo {
  name: string;
  status: "running" | "stopped" | "unknown";
}

export interface ConfigurationData {
  modules: string[];
  ports: number[];
  importantValues: Record<string, string>;
  installedPackages: string[];
}

export interface ServerSnapshot {
  serverId: string;
  hostname: string;
  ipAddress: string;

  os: {
    name: string;
    version: string;
  };

  kernel: string;
  architecture: string;

  cpu: {
    cores: number;
    usagePercent: number;
  };

  memory: {
    totalMB: number;
    usedPercent: number;
  };

  disk: {
    totalGB: number;
    usedPercent: number;
  };

  network?: {
    inboundMbps?: number;
    outboundMbps?: number;
  };

  software: SoftwareComponent[];

  services: ServiceInfo[];

  modules: string[];

  configuration: ConfigurationData;

  collectedAt: string;
}

export interface ServerDetails extends Server {
  snapshot: ServerSnapshot | null;
}

export interface ServerSummary extends Server {
  cpuUsagePercent: number | null;
  memoryUsedPercent: number | null;
  diskUsedPercent: number | null;
  softwareCount: number;
  latestImpactLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}
