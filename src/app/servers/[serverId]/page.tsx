import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { ServerDetails } from "@/domain/server";
import { AnalysisRecord } from "@/domain/analysis";
import { SoftwareVersionInfo } from "@/domain/software";
import { ServerDetailTabs } from "@/components/ServerDetailTabs";

export const dynamic = "force-dynamic";

export default async function ServerDetailsPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;

  let server: ServerDetails;
  try {
    server = await apiFetch<ServerDetails>(`/api/servers/${serverId}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "SERVER_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const analyses = await apiFetch<AnalysisRecord[]>(`/api/servers/${serverId}/analyses`);

  // Deliberately NOT awaited. The software list needs a release lookup per
  // package — a web search and an LLM call each — so on a cold cache it is
  // minutes slower than everything else on this page. Awaiting it here used to
  // block the whole render, which is what made the page look hung. Handing the
  // promise to the client lets React stream the software sections in behind a
  // Suspense boundary while the rest of the page is already interactive.
  const softwarePromise = apiFetch<SoftwareVersionInfo[]>(`/api/servers/${serverId}/software`);

  // An unhandled rejection on a promise nobody has awaited yet would crash the
  // process before the client component gets a chance to surface it. The catch
  // keeps it a value the UI can render as an error state.
  softwarePromise.catch(() => undefined);

  return <ServerDetailTabs server={server} softwarePromise={softwarePromise} analyses={analyses} />;
}
