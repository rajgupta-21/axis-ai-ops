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

  const [software, analyses] = await Promise.all([
    apiFetch<SoftwareVersionInfo[]>(`/api/servers/${serverId}/software`),
    apiFetch<AnalysisRecord[]>(`/api/servers/${serverId}/analyses`),
  ]);

  return <ServerDetailTabs server={server} software={software} analyses={analyses} />;
}
