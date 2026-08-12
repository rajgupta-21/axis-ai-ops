import { createReleaseAdapter } from "@/adapters/release";
import { ReleaseInformation } from "@/domain/release";
import { AppError, ErrorCodes } from "@/lib/errors";

const releaseAdapter = createReleaseAdapter();

/**
 * Retrieves LATEST RELEASE DATA for a software component, kept clearly
 * separate from CURRENT SERVER DATA supplied by the Ansible adapter.
 */
export async function getLatestRelease(
  software: string,
  currentVersion: string
): Promise<ReleaseInformation> {
  try {
    return await releaseAdapter.getLatestVersion(software, currentVersion);
  } catch {
    throw new AppError(
      ErrorCodes.RELEASE_LOOKUP_FAILED,
      "Latest release information could not be retrieved. Impact analysis cannot determine the version impact reliably.",
      502
    );
  }
}
