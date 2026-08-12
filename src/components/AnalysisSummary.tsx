import { AnalysisRecord } from "@/domain/analysis";
import { RiskBadge } from "./RiskBadge";
import { formatDateTime } from "@/lib/format";
import { GaugeIcon, VersionIcon } from "./icons";

const IMPACT_BORDER: Record<string, string> = {
  LOW: "border-l-emerald-400",
  MEDIUM: "border-l-amber-400",
  HIGH: "border-l-orange-400",
  CRITICAL: "border-l-red-400",
};

export function AnalysisSummary({ record }: { record: AnalysisRecord }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 border-l-4 bg-white p-6 ${
        IMPACT_BORDER[record.impactLevel] ?? "border-l-slate-300"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <GaugeIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Impact Analysis</p>
            <h1 className="mt-0.5 text-xl font-semibold text-slate-900">
              {record.hostname} · {record.component}
            </h1>
            <p className="mt-1 text-sm text-slate-500">Generated {formatDateTime(record.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={record.impactLevel} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Version</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-sm text-slate-700">
              {record.currentVersion}
            </span>
            <VersionIcon className="h-4 w-4 text-slate-400" />
            <span className="rounded-md bg-amber-50 px-2.5 py-1 font-mono text-sm text-amber-700">
              {record.latestVersion}
            </span>
          </div>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Impact</dt>
          <dd className="mt-1.5 text-lg font-semibold text-slate-900">{record.impactLevel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Confidence</dt>
          <dd className="mt-1.5 text-lg font-semibold text-slate-900">{record.confidence}</dd>
        </div>
      </div>
    </div>
  );
}
