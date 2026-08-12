import { AnsibleAdapter } from "./AnsibleAdapter";
import { Server, ServerDetails, ServerSnapshot } from "@/domain/server";

interface SimulatedServerDefinition {
  id: string;
  hostname: string;
  ipAddress: string;
  os: { name: string; version: string };
  kernel: string;
  architecture: string;
  cpuCores: number;
  cpuBaseline: number;
  memoryTotalMB: number;
  memoryBaseline: number;
  diskTotalGB: number;
  diskBaseline: number;
  network?: { inboundMbps: number; outboundMbps: number };
  software: { name: string; version: string }[];
  services: { name: string; status: "running" | "stopped" | "unknown" }[];
  modules: string[];
  ports: number[];
  importantValues: Record<string, string>;
  installedPackages: string[];
  status: "healthy" | "warning" | "critical" | "unknown";
}

/**
 * The only location in the system responsible for simulated Ansible/AWX data.
 * Server data is intentionally realistic and self-contained so it can be
 * swapped for AWXApiAdapter without touching services, API routes, or UI.
 */
const SIMULATED_SERVERS: SimulatedServerDefinition[] = [
  {
    id: "srv-001",
    hostname: "app-server-01",
    ipAddress: "10.0.1.25",
    os: { name: "Ubuntu", version: "22.04" },
    kernel: "5.15.0-119-generic",
    architecture: "x86_64",
    cpuCores: 4,
    cpuBaseline: 72,
    memoryTotalMB: 8192,
    memoryBaseline: 68,
    diskTotalGB: 100,
    diskBaseline: 61,
    network: { inboundMbps: 42, outboundMbps: 65 },
    software: [
      { name: "nginx", version: "1.24.0" },
      { name: "postgresql", version: "15.4" },
      { name: "node", version: "20.11.1" },
    ],
    services: [
      { name: "nginx", status: "running" },
      { name: "postgresql", status: "running" },
      { name: "node", status: "running" },
    ],
    modules: ["ssl", "http_v2"],
    ports: [80, 443, 5432, 3000],
    importantValues: {
      "nginx.worker_processes": "auto",
      "nginx.http2": "enabled",
      "postgresql.max_connections": "100",
    },
    installedPackages: ["nginx", "postgresql-15", "nodejs", "openssl", "curl"],
    status: "healthy",
  },
  {
    id: "srv-002",
    hostname: "app-server-02",
    ipAddress: "10.0.1.26",
    os: { name: "Ubuntu", version: "22.04" },
    kernel: "5.15.0-119-generic",
    architecture: "x86_64",
    cpuCores: 4,
    cpuBaseline: 58,
    memoryTotalMB: 8192,
    memoryBaseline: 55,
    diskTotalGB: 120,
    diskBaseline: 49,
    network: { inboundMbps: 30, outboundMbps: 40 },
    software: [
      { name: "nginx", version: "1.24.0" },
      { name: "node", version: "20.12.2" },
      { name: "redis", version: "7.2.4" },
    ],
    services: [
      { name: "nginx", status: "running" },
      { name: "node", status: "running" },
      { name: "redis", status: "running" },
    ],
    modules: ["ssl", "http_v2"],
    ports: [80, 443, 3000, 6379],
    importantValues: {
      "nginx.worker_processes": "auto",
      "redis.maxmemory_policy": "allkeys-lru",
    },
    installedPackages: ["nginx", "nodejs", "redis-server", "openssl"],
    status: "healthy",
  },
  {
    id: "srv-003",
    hostname: "web-server-01",
    ipAddress: "10.0.1.40",
    os: { name: "Ubuntu", version: "24.04" },
    kernel: "6.8.0-40-generic",
    architecture: "x86_64",
    cpuCores: 8,
    cpuBaseline: 42,
    memoryTotalMB: 16384,
    memoryBaseline: 48,
    diskTotalGB: 200,
    diskBaseline: 52,
    network: { inboundMbps: 120, outboundMbps: 210 },
    software: [
      { name: "nginx", version: "1.26.1" },
      { name: "node", version: "20.15.0" },
    ],
    services: [
      { name: "nginx", status: "running" },
      { name: "node", status: "running" },
    ],
    modules: ["ssl", "http_v2", "gzip"],
    ports: [80, 443, 3000],
    importantValues: {
      "nginx.worker_processes": "auto",
      "nginx.gzip": "enabled",
      "nginx.http2": "enabled",
    },
    installedPackages: ["nginx", "nodejs", "openssl", "gzip"],
    status: "healthy",
  },
  {
    id: "srv-004",
    hostname: "db-server-01",
    ipAddress: "10.0.1.30",
    os: { name: "Ubuntu", version: "22.04" },
    kernel: "5.15.0-119-generic",
    architecture: "x86_64",
    cpuCores: 8,
    cpuBaseline: 84,
    memoryTotalMB: 32768,
    memoryBaseline: 78,
    diskTotalGB: 500,
    diskBaseline: 73,
    network: { inboundMbps: 55, outboundMbps: 48 },
    software: [
      { name: "postgresql", version: "15.4" },
      { name: "nginx", version: "1.24.0" },
    ],
    services: [
      { name: "postgresql", status: "running" },
      { name: "nginx", status: "running" },
    ],
    modules: ["ssl"],
    ports: [5432, 80, 443],
    importantValues: {
      "postgresql.max_connections": "200",
      "postgresql.shared_buffers": "8GB",
    },
    installedPackages: ["postgresql-15", "nginx", "openssl"],
    status: "warning",
  },
  {
    id: "srv-005",
    hostname: "api-server-01",
    ipAddress: "10.0.1.50",
    os: { name: "Debian", version: "12" },
    kernel: "6.1.0-25-amd64",
    architecture: "x86_64",
    cpuCores: 4,
    cpuBaseline: 61,
    memoryTotalMB: 8192,
    memoryBaseline: 63,
    diskTotalGB: 80,
    diskBaseline: 58,
    network: { inboundMbps: 65, outboundMbps: 80 },
    software: [
      { name: "node", version: "20.11.1" },
      { name: "nginx", version: "1.24.0" },
    ],
    services: [
      { name: "node", status: "running" },
      { name: "nginx", status: "running" },
    ],
    modules: ["ssl", "http_v2"],
    ports: [80, 443, 3000],
    importantValues: {
      "nginx.worker_processes": "auto",
      "nginx.http2": "enabled",
    },
    installedPackages: ["nginx", "nodejs", "openssl"],
    status: "healthy",
  },
];

