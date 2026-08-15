import { ReleaseAdapter } from "./ReleaseAdapter";
import { SimulatedReleaseAdapter } from "./SimulatedReleaseAdapter";
import { OfficialReleaseAdapter } from "./OfficialReleaseAdapter";
import { TavilyReleaseAdapter } from "./TavilyReleaseAdapter";

let cached: ReleaseAdapter | null = null;

/**
 * Selects where "latest version" comes from, via RELEASE_PROVIDER:
 *
 *   tavily    — web search (Tavily) plus LLM extraction, verified against the
 *               retrieved text. Covers arbitrary software.
 *   official  — public GitHub Releases API, but only for the four hardcoded
 *               repositories in OfficialReleaseAdapter; everything else returns
 *               "Insufficient data" without a network call.
 *   simulated — fixed local data, for development.
 */
export function createReleaseAdapter(): ReleaseAdapter {
  if (cached) return cached;

  switch (process.env.RELEASE_PROVIDER) {
    case "tavily":
      cached = new TavilyReleaseAdapter();
      break;
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
