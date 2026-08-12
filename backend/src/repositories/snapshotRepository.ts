import { prisma } from "@/lib/db";
import { ServerSnapshot } from "@/domain/server";

export async function createSnapshot(snapshot: ServerSnapshot): Promise<string> {
  const created = await prisma.serverSnapshot.create({
    data: {
      serverId: snapshot.serverId,
      kernel: snapshot.kernel,
      architecture: snapshot.architecture,
      cpuCores: snapshot.cpu.cores,
      cpuUsagePercent: snapshot.cpu.usagePercent,
      memoryTotalMb: snapshot.memory.totalMB,
      memoryUsedPercent: snapshot.memory.usedPercent,
      diskTotalGb: snapshot.disk.totalGB,
      diskUsedPercent: snapshot.disk.usedPercent,
      networkData: (snapshot.network as object | undefined) ?? undefined,
      services: snapshot.services as unknown as object,
      modules: snapshot.modules as unknown as object,
      configuration: snapshot.configuration as unknown as object,
      collectedAt: new Date(snapshot.collectedAt),
      softwareInventory: {
        create: snapshot.software.map((s) => ({ name: s.name, version: s.version })),
      },
    },
  });
  return created.id;
}

function rowToSnapshot(
  row: NonNullable<Awaited<ReturnType<typeof prisma.serverSnapshot.findUnique>>>,
  hostname: string,
  ipAddress: string,
  osName: string,
  osVersion: string,
  software: { name: string; version: string }[]
): ServerSnapshot {
  return {
    serverId: row.serverId,
    hostname,
    ipAddress,
    os: { name: osName, version: osVersion },
    kernel: row.kernel,
    architecture: row.architecture,
    cpu: { cores: row.cpuCores, usagePercent: row.cpuUsagePercent },
    memory: { totalMB: row.memoryTotalMb, usedPercent: row.memoryUsedPercent },
    disk: { totalGB: row.diskTotalGb, usedPercent: row.diskUsedPercent },
    network: (row.networkData as ServerSnapshot["network"]) ?? undefined,
    software,
    services: row.services as unknown as ServerSnapshot["services"],
    modules: row.modules as unknown as string[],
    configuration: row.configuration as unknown as ServerSnapshot["configuration"],
    collectedAt: row.collectedAt.toISOString(),
  };
}

export async function getLatestSnapshot(serverId: string): Promise<ServerSnapshot | null> {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) return null;

  const row = await prisma.serverSnapshot.findFirst({
    where: { serverId },
    orderBy: { collectedAt: "desc" },
    include: { softwareInventory: true },
  });
  if (!row) return null;

  return rowToSnapshot(
    row,
    server.hostname,
    server.ipAddress,
    server.osName,
    server.osVersion,
    row.softwareInventory.map((s) => ({ name: s.name, version: s.version }))
  );
}

export async function getSnapshotById(snapshotId: string): Promise<ServerSnapshot | null> {
  const row = await prisma.serverSnapshot.findUnique({
    where: { id: snapshotId },
    include: { softwareInventory: true },
  });
  if (!row) return null;

  const server = await prisma.server.findUnique({ where: { id: row.serverId } });
  if (!server) return null;

  return rowToSnapshot(
    row,
    server.hostname,
    server.ipAddress,
    server.osName,
    server.osVersion,
    row.softwareInventory.map((s) => ({ name: s.name, version: s.version }))
  );
}
