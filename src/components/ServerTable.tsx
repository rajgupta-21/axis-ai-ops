import Link from "next/link";
import { ServerSummary } from "@/domain/server";
import { StatusBadge } from "./StatusBadge";
import { RiskBadge } from "./RiskBadge";
import { formatRelativeCollected } from "@/lib/format";
import { ServerIcon } from "./icons";

function metricColor(percent: number | null): string {
  if (percent === null) return "text-slate-400";
  if (percent >= 80) return "text-red-600";
  if (percent >= 65) return "text-amber-600";
  return "text-slate-600";
}

export function ServerTable({ servers }: { servers: ServerSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Server</th>
            <th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">OS</th>
            <th className="px-4 py-3 text-right">CPU</th>
            <th className="px-4 py-3 text-right">Memory</th>
            <th className="px-4 py-3 text-right">Disk</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Software</th>
            <th className="px-4 py-3">Last Collection</th>
            <th className="px-4 py-3">Analysis</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {servers.map((server) => (
            <tr key={server.id} className="transition hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/servers/${server.id}`} className="flex items-center gap-2.5 font-medium text-slate-900 hover:underline">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <ServerIcon className="h-3.5 w-3.5" />
                  </span>
                  {server.hostname}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{server.ipAddress}</td>
              <td className="px-4 py-3 text-slate-600">
                {server.os.name} {server.os.version}
              </td>
              <td className={`px-4 py-3 text-right font-medium ${metricColor(server.cpuUsagePercent)}`}>
                {server.cpuUsagePercent ?? "—"}%
              </td>
              <td className={`px-4 py-3 text-right font-medium ${metricColor(server.memoryUsedPercent)}`}>
                {server.memoryUsedPercent ?? "—"}%
              </td>
              <td className={`px-4 py-3 text-right font-medium ${metricColor(server.diskUsedPercent)}`}>
                {server.diskUsedPercent ?? "—"}%
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={server.status} />
              </td>
              <td className="px-4 py-3 text-right text-slate-600">{server.softwareCount}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                {formatRelativeCollected(server.lastCollectedAt)}
              </td>
              <td className="px-4 py-3">
                <RiskBadge level={server.latestImpactLevel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
