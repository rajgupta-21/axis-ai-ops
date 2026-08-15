import { AnsibleAdapter } from "./AnsibleAdapter";
import { SimulatedAnsibleAdapter } from "./SimulatedAnsibleAdapter";
import { AWXApiAdapter } from "./AWXApiAdapter";
import { Ec2AnsibleAdapter } from "./Ec2AnsibleAdapter";

let cached: AnsibleAdapter | null = null;

/**
 * Selects how server data is collected, from ANSIBLE_PROVIDER:
 *
 *   ec2       — SSH to the Ansible control node on EC2 and run read-only fact
 *               modules there. The inventory is owned by that host
 *               (ANSIBLE_INVENTORY_PATH), not by this application.
 *   awx       — AWX/AAP REST API. Stub; not yet connected to a live instance.
 *   simulated — five fixed in-memory servers, for local development.
 *
 * The choice is fixed at startup, so changing it requires a restart.
 */
export function createAnsibleAdapter(): AnsibleAdapter {
  if (cached) return cached;

  switch (process.env.ANSIBLE_PROVIDER) {
    case "ec2":
      cached = new Ec2AnsibleAdapter();
      break;
    case "awx":
      cached = new AWXApiAdapter();
      break;
    case "simulated":
    default:
      cached = new SimulatedAnsibleAdapter();
      break;
  }

  return cached;
}

export type { AnsibleAdapter };
