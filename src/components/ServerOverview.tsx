import { ServerDetails } from "@/domain/server";
import { StatusBadge } from "./StatusBadge";
import { formatDateTime } from "@/lib/format";
import { ClockIcon, ConfigIcon, ServerIcon } from "./icons";

export function ServerOverview({ server }: { server: ServerDetails }) {
  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ServerIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{server.hostname}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {server.ipAddress} · {server.os.name} {server.os.version}
            </p>
          </div>
        </div>
        <StatusBadge status={server.status} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-4">
        <div className="flex items-start gap-2">
          <ConfigIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Kernel</dt>
            <dd className="mt-0.5 font-medium text-slate-700">{server.snapshot?.kernel ?? "—"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ServerIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Architecture</dt>
            <dd className="mt-0.5 font-medium text-slate-700">{server.snapshot?.architecture ?? "—"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Server Status</dt>
            <dd className="mt-0.5 font-medium capitalize text-slate-700">{server.status}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ClockIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Last Collection</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {server.lastCollectedAt ? formatDateTime(server.lastCollectedAt) : "Never"}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
