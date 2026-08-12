import Link from "next/link";
import { AnalysisRecord } from "@/domain/analysis";
import { RiskBadge } from "./RiskBadge";
import { formatDateTime } from "@/lib/format";
import { InboxIcon, VersionIcon } from "./icons";

export function AnalysisTimeline({ analyses }: { analyses: AnalysisRecord[] }) {
  if (analyses.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <InboxIcon className="h-4 w-4 text-slate-400" />
        No analyses have been run yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {analyses.map((analysis) => (
        <li key={analysis.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <Link href={`/analyses/${analysis.id}`} className="text-sm font-medium text-slate-900 hover:underline">
              {analysis.hostname} · {analysis.component}
            </Link>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-600">
                {analysis.currentVersion}
              </span>
              <VersionIcon className="h-3 w-3 text-slate-400" />
              <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-600">
                {analysis.latestVersion}
              </span>
              <span className="text-slate-300">·</span>
              {formatDateTime(analysis.createdAt)}
            </div>
          </div>
          <RiskBadge level={analysis.impactLevel} />
        </li>
      ))}
    </ul>
  );
}
