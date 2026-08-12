import { ServerDetails } from "@/domain/server";
import { StatusBadge } from "./StatusBadge";
import { formatDateTime } from "@/lib/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

export function ServerInfoCard({ server }: { server: ServerDetails }) {
  const snapshot = server.snapshot;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Server Information</p>
      <div className="mt-1 divide-y divide-slate-100">
        <Row label="Hostname" value={server.hostname} />
        <Row label="IP Address" value={server.ipAddress} />
        <Row label="OS" value={`${server.os.name} ${server.os.version}`} />
        <Row label="Kernel" value={snapshot?.kernel ?? "—"} />
        <Row label="Architecture" value={snapshot?.architecture ?? "—"} />
        <Row
          label="Last Collected"
          value={server.lastCollectedAt ? formatDateTime(server.lastCollectedAt) : "Never"}
        />
        <Row label="Server Status" value={<StatusBadge status={server.status} size="sm" />} />
      </div>
    </div>
  );
}
