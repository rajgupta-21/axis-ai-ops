import { createAnsibleAdapter } from "@/adapters/ansible";
import { Server, ServerDetails, ServerSummary } from "@/domain/server";
import { AppError, ErrorCodes } from "@/lib/errors";
import { filterSensitiveValues } from "@/lib/security";
import { getServerRow, upsertServer } from "@/repositories/serverRepository";
import { getLatestSnapshot } from "@/repositories/snapshotRepository";
import { prisma } from "@/lib/db";
import { collectServerData } from "./collectionService";
import { CacheKeys, CacheTtl, cached } from "@/lib/cache";

const ansibleAdapter = createAnsibleAdapter();

async function ensureServersPersisted(servers: Server[]): Promise<void> {
  await Promise.all(servers.map((s) => upsertServer(s)));
}

/**
 * Fills in the OS from the persisted row when the adapter does not know it.
 * Inventory-driven adapters can only learn a host's OS by gathering facts, so
 * the authoritative value lives on the Server row after the first collection —
 * without this the UI would keep showing "Unknown" despite having the data.
 */
async function withPersistedOs(server: Server): Promise<Server> {
  if (server.os.name && server.os.name !== "Unknown") return server;

  const row = await getServerRow(server.id);
  if (!row?.osName || row.osName === "Unknown") return server;

  return { ...server, os: { name: row.osName, version: row.osVersion } };
}

export async function listServers(): Promise<ServerSummary[]> {
  return cached(CacheKeys.serverList(), CacheTtl.serverList, computeServerList);
}

async function computeServerList(): Promise<ServerSummary[]> {
  const servers = await ansibleAdapter.getServers();
  await ensureServersPersisted(servers);

  return Promise.all(
    servers.map(async (server) => {
      let snapshot = await getLatestSnapshot(server.id);
      if (!snapshot) {
        // A host that cannot be reached is a fact about the fleet, not a failure
        // of the request. Letting it reject here would take the whole dashboard
        // down over one bad host, hiding every server that *is* healthy — so it
        // degrades to a row with no metrics instead.
        try {
          snapshot = await collectServerData(server.id);
        } catch (error) {
          console.warn(
            `[servers] collection failed for "${server.id}", listing it without metrics:`,
            error instanceof Error ? error.message : error
          );
          snapshot = null;
        }
      }

      const latestAnalysis = await prisma.impactAnalysis.findFirst({
        where: { serverId: server.id },
        orderBy: { createdAt: "desc" },
      });

      return {
        ...(await withPersistedOs(server)),
        // A successful fact collection is direct proof the host is up, so it
        // outranks an inventory that could not say. Without this every host from
        // a static inventory file reads "unknown" even while returning live CPU
        // and memory figures, which reads as a broken dashboard.
        status: snapshot ? (server.status === "unknown" ? "healthy" : server.status) : "unknown",
        lastCollectedAt: snapshot?.collectedAt ?? null,
        cpuUsagePercent: snapshot?.cpu.usagePercent ?? null,
        memoryUsedPercent: snapshot?.memory.usedPercent ?? null,
        diskUsedPercent: snapshot?.disk.usedPercent ?? null,
        softwareCount: snapshot?.software.length ?? 0,
        latestImpactLevel: latestAnalysis?.impactLevel ?? null,
      };
    })
  );
}

export async function getServerDetails(serverId: string): Promise<ServerDetails> {
  return cached(CacheKeys.serverDetails(serverId), CacheTtl.serverDetails, () =>
    computeServerDetails(serverId)
  );
}

async function computeServerDetails(serverId: string): Promise<ServerDetails> {
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
    ...(await withPersistedOs(server)),
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
