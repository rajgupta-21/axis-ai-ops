import { AnsibleAdapter } from "./AnsibleAdapter";
import { Server, ServerDetails, ServerSnapshot } from "@/domain/server";
import { AppError, ErrorCodes } from "@/lib/errors";
import {
  RemoteAnsibleError,
  getAnsibleTarget,
  listRemoteInventory,
  runRemoteFactsModule,
} from "@/lib/remoteAnsible";
import { mapFactsToSnapshot, slugify, toServerFromHostVars } from "./factsMapper";
import { collectSourceInstalledSoftware } from "@/lib/sourceSoftware";

/**
 * Talks to the Ansible control node running on a dedicated EC2 instance.
 *
 * Ansible, its inventory, and its SSH keys for the managed fleet all live on
 * that instance; this backend holds none of them. Every call SSHes to the
 * instance and runs a read-only command there — `ansible-inventory --list` to
 * enumerate hosts, and the official `setup` / `package_facts` / `service_facts`
 * modules to gather facts. No playbook is ever run and nothing can modify a
 * managed host.
 *
 * The inventory is whatever the EC2 instance is configured with (see
 * ANSIBLE_INVENTORY_PATH), which is why there is no inventory-management UI:
 * the inventory is owned by the Ansible host, not by this application.
 */
export class Ec2AnsibleAdapter implements AnsibleAdapter {
  async getServers(): Promise<Server[]> {
    try {
      const { hostvars } = await listRemoteInventory();
      return Object.entries(hostvars).map(([hostname, vars]) => toServerFromHostVars(hostname, vars));
    } catch (error) {
      throw toAppError(error, "Unable to read the inventory from the Ansible host.");
    }
  }

  async getServerDetails(serverId: string): Promise<ServerDetails> {
    const { hostname, vars } = await this.findHost(serverId);
    return { ...toServerFromHostVars(hostname, vars), snapshot: null };
  }

  async collectServerData(serverId: string): Promise<ServerSnapshot> {
    const { hostname, vars } = await this.findHost(serverId);

    try {
      // Run sequentially rather than in parallel: the three modules share one
      // SSH hop to the control node, and package_facts on a large host is heavy
      // enough that three concurrent ansible processes there is worse than
      // three quick ones in series.
      const setupFacts = await runRemoteFactsModule(hostname, "setup");
      const packageFacts = await runRemoteFactsModule(hostname, "package_facts");
      const serviceFacts = await runRemoteFactsModule(hostname, "service_facts");

      const snapshot = mapFactsToSnapshot(
        serverId,
        hostname,
        toServerFromHostVars(hostname, vars).ipAddress,
        setupFacts,
        packageFacts,
        serviceFacts
      );

      // The package manager cannot see software built from source or unpacked
      // into /opt, which on a hand-built host is often the software that matters
      // most. Discovery runs after the package facts so anything the RPM database
      // already reported can be skipped rather than duplicated.
      const packagedNames = new Set(snapshot.software.map((s) => s.name.toLowerCase()));
      const source = await collectSourceInstalledSoftware(hostname, packagedNames);
      if (source.software.length > 0) {
        console.info(
          `[collect] ${hostname}: ${source.software.length} source-installed programs ` +
            `(${source.discovered} executables discovered, ${source.probed} probed)`
        );
      }

      return {
        ...snapshot,
        software: [...snapshot.software, ...source.software],
      };
    } catch (error) {
      throw toAppError(error, `Unable to collect facts for "${hostname}".`);
    }
  }

  private async findHost(serverId: string): Promise<{ hostname: string; vars: Record<string, unknown> }> {
    let hostvars: Record<string, Record<string, unknown>>;
    try {
      ({ hostvars } = await listRemoteInventory());
    } catch (error) {
      throw toAppError(error, "Unable to read the inventory from the Ansible host.");
    }

    for (const [hostname, vars] of Object.entries(hostvars)) {
      if (slugify(hostname) === serverId) {
        return { hostname, vars };
      }
    }

    throw new AppError(ErrorCodes.SERVER_NOT_FOUND, `Server not found: ${serverId}`, 404);
  }
}

/** Preserves the specific remote-ansible diagnosis instead of flattening it to a generic failure. */
function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof RemoteAnsibleError ? error.message : fallbackMessage;
  return new AppError(ErrorCodes.COLLECTION_FAILED, message, 502);
}

/** Non-secret description of where Ansible is being driven, for /api/system/info. */
export function describeAnsibleTarget(): { host: string; user: string; port: number; inventoryPath: string } {
  const t = getAnsibleTarget();
  return { host: t.host, user: t.user, port: t.port, inventoryPath: t.inventoryPath };
}
