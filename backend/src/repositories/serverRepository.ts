import { prisma } from "@/lib/db";
import { Server, ServerStatus } from "@/domain/server";

/** True when an adapter actually knows the OS, rather than defaulting it. */
function isKnownOs(os: Server["os"]): boolean {
  return Boolean(os.name) && os.name !== "Unknown";
}

export async function upsertServer(server: Server): Promise<void> {
  await prisma.server.upsert({
    where: { id: server.id },
    create: {
      id: server.id,
      hostname: server.hostname,
      ipAddress: server.ipAddress,
      osName: server.os.name,
      osVersion: server.os.version,
      status: server.status,
    },
    update: {
      hostname: server.hostname,
      ipAddress: server.ipAddress,
      status: server.status,
      // Only overwrite the OS when the caller actually knows it. Inventory-based
      // adapters cannot know a host's OS before facts are gathered, and this
      // runs on every server list — without the guard, each list request would
      // clobber a previously collected real OS back to "Unknown".
      ...(isKnownOs(server.os) ? { osName: server.os.name, osVersion: server.os.version } : {}),
    },
  });
}

/** Records the OS discovered during fact collection. */
export async function updateServerOs(serverId: string, os: Server["os"]): Promise<void> {
  if (!isKnownOs(os)) return;
  await prisma.server.update({
    where: { id: serverId },
    data: { osName: os.name, osVersion: os.version },
  });
}

export async function updateLastCollected(serverId: string, collectedAt: Date): Promise<void> {
  await prisma.server.update({
    where: { id: serverId },
    data: { lastCollectedAt: collectedAt },
  });
}

export async function updateServerStatus(serverId: string, status: ServerStatus): Promise<void> {
  await prisma.server.update({
    where: { id: serverId },
    data: { status },
  });
}

export async function listServers() {
  return prisma.server.findMany({ orderBy: { hostname: "asc" } });
}

export async function getServerRow(serverId: string) {
  return prisma.server.findUnique({ where: { id: serverId } });
}
