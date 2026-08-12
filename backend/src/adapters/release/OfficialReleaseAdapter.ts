import { ReleaseAdapter } from "./ReleaseAdapter";
import { ReleaseInformation } from "@/domain/release";

/**
 * Production adapter intended to query official release sources only
 * (official project release pages, changelogs, GitHub releases, vendor
 * APIs). Arbitrary third-party pages must never be treated as authoritative
 * when an official source exists. Not yet wired to live sources.
 */
export class OfficialReleaseAdapter implements ReleaseAdapter {
  async getLatestVersion(
    software: string,
    currentVersion: string
  ): Promise<ReleaseInformation> {
    // TODO: query the official source for `software` (e.g. GitHub releases
    // API, vendor changelog API) and normalize into ReleaseInformation.
    void software;
    void currentVersion;
    throw new Error(
      "OfficialReleaseAdapter is not yet connected to a live release source. Set RELEASE_PROVIDER=simulated."
    );
  }
}
