import { AnsibleAdapter } from "./AnsibleAdapter";
import { SimulatedAnsibleAdapter } from "./SimulatedAnsibleAdapter";
import { AWXApiAdapter } from "./AWXApiAdapter";

let cached: AnsibleAdapter | null = null;

export function createAnsibleAdapter(): AnsibleAdapter {
  if (cached) return cached;

  switch (process.env.ANSIBLE_PROVIDER) {
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
