import { createAnsibleAdapter } from "@/adapters/ansible";
import { ServerSnapshot } from "@/domain/server";
import { createSnapshot } from "@/repositories/snapshotRepository";
import { updateLastCollected, updateServerStatus, upsertServer } from "@/repositories/serverRepository";
import { AppError, ErrorCodes } from "@/lib/errors";

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
  } catch {
    throw new AppError(
      ErrorCodes.COLLECTION_FAILED,
      "Unable to collect server data. The previous snapshot remains available.",
      502
    );
  }

  const server = servers.find((s) => s.id === serverId);
  if (!server) {
    throw new AppError(ErrorCodes.SERVER_NOT_FOUND, `Server not found: ${serverId}`, 404);
  }

  await upsertServer(server);

  let snapshot: ServerSnapshot;
  try {
    snapshot = await ansibleAdapter.collectServerData(serverId);
  } catch {
    throw new AppError(
      ErrorCodes.COLLECTION_FAILED,
      "Unable to collect server data. The previous snapshot remains available.",
      502
    );
  }

  const snapshotId = await createSnapshot(snapshot);
  await updateLastCollected(serverId, new Date(snapshot.collectedAt));
  await updateServerStatus(serverId, server.status);

  return { snapshot, snapshotId };
}
