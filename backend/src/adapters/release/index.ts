import { ReleaseAdapter } from "./ReleaseAdapter";
import { SimulatedReleaseAdapter } from "./SimulatedReleaseAdapter";
import { OfficialReleaseAdapter } from "./OfficialReleaseAdapter";

let cached: ReleaseAdapter | null = null;

export function createReleaseAdapter(): ReleaseAdapter {
  if (cached) return cached;

  switch (process.env.RELEASE_PROVIDER) {
    case "official":
      cached = new OfficialReleaseAdapter();
      break;
    case "simulated":
    default:
      cached = new SimulatedReleaseAdapter();
      break;
  }

  return cached;
}

export type { ReleaseAdapter };