const lastCollectedAt = new Map<string, string>();

function jitter(base: number, spread: number): number {
  const value = base + (Math.random() * spread * 2 - spread);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toServer(def: SimulatedServerDefinition): Server {
  return {
    id: def.id,
    hostname: def.hostname,
    ipAddress: def.ipAddress,
    os: def.os,
    status: def.status,
    lastCollectedAt: lastCollectedAt.get(def.id) ?? null,
  };
}

function toSnapshot(def: SimulatedServerDefinition, collectedAt: string): ServerSnapshot {
  return {
    serverId: def.id,
    hostname: def.hostname,
    ipAddress: def.ipAddress,
    os: def.os,
    kernel: def.kernel,
    architecture: def.architecture,
    cpu: {
      cores: def.cpuCores,
      usagePercent: jitter(def.cpuBaseline, 4),
    },
    memory: {
      totalMB: def.memoryTotalMB,
      usedPercent: jitter(def.memoryBaseline, 3),
    },
    disk: {
      totalGB: def.diskTotalGB,
      usedPercent: jitter(def.diskBaseline, 1),
    },
    network: def.network,
    software: def.software.map((s) => ({ ...s })),
    services: def.services.map((s) => ({ ...s })),
    modules: [...def.modules],
    configuration: {
      modules: [...def.modules],
      ports: [...def.ports],
      importantValues: { ...def.importantValues },
      installedPackages: [...def.installedPackages],
    },
    collectedAt,
  };
}

export class SimulatedAnsibleAdapter implements AnsibleAdapter {
  private findDefinition(serverId: string): SimulatedServerDefinition {
    const def = SIMULATED_SERVERS.find((s) => s.id === serverId);
    if (!def) {
      throw new Error(`Server not found: ${serverId}`);
    }
    return def;
  }

  async getServers(): Promise<Server[]> {
    return SIMULATED_SERVERS.map(toServer);
  }

  async getServerDetails(serverId: string): Promise<ServerDetails> {
    const def = this.findDefinition(serverId);
    const collectedAt = lastCollectedAt.get(serverId);
    return {
      ...toServer(def),
      snapshot: collectedAt ? toSnapshot(def, collectedAt) : null,
    };
  }

  async collectServerData(serverId: string): Promise<ServerSnapshot> {
    const def = this.findDefinition(serverId);
    const collectedAt = new Date().toISOString();
    lastCollectedAt.set(serverId, collectedAt);
    return toSnapshot(def, collectedAt);
  }
}
