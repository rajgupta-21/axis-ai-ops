import { createAnsibleAdapter } from "@/adapters/ansible";
import { Server, ServerDetails, ServerStatus, ServerSummary } from "@/domain/server";
import { AppError, ErrorCodes } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { filterSensitiveValues } from "@/lib/security";
import {
  getServerRow,
  listServers as listPersistedServerRows,
  upsertServer,
} from "@/repositories/serverRepository";
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

/**
 * The fleet as last recorded in Postgres. This is the fallback for every read
 * path when the Ansible control node cannot be reached: the inventory lives on
 * that host, but a copy of every server it has ever reported is already here.
 */
function toServerFromRow(row: Awaited<ReturnType<typeof listPersistedServerRows>>[number]): Server {
  return {
    id: row.id,
    hostname: row.hostname,
    ipAddress: row.ipAddress,
    os: { name: row.osName, version: row.osVersion },
    // Not "whatever it was last time": an unreachable control node means nobody
    // currently knows whether the host is up, and reporting a remembered
    // "healthy" would be asserting something unverified.
    status: "unknown",
    lastCollectedAt: row.lastCollectedAt?.toISOString() ?? null,
  };
}

/**
 * What this request can honestly say about a host's status.
 *
 * On the live path a snapshot means facts were just gathered over SSH, which is
 * direct proof the host is up — that outranks an inventory that could not say,
 * and without it every host from a static inventory file reads "unknown" while
 * displaying live CPU and memory figures beside it.
 *
 * On the fallback path that inference is invalid: the snapshot is whatever was
 * last stored, possibly days old, and says nothing about the host now. Applying
 * the live rule there reported an entire unreachable fleet as "healthy", which
 * is the one claim a degraded response must never make.
 */
function summaryStatus(server: Server, hasSnapshot: boolean, inventoryLive: boolean): ServerStatus {
  if (!inventoryLive) return "unknown";
  if (!hasSnapshot) return "unknown";
  return server.status === "unknown" ? "healthy" : server.status;
}

export interface ServerListResult {
  servers: ServerSummary[];
  /**
   * Null when the inventory was read live. Otherwise, why the list is the last
   * known state rather than the current one — surfaced to the UI so a degraded
   * dashboard says so instead of quietly showing stale data as fact.
   */
  warning: string | null;
}

export async function listServers(): Promise<ServerListResult> {
  return cached(CacheKeys.serverList(), CacheTtl.serverList, computeServerList, {
    // Never cache a fallback result — see the note on `shouldCache`.
    shouldCache: (result) => result.warning === null,
  });
}

async function computeServerList(): Promise<ServerListResult> {
  let servers: Server[];
  let warning: string | null = null;

  try {
    servers = await ansibleAdapter.getServers();
    await ensureServersPersisted(servers);
  } catch (error) {
    // Losing the inventory must not lose the dashboard. Every server the system
    // has ever seen is already persisted, so the fleet is still listable — just
    // without live status. Previously this rejected and took down not only the
    // server table but the analysis history and risk charts beside it, none of
    // which need Ansible at all.
    const detail = error instanceof Error ? error.message : "";
    logger.warn("ansible", "Live inventory unavailable; listing the last known fleet from the database.", {
      event: "ansible.inventory_unavailable",
      context: { detail },
      error,
    });

    servers = (await listPersistedServerRows()).map(toServerFromRow);
    warning =
      `Showing the last known fleet from the database — the Ansible control node could not be reached. ` +
      (detail || "Check ANSIBLE_SSH_HOST and the control node's status.");

    // Nothing persisted and no inventory means there is genuinely nothing to
    // show, and pretending the fleet is empty would be a lie. Report the real
    // failure instead.
    if (servers.length === 0) throw error;
  }

  const summaries = await Promise.all(
    servers.map(async (server): Promise<ServerSummary> => {
      let snapshot = await getLatestSnapshot(server.id);
      // Collection needs the control node too, so when that is what failed,
      // attempting it per host would just serialise one SSH timeout per server
      // and turn a fast degraded response into a very slow one.
      if (!snapshot && warning === null) {
        // A host that cannot be reached is a fact about the fleet, not a failure
        // of the request. Letting it reject here would take the whole dashboard
        // down over one bad host, hiding every server that *is* healthy — so it
        // degrades to a row with no metrics instead.
        try {
          snapshot = await collectServerData(server.id);
        } catch (error) {
          logger.warn("collection", `Collection failed for "${server.id}"; listing it without metrics.`, {
            event: "collection.degraded",
            serverId: server.id,
            error,
          });
          snapshot = null;
        }
      }

      const latestAnalysis = await prisma.impactAnalysis.findFirst({
        where: { serverId: server.id },
        orderBy: { createdAt: "desc" },
      });

      return {
        ...(await withPersistedOs(server)),
        status: summaryStatus(server, snapshot !== null, warning === null),
        lastCollectedAt: snapshot?.collectedAt ?? null,
        cpuUsagePercent: snapshot?.cpu.usagePercent ?? null,
        memoryUsedPercent: snapshot?.memory.usedPercent ?? null,
        diskUsedPercent: snapshot?.disk.usedPercent ?? null,
        softwareCount: snapshot?.software.length ?? 0,
        latestImpactLevel: latestAnalysis?.impactLevel ?? null,
      };
    })
  );

  return { servers: summaries, warning };
}

export interface ServerDetailsResult {
  details: ServerDetails;
  /** As on ServerListResult: non-null when this is last known state, not live. */
  warning: string | null;
}

export async function getServerDetails(serverId: string): Promise<ServerDetailsResult> {
  return cached(
    CacheKeys.serverDetails(serverId),
    CacheTtl.serverDetails,
    () => computeServerDetails(serverId),
    { shouldCache: (result) => result.warning === null }
  );
}

async function computeServerDetails(serverId: string): Promise<ServerDetailsResult> {
  let server: Server | undefined;
  let warning: string | null = null;

  try {
    server = (await ansibleAdapter.getServers()).find((s) => s.id === serverId);
    if (!server) {
      throw new AppError(ErrorCodes.SERVER_NOT_FOUND, `Server not found: ${serverId}`, 404);
    }
    await upsertServer(server);
  } catch (error) {
    // A genuine 404 is an answer, not an outage — don't paper over it.
    if (error instanceof AppError && error.code === ErrorCodes.SERVER_NOT_FOUND) throw error;

    const row = await getServerRow(serverId);
    if (!row) throw error;

    const detail = error instanceof Error ? error.message : "";
    logger.warn("ansible", `Live inventory unavailable for "${serverId}"; using the persisted row.`, {
      event: "ansible.inventory_unavailable",
      serverId,
      context: { detail },
      error,
    });
    server = toServerFromRow(row);
    warning =
      `Showing the last collected snapshot — the Ansible control node could not be reached, so this ` +
      `is not live data. ` + (detail || "Check ANSIBLE_SSH_HOST and the control node's status.");
  }

  let snapshot = await getLatestSnapshot(serverId);
  if (!snapshot) {
    // With no stored snapshot and no reachable control node there is genuinely
    // nothing to render, so the collection error is the honest answer.
    if (warning !== null) {
      throw new AppError(
        ErrorCodes.COLLECTION_FAILED,
        `No data has ever been collected for "${serverId}", and the Ansible control node cannot be ` +
          `reached to collect it now.`,
        502
      );
    }
    snapshot = await collectServerData(serverId);
  }

  const details: ServerDetails = {
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

  return { details, warning };
}
