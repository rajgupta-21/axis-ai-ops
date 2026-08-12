import { apiFetch } from "@/lib/apiClient";
import { ServerSummary } from "@/domain/server";
import { ServerTable } from "@/components/ServerTable";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const servers = await apiFetch<ServerSummary[]>("/api/servers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Servers</h1>
        <p className="mt-1 text-sm text-slate-500">
          All servers monitored through the Ansible/AWX adapter. Select a server to inspect its
          configuration and installed software.
        </p>
      </div>
      <ServerTable servers={servers} />
    </div>
  );
}
