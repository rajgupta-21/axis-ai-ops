import { createAnsibleAdapter } from "@/adapters/ansible";
import { Server, ServerDetails, ServerSummary } from "@/domain/server";
import { AppError, ErrorCodes } from "@/lib/errors";
import { filterSensitiveValues } from "@/lib/security";
import { upsertServer } from "@/repositories/serverRepository";
import { getLatestSnapshot } from "@/repositories/snapshotRepository";
import { prisma } from "@/lib/db";
import { collectServerData } from "./collectionService";

const ansibleAdapter = createAnsibleAdapter();

async function ensureServersPersisted(servers: Server[]): Promise<void> {
  await Promise.all(servers.map((s) => upsertServer(s)));
}

export async function listServers(): Promise<ServerSummary[]> {
  const servers = await ansibleAdapter.getServers();
  await ensureServersPersisted(servers);

  return Promise.all(
    servers.map(async (server) => {
      let snapshot = await getLatestSnapshot(server.id);
      if (!snapshot) {
        snapshot = await collectServerData(server.id);
      }

      const latestAnalysis = await prisma.impactAnalysis.findFirst({
        where: { serverId: server.id },
        orderBy: { createdAt: "desc" },
      });

      return {
        ...server,
        lastCollectedAt: snapshot.collectedAt,
        cpuUsagePercent: snapshot.cpu.usagePercent,
        memoryUsedPercent: snapshot.memory.usedPercent,
        diskUsedPercent: snapshot.disk.usedPercent,
        softwareCount: snapshot.software.length,
        latestImpactLevel: latestAnalysis?.impactLevel ?? null,
      };
    })
  );
}

export async function getServerDetails(serverId: string): Promise<ServerDetails> {
  const servers = await ansibleAdapter.getServers();
  const server = servers.find((s) => s.id === serverId);
  if (!server) {
    throw new AppError(ErrorCodes.SERVER_NOT_FOUND, `Server not found: ${serverId}`, 404);
  }

  await upsertServer(server);

  let snapshot = await getLatestSnapshot(serverId);
  if (!snapshot) {
    snapshot = await collectServerData(serverId);
  }

  return {
    ...server,
    lastCollectedAt: snapshot.collectedAt,
    snapshot: {
      ...snapshot,
      configuration: {
        ...snapshot.configuration,
        importantValues: filterSensitiveValues(snapshot.configuration.importantValues),
      },
    },
  };
}
