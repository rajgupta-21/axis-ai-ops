import { prisma } from "@/lib/db";
import { Server, ServerStatus } from "@/domain/server";

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
      osName: server.os.name,
      osVersion: server.os.version,
      status: server.status,
    },
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
