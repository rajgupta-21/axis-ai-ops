import { ReleaseInformation } from "@/domain/release";

export interface ReleaseAdapter {
  getLatestVersion(
    software: string,
    currentVersion: string
  ): Promise<ReleaseInformation>;
}
