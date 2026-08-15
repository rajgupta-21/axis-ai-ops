import { Server, ServerSnapshot, ServiceInfo, SoftwareComponent } from "@/domain/server";

/** Stable server id derived from the inventory hostname. */
export function slugify(hostname: string): string {
  return hostname.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** Builds the pre-collection Server record from inventory data alone. */
export function toServerFromHostVars(hostname: string, vars: Record<string, unknown>): Server {
  return {
    id: slugify(hostname),
    hostname,
    ipAddress: asString(vars["ansible_host"]) ?? hostname,
    os: { name: "Unknown", version: "" },
    status: statusFromHostVars(vars),
    lastCollectedAt: null,
  };
}

/**
 * Derives a server's status from the inventory rather than reporting every host
 * as "unknown".
 *
 * The dynamic EC2 inventory composes `ias_state` from the instance's EC2 state,
 * which makes AWS the authority on whether a machine is up. Hosts that come from
 * a static inventory file have no such fact, so they stay "unknown" until a
 * successful collection proves otherwise — see listServers, which promotes a host
 * it has just gathered facts from.
 */
function statusFromHostVars(vars: Record<string, unknown>): Server["status"] {
  // ServerStatus describes health, not power state, so the EC2 lifecycle is
  // mapped onto it: an instance that is not running cannot serve traffic, which
  // is a critical condition for a machine this system is asked to manage.
  switch (asString(vars["ias_state"])?.toLowerCase()) {
    case "running":
      return "healthy";
    case "pending":
      return "warning";
    case "stopping":
    case "stopped":
    case "shutting-down":
    case "terminated":
      return "critical";
    default:
      return "unknown";
  }
}

/** Normalizes raw setup/package_facts/service_facts output into a ServerSnapshot. */
export function mapFactsToSnapshot(
  serverId: string,
  hostname: string,
  ipAddress: string,
  setupFacts: Record<string, unknown>,
  packageFacts: Record<string, unknown>,
  serviceFacts: Record<string, unknown>
): ServerSnapshot {
  const memTotalMb = asNumber(setupFacts["ansible_memtotal_mb"]) ?? 0;
  const memFreeMb = asNumber(setupFacts["ansible_memfree_mb"]) ?? memTotalMb;
  const memoryUsedPercent = memTotalMb > 0 ? Math.round(((memTotalMb - memFreeMb) / memTotalMb) * 100) : 0;

  const mounts = Array.isArray(setupFacts["ansible_mounts"])
    ? (setupFacts["ansible_mounts"] as Record<string, unknown>[])
    : [];
  const rootMount = mounts.find((m) => m["mount"] === "/");
  const diskTotalBytes = asNumber(rootMount?.["size_total"]) ?? 0;
  const diskAvailableBytes = asNumber(rootMount?.["size_available"]) ?? diskTotalBytes;
  const diskUsedPercent =
    diskTotalBytes > 0 ? Math.round(((diskTotalBytes - diskAvailableBytes) / diskTotalBytes) * 100) : 0;

  const dateTime = setupFacts["ansible_date_time"] as Record<string, unknown> | undefined;

  const packages = (packageFacts["packages"] as Record<string, Array<Record<string, unknown>>> | undefined) ?? {};
  const software: SoftwareComponent[] = Object.entries(packages).map(([name, entries]) => ({
    name,
    version: asString(entries[0]?.["version"]) ?? "Insufficient data",
    origin: "package" as const,
  }));

  const services = (serviceFacts["services"] as Record<string, Record<string, unknown>> | undefined) ?? {};
  const serviceList: ServiceInfo[] = Object.entries(services).map(([name, info]) => {
    const state = asString(info["state"]);
    return {
      name,
      status: state === "running" ? "running" : state === "stopped" ? "stopped" : "unknown",
    };
  });

  return {
    serverId,
    hostname,
    ipAddress,
    os: {
      name: asString(setupFacts["ansible_distribution"]) ?? "Unknown",
      version: asString(setupFacts["ansible_distribution_version"]) ?? "Unknown",
    },
    kernel: asString(setupFacts["ansible_kernel"]) ?? "Insufficient data",
    architecture: asString(setupFacts["ansible_architecture"]) ?? "Insufficient data",
    cpu: {
      cores: asNumber(setupFacts["ansible_processor_vcpus"]) ?? asNumber(setupFacts["ansible_processor_cores"]) ?? 0,
      // Live CPU utilization is not exposed by the "setup" module without an
      // extra shell diagnostic, which is deliberately out of scope — collection
      // stays limited to read-only fact modules.
      usagePercent: 0,
    },
    memory: {
      totalMB: memTotalMb,
      usedPercent: memoryUsedPercent,
    },
    disk: {
      totalGB: diskTotalBytes > 0 ? Math.round(diskTotalBytes / 1e9) : 0,
      usedPercent: diskUsedPercent,
    },
    software,
    services: serviceList,
    modules: [],
    configuration: {
      modules: [],
      ports: [],
      importantValues: {},
      installedPackages: software.map((s) => s.name),
      timezone: asString(dateTime?.["tz"]) ?? "Insufficient data",
    },
    collectedAt: new Date().toISOString(),
  };
}
