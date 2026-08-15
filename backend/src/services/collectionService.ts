import { createAnsibleAdapter } from "@/adapters/ansible";
import { ServerSnapshot } from "@/domain/server";
import { createSnapshot } from "@/repositories/snapshotRepository";
import {
  updateLastCollected,
  updateServerOs,
  updateServerStatus,
  upsertServer,
} from "@/repositories/serverRepository";
import { AppError, ErrorCodes } from "@/lib/errors";
import { invalidateServer } from "@/lib/cache";

const ansibleAdapter = createAnsibleAdapter();

/**
 * Collects a fresh server snapshot through the Ansible adapter and
 * persists it. If collection fails, the previous snapshot (if any)
 * remains available in the database untouched.
 */
export interface CollectionResult {
  snapshot: ServerSnapshot;
  snapshotId: string;
}

export async function collectServerData(serverId: string): Promise<ServerSnapshot> {
  return (await collectServerDataWithId(serverId)).snapshot;
}

export async function collectServerDataWithId(serverId: string): Promise<CollectionResult> {
  let servers;
  try {
    servers = await ansibleAdapter.getServers();
  } catch (error) {
    throw toCollectionError(error);
  }

  const server = servers.find((s) => s.id === serverId);
  if (!server) {
    throw new AppError(ErrorCodes.SERVER_NOT_FOUND, `Server not found: ${serverId}`, 404);
  }

  await upsertServer(server);

  let snapshot: ServerSnapshot;
  try {
    snapshot = await ansibleAdapter.collectServerData(serverId);
  } catch (error) {
    throw toCollectionError(error);
  }

  const snapshotId = await createSnapshot(snapshot);
  await updateLastCollected(serverId, new Date(snapshot.collectedAt));
  await updateServerStatus(serverId, server.status);
  // ServerSnapshot has no OS column — the OS lives on the Server row, so the
  // value discovered by the setup module has to be written back here or it is
  // lost and the UI shows "Unknown" forever.
  await updateServerOs(serverId, snapshot.os);

  // The entire point of a collection is that the cached view is now out of date,
  // so drop it here rather than letting the TTL decide. Without this, clicking
  // "Collect data" would appear to do nothing until the TTL expired.
  await invalidateServer(serverId);

  return { snapshot, snapshotId };
}

/**
 * Preserves the adapter's specific diagnosis rather than replacing it with a
 * generic message. The Ansible adapters distinguish "ssh could not connect",
 * "ansible is not installed on the control node", "host was unreachable", and
 * "timed out" — collapsing those into one opaque string makes a misconfigured
 * control node effectively undebuggable from the UI.
 */
function toCollectionError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const detail = error instanceof Error ? error.message : "";
  return new AppError(
    ErrorCodes.COLLECTION_FAILED,
    detail
      ? `Unable to collect server data: ${detail} The previous snapshot remains available.`
      : "Unable to collect server data. The previous snapshot remains available.",
    502
  );
}
