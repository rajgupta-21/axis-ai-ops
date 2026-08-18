import { notFound } from "next/navigation";
import { apiFetch, apiFetchSafe } from "@/lib/apiClient";
import { ServerDetails } from "@/domain/server";
import { AnalysisRecord } from "@/domain/analysis";
import { SoftwareVersionInfo } from "@/domain/software";
import { ServerDetailTabs } from "@/components/ServerDetailTabs";
import { PageContainer } from "@/components/PageContainer";
import { StatusNotice } from "@/components/StatusNotice";

export const dynamic = "force-dynamic";

export default async function ServerDetailsPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;

  const serverResult = await apiFetchSafe<ServerDetails>(`/api/servers/${serverId}`);

  if (!serverResult.ok) {
    if (serverResult.error.code === "SERVER_NOT_FOUND") notFound();

    // Every tab on this page is a view of the snapshot, so without it there is
    // nothing to show — but the reason is worth showing in the app's own chrome
    // rather than as a crashed render.
    return (
      <PageContainer>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900">{serverId}</h1>
          <StatusNotice
            tone="error"
            title="This server could not be loaded"
            message={serverResult.error.message}
          />
        </div>
      </PageContainer>
    );
  }

  const server = serverResult.data;
  const staleWarning = serverResult.warning;

  // Past analyses live in Postgres and need nothing from Ansible, so they stay
  // visible even when the host itself is unreachable.
  const analysesResult = await apiFetchSafe<AnalysisRecord[]>(`/api/servers/${serverId}/analyses`);
  const analyses = analysesResult.ok ? analysesResult.data : [];

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

  return (
    <>
      {staleWarning && (
        <div className="px-8 pt-6">
          <StatusNotice
            tone="warning"
            title="Showing the last collected snapshot"
            message={staleWarning}
          />
        </div>
      )}
      <ServerDetailTabs server={server} softwarePromise={softwarePromise} analyses={analyses} />
    </>
  );
}
